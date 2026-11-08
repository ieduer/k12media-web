import { beginStudentLogin, encryptCredential, parseDwrReply, StudentSourceError, STUDENT_ORIGIN } from './student-source.js';
import { mergeSourceCookies } from './student-cookies.js';
const fail=(code,status=502)=>{throw new StudentSourceError(code,status);};
export const mergeCookies=mergeSourceCookies;
export async function sourceRequest(path,session,{body,fetcher=fetch,maxBytes=4*1024*1024,contentType='application/x-www-form-urlencoded'}={}){
  const cookies=typeof session==='string'?session:session.cookies;
  const u=new URL(path,STUDENT_ORIGIN);if(u.origin!==STUDENT_ORIGIN || !u.pathname.startsWith('/tqweb/'))fail('source_origin_refused');
  let r;
  try{r=await fetcher(u.href,{method:body===undefined?'GET':'POST',body,redirect:'manual',signal:AbortSignal.timeout(30000),cache:'no-store',headers:{Cookie:cookies,Origin:STUDENT_ORIGIN,Referer:STUDENT_ORIGIN+'/tqweb/demo/MainAction.a?loginDispatcher','Content-Type':contentType}});}catch{fail('source_transport_failed');}
  if(typeof session==='object')session.cookies=mergeSourceCookies(cookies,r.headers);
  if(r.status===302||r.status===303){await r.body?.cancel();fail('session_expired',401);}
  if(!r.ok){await r.body?.cancel();fail(r.status===429?'source_rate_limited':'source_unavailable',r.status===429?429:502);}
  const text=await boundedText(r,maxBytes);
  if(/j_acegi_security_check|<title>\s*(?:Error|登录|登錄)|SSOSDK\/Error/i.test(text))fail('session_expired',401);
  return text;
}
export async function boundedText(response,limit){
 const reader=response.body?.getReader();if(!reader)fail('source_empty');let size=0,chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();fail('source_response_too_large');}chunks.push(value);}}finally{reader.releaseLock();}
 const out=new Uint8Array(size);let at=0;for(const c of chunks){out.set(c,at);at+=c.length;}return new TextDecoder().decode(out);
}
export async function finishStudentLogin(credentials,selected,choice,{fetcher=fetch}={}){
 if(!selected.selections.some(x=>x.schoolId===choice.schoolId&&x.classId===choice.classId))fail('invalid_selection',400);
 const form=new URLSearchParams({isLogin:'0',loginNum:'0',ifsecond:'0',ifChangeSelectSchool:'1',classId:choice.classId,schoolId:choice.schoolId,pass:'',validCheckCode:'0',authType:'100030',j_username:encryptCredential(credentials.username.trim()),j_password:encryptCredential(credentials.password)});
 let r;try{r=await fetcher(STUDENT_ORIGIN+'/tqweb/j_acegi_security_check',{method:'POST',body:form.toString(),redirect:'manual',signal:AbortSignal.timeout(30000),headers:{Cookie:selected.sourceCookies,Origin:STUDENT_ORIGIN,Referer:STUDENT_ORIGIN+'/tqweb/login.jsp','Content-Type':'application/x-www-form-urlencoded'}});}catch{fail('source_login_outcome_unknown');}
 const cookies=mergeCookies(selected.sourceCookies,r.headers);await r.body?.cancel();
 if(r.status===429)fail('source_rate_limited',429);
 const target=new URL(r.headers.get('Location')||'/',STUDENT_ORIGIN);
 if(target.origin!==STUDENT_ORIGIN || target.pathname!=='/tqweb/demo/MainAction.a' || !target.searchParams.has('loginDispatcher'))fail('source_login_not_accepted',403);
 if(![302,303].includes(r.status))fail('source_login_outcome_unknown');
 const state={cookies};
 const home=await loadStudentHome(state,{fetcher});
 return {cookies:state.cookies,schoolId:choice.schoolId,classId:choice.classId,home};
}
export {beginStudentLogin};
export async function loadStudentHome(session,{fetcher=fetch}={}){
 const home=await parseHome(await sourceRequest('/tqweb/demo/MainAction.a?loginDispatcher',session,{fetcher}));
 if(Object.keys(home.allFilters).length===2){
  return parseHome(await sourceRequest('/tqweb/demo/MainAction.a',session,{body:new URLSearchParams(home.allFilters).toString(),fetcher}));
 }
 return home;
}
export async function parseHome(html){
 if(!html.includes('ChangePasswordAction')||!html.includes('j_acegi_logout'))fail('source_identity_unconfirmed',401);
 const exams=[],seen=new Set(),allFilters={};let name='',select='',option=null;
 // Capture text per matching anchor without relying on source presentation classes.
 let current=null;
 const rewriter=new HTMLRewriter().on('a',{element(e){const h=e.getAttribute('href')||'';const m=h.match(/^javascript:viewTest\(\s*['"]\/tqweb\/report\/NewStudentReport\.a\?showStudentScoreReport['"]\s*,\s*(\d+)\s*\);?$/);current=null;if(m&&!seen.has(m[1])){seen.add(m[1]);current={id:m[1],title:''};exams.push(current);}e.onEndTag(()=>{current=null;});},text(t){if(current)current.title+=t.text;}}).on('a[href*="ChangePasswordAction"]',{text(t){name+=t.text;}});
 rewriter.on('form#frm select',{element(e){const key=e.getAttribute('name');select=['schoolYearId','testSemester'].includes(key)?key:'';e.onEndTag(()=>select='');}}).on('form#frm option',{element(e){option={name:select,value:e.getAttribute('value')||'',label:''};e.onEndTag(()=>{if(option?.name&&/全部|所有|不限/.test(option.label))allFilters[option.name]=option.value;option=null;});},text(t){if(option)option.label+=t.text;}});
 await rewriter.transform(new Response(html)).text();
 if(exams.length>500)fail('source_schema_changed');
 return {name:name.replace(/\s+/g,' ').trim().slice(0,128),allFilters,exams:exams.map(e=>({id:e.id,title:e.title.replace(/\s+/g,' ').trim()||'考试'}))};
}
export async function loadExamReport(session,examId,{fetcher=fetch}={}){
 if(!/^\d+$/.test(examId))fail('invalid_request',400);
 const sid=session.cookies.match(/(?:^|; )DWRSESSIONID=([^;]+)/)?.[1];if(!sid)fail('session_expired',401);
 const body=['callCount=1','nextReverseAjaxIndex=0','instanceId=0','page=/tqweb/demo/MainAction.a','httpSessionId=',`scriptSessionId=${sid}/${Date.now()}`,'c0-scriptName=ServiceUtil','c0-methodName=doModifyCurrentTest','c0-id=0',`c0-param0=number:${examId}`,'batchId=3'].join('\n');
 // This is the source student's normal exam-selection action. No teacher path.
 const selected=await sourceRequest('/tqweb/dwr/call/plaincall/ServiceUtil.doModifyCurrentTest.dwr',session,{body,fetcher,contentType:'text/plain'});
 if(parseDwrReply(selected,3)!==true)fail('source_report_unavailable');
 await sourceRequest('/tqweb/report/NewStudentReport.a?showStudentScoreReport',session,{body:new URLSearchParams({testId:examId,schoolIdStr:''}).toString(),fetcher});
 const html=await sourceRequest('/tqweb/report/NewStudentReport.a?doShowStudentReport&test_id='+examId,session,{body:'',fetcher});
 if(!html.includes('CHENGJIDAN'))fail('source_report_unavailable');
 return html;
}
const subjectKeys=['paperId','subjectName','score','scoreTotal','levelId','levelName','userId','userType','name','userName','schoolId','schoolName','testId','className','testScoreLevel'];
export function parseSubjectCall(value,examId,schoolId){
 const m=value?.match(/^javascript:subjectReport2\(([\s\S]*)\);?$/);if(!m)return null;
 const s=m[1],out=[];let at=0;
 while(at<s.length){while(/\s/.test(s[at]||'')&&at<s.length)at++;let v='';const q=s[at];
  if(q==="'"||q==='"'){at++;let ended=false;while(at<s.length){let c=s[at++];if(c===q){ended=true;break;}if(c==='\\'){const n=s[at++];if(n==='u'){const h=s.slice(at,at+4);if(!/^[a-f\d]{4}$/i.test(h))return null;v+=String.fromCharCode(parseInt(h,16));at+=4;}else if(n==='n')v+='\n';else if(n==='r')v+='\r';else if(n==='t')v+='\t';else if(['\\',"'",'"','/'].includes(n))v+=n;else return null;}else v+=c;}if(!ended)return null;
  }else{const n=s.slice(at).match(/^(?:-?\d+(?:\.\d+)?|null)(?=\s*(?:,|$))/);if(!n)return null;v=n[0]==='null'?'':n[0];at+=n[0].length;}
  if(v.length>512)return null;out.push(v);while(/\s/.test(s[at]||'')&&at<s.length)at++;if(at===s.length)break;if(s[at++]!==',')return null;
 }
 if(out.length!==subjectKeys.length)return null;
 const fields=Object.fromEntries(subjectKeys.map((k,i)=>[k,out[i]]));
 if(fields.testId!==String(examId)||fields.schoolId!==String(schoolId)||!/^\d+$/.test(fields.paperId)||!/^\d+$/.test(fields.userId))return null;
 return fields;
}
export async function extractImageForm(html,examId,paperId){
 const fields={};let active=false;
 await new HTMLRewriter().on('form',{element(e){active=e.getAttribute('id')==='imgForm'||e.getAttribute('name')==='imgForm';e.onEndTag(()=>{active=false;});}}).on('input',{element(e){if(active){const k=e.getAttribute('name');if(['paperId','classNo','studentName','schoolName','testId'].includes(k))fields[k]=e.getAttribute('value')||'';}}}).transform(new Response(html)).text();
 return fields.testId===String(examId)&&fields.paperId===String(paperId)&&Object.keys(fields).length===5?fields:null;
}
export function allowedAsset(raw,examId){
 try{const u=new URL(raw,STUDENT_ORIGIN);if(u.username||u.password||u.hash)return null;
  if(u.origin===STUDENT_ORIGIN){u.pathname=u.pathname.replace(/\/+/g,'/');
   if(/^\/tqweb\/css\/new\/student_(?:test|subject)\/[a-z]+\.css$/.test(u.pathname)&&!u.search)return {url:u.href,type:'css'};
   if(u.pathname.startsWith('/tqweb/report/static_report/')&&new RegExp('/t'+String(examId)+'/').test(u.pathname)&&/\.(?:png|jpe?g|gif)$/i.test(u.pathname)&&!u.search)return {url:u.href,type:'image'};
  }
  if(u.origin==='https://yue.k12media.cn'&&u.pathname.startsWith('/tqms_image_server/')&&u.pathname.endsWith('.a')&&u.searchParams.has('showImg')&&u.searchParams.has('imgFliePath')&&u.searchParams.has('imgFileName')&&[...u.searchParams.keys()].every(x=>['showImg','imgFliePath','imgFileName'].includes(x)))return {url:u.href,type:'image'};
 }catch{}return null;
}
export async function extractImages(html,examId){const images=new Set();await new HTMLRewriter().on('img',{element(e){const a=allowedAsset(e.getAttribute('src')||'',examId);if(a?.type==='image')images.add(a.url);}}).transform(new Response(html)).text();
 // Some source viewers embed the other page URLs as quoted slider data.
 for(const m of html.matchAll(/["'](https:\/\/yue\.k12media\.cn\/tqms_image_server\/[^\s"'<>]+)["']/g)){const a=allowedAsset(m[1].replace(/&amp;/g,'&'),examId);if(a)images.add(a.url);}
 return [...images].slice(0,40);
}

export async function extractSubjectResults(html, examId, schoolId) {
  const subjects = [], seen = new Set();
  await new HTMLRewriter().on('a', { element(element) {
    const fields = parseSubjectCall(element.getAttribute('href'), examId, schoolId);
    if (!fields || seen.has(fields.paperId)) return;
    seen.add(fields.paperId);
    const number = value => /^-?\d+(?:\.\d+)?$/.test(value) ? Number(value) : null;
    const maxScore = number(fields.scoreTotal);
    const rawScore = number(fields.score);
    const score = rawScore !== null && rawScore >= 0 && (maxScore === null || rawScore <= maxScore) ? rawScore : null;
    subjects.push({ fields, name: fields.subjectName, score, maxScore: maxScore > 0 ? maxScore : null,
      rate: score !== null && maxScore > 0 ? score / maxScore : null, level: fields.levelName || null });
  }}).transform(new Response(html)).text();
  return subjects;
}
