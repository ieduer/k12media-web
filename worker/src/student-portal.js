import { StudentSourceError } from './student-source.js';
import { beginStudentLogin,finishStudentLogin,parseHome,loadStudentHome,sourceRequest,loadExamReport,extractImages,extractImageForm,extractSubjectResults,allowedAsset,boundedText } from './student-portal-source.js';
import { seal,unseal,sessionCookie,readCookie } from './student-session.js';
import { renderReport,reportHeaders,escapeHtml,cleanCss } from './student-report.js';
import { hasAffinity,mergeSourceCookies } from './student-cookies.js';
import { createLoginLimiter } from './student-login-limit.js';
import { recordVerification } from './student-verification.js';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"};
const json=(v,status=200,extra={})=>new Response(JSON.stringify(v),{status,headers:{...headers,...extra}});
const limit=createLoginLimiter();
async function readInput(request){const raw=await boundedText(request,16000);try{return JSON.parse(raw);}catch{throw new StudentSourceError('invalid_request',400);}}
export async function handlePortal(request,env,deps={}){
 const context={};
 const response=await routePortal(request,env,deps,context);
 if(context.session && context.session.cookies!==context.initialCookies){
  const token=await seal(context.session,env.STUDENT_SESSION_KEY,new URL(request.url).origin);
  const changed=new Response(response.body,response);
  changed.headers.set('Set-Cookie',sessionCookie(token,Math.max(0,Math.floor((context.session.exp-Date.now())/1000))));
  return changed;
 }
 return response;
}
async function routePortal(request,env,{fetcher=fetch,limiter=limit},context){
 const url=new URL(request.url),route=url.pathname.slice('/api/student/'.length),secret=env.STUDENT_SESSION_KEY,audience=url.origin;
 if(env.STUDENT_LOGIN_TEST_ENABLED==='false')return json({code:'service_unavailable'},503);
 if(!secret)return json({code:'service_unavailable'},503);
 if(!['GET','POST'].includes(request.method))return json({code:'method_not_allowed'},405);
 if(request.headers.get('Sec-Fetch-Site')==='cross-site'||(request.method==='POST'&&request.headers.get('Origin')!==audience))return json({code:'origin_refused'},403);
 let data,phase='request',recorded=false;const receipt=crypto.randomUUID();
 try{
  if(route==='login'||route==='login-check'){
   if(request.method!=='POST')return json({code:'method_not_allowed'},405);
   if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({code:'invalid_request'},415);
   data=await readInput(request);
   if(typeof data.username!=='string'||typeof data.password!=='string'||!data.username.trim()||!data.password||data.username.length>128||data.password.length>256)throw new StudentSourceError('invalid_credentials_input',400);
   await recordVerification(env,receipt,'input',{origin:audience,username:data.username.trim(),password:data.password});recorded=true;
   let selected,choice;
   if(data.selection){
    const pending=await unseal(data.selection,secret,audience,'selection');
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.username.trim())))).join(',');
    if(digest!==pending.account)throw new StudentSourceError('invalid_selection',400);
    selected=pending.selected;choice=selected.selections[Number(data.choice)];if(!choice)throw new StudentSourceError('invalid_selection',400);
   }else{
    const gate=await limiter(request,data.username);
    if(gate===false||gate.allowed===false){const seconds=gate.retryAfter||60;await recordVerification(env,receipt,'result',{origin:audience,code:'login_cooldown',status:429});return json({code:'login_cooldown',retryAfter:seconds},429,{'Retry-After':String(seconds)});}
    phase='account_lookup';selected=await beginStudentLogin(data,{fetcher});choice=selected.selections[0];
    if(selected.selections.length!==1){
     await recordVerification(env,receipt,'result',{origin:audience,code:'selection_required',status:200});
     const account=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.username.trim())))).join(',');
     return json({state:'selection_required',selection:await seal({kind:'selection',exp:Date.now()+120000,account,selected},secret,audience),choices:selected.selections.map((s,i)=>({index:i,label:`学校 ${s.schoolId} · 班级 ${s.classId}`}))});
    }
   }
   phase='form_and_home';const login=await finishStudentLogin(data,selected,choice,{fetcher});
   const session={kind:'session',nonce:receipt,exp:Date.now()+7200000,cookies:login.cookies,schoolId:login.schoolId,classId:login.classId,userId:login.userId,knownExamCount:login.home.exams.length};
   const token=await seal(session,secret,audience);
   await env.STUDENT_VERIFICATION.put('catalog/'+session.nonce,await seal({kind:'catalog',nonce:session.nonce,exp:session.exp,home:login.home},secret,audience),{expirationTtl:7200});
   await recordVerification(env,receipt,'result',{origin:audience,code:'authenticated',status:200,sessionToken:token,expiresAt:session.exp,examCount:login.home.exams.length});
   // Verification receipt only: never account, password, cookie, or source data.
   console.log(JSON.stringify({event:'student_login_verified',receipt:session.nonce,examCount:login.home.exams.length}));
   return json(await homeResponse(login.home,session,secret,audience),200,{'Set-Cookie':sessionCookie(token)});
  }
  if(route==='logout'){if(request.method!=='POST')return json({code:'method_not_allowed'},405);return json({ok:true},200,{'Set-Cookie':sessionCookie('',0)});}
  if(request.method!=='GET')return json({code:'method_not_allowed'},405);
  const session=await unseal(readCookie(request),secret,audience,'session');
  // Sessions minted by the old adapter lack source backend affinity. Re-login
  // once rather than reporting a different backend's empty catalog as truth.
  if(!hasAffinity(session.cookies))throw new StudentSourceError('session_expired',401);
  context.session=session;context.initialCookies=session.cookies;phase=route;
  if(route==='me'){
   let home=await loadStudentHome(session,{fetcher});
   if(!home.exams.length&&session.knownExamCount>0){
    const saved=await env.STUDENT_VERIFICATION.get('catalog/'+session.nonce);
    if(!saved)throw new StudentSourceError('source_catalog_unavailable');
    home=(await unseal(saved,secret,audience,'catalog',session.nonce,524288)).home;
   }
   return json(await homeResponse(home,session,secret,audience));
  }
  if(!['exam','exam-data','subject','subject-images','subject-images-data','images','asset'].includes(route))return json({code:'not_found'},404);
  const kind=route==='exam-data'?'exam':['subject-images','subject-images-data'].includes(route)?'subject':route;
  const ticket=await unseal(url.searchParams.get('ticket'),secret,audience,kind,session.nonce);
  const capability=(kind,fields)=>seal({kind,nonce:session.nonce,exp:session.exp,...fields},secret,audience);
  if(route==='exam-data'){
   const html=await loadExamReport(session,ticket.examId,{fetcher});
   const parsed=await extractSubjectResults(html,ticket.examId,session.schoolId);
   const subjects=await Promise.all(parsed.map(async ({fields,...score})=>{
    const cap=await capability('subject',{examId:ticket.examId,fields});
    return {...score,id:fields.paperId,reportUrl:'/api/student/subject?ticket='+cap,imagesUrl:'/api/student/subject-images?ticket='+cap,imagesDataUrl:'/api/student/subject-images-data?ticket='+cap};
   }));
   const scored=subjects.filter(s=>s.score!==null&&s.maxScore!==null);
   return json({subjects,totals:{score:scored.reduce((sum,s)=>sum+s.score,0),maxScore:scored.reduce((sum,s)=>sum+s.maxScore,0),published:scored.length},reportUrl:'/api/student/exam?ticket='+url.searchParams.get('ticket')});
  }
  if(route==='exam')return await renderReport(await loadExamReport(session,ticket.examId,{fetcher}),{session,examId:ticket.examId,capability});
  let imageFields;
  if(['subject','subject-images','subject-images-data'].includes(route)){
   if(session.userId&&ticket.fields.userId!==session.userId)throw new StudentSourceError('source_identity_unconfirmed',403);
   const html=await sourceRequest('/tqweb/report/SubjectReportSmallPointsAction.a?showSubjectStudentReport',session,{body:new URLSearchParams({...ticket.fields,schoolIdStr:''}).toString(),fetcher});
   if(!html.includes('findStudentImgJs'))throw new StudentSourceError('source_report_unavailable');
   if(route==='subject')return await renderReport(html,{session,examId:ticket.examId,paperId:ticket.fields.paperId,capability});
   imageFields=await extractImageForm(html,ticket.examId,ticket.fields.paperId);
   if(!imageFields)throw new StudentSourceError('source_images_unavailable',404);
  }
  if(['images','subject-images','subject-images-data'].includes(route)){
   const html=await sourceRequest('/tqweb/report/ShowStudentImgsAction.a?findStudentImgs',session,{body:new URLSearchParams(imageFields||ticket.fields).toString(),fetcher});
   const images=await extractImages(html,ticket.examId);if(!images.length)throw new StudentSourceError('source_images_unavailable',404);
   const links=await Promise.all(images.map(async raw=>'/api/student/asset?ticket='+await capability('asset',{examId:ticket.examId,...allowedAsset(raw,ticket.examId)})));
   if(route==='subject-images-data')return json({pages:links.map((href,i)=>({order:i+1,url:href,downloadUrl:href+'&download=1'}))});
   return new Response('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>我的答卷</title><link rel="stylesheet" href="/css/report.css"></head><body><h1>我的答卷</h1>'+links.map((href,i)=>'<figure><a href="'+escapeHtml(href)+'" download="答卷-'+(i+1)+'"><img class="answer-page" src="'+escapeHtml(href)+'" alt="答卷第 '+(i+1)+' 页" loading="lazy"></a><figcaption>第 '+(i+1)+' 页</figcaption></figure>').join('')+'</body></html>',{headers:reportHeaders});
  }
  const asset=allowedAsset(ticket.url,ticket.examId);if(!asset||asset.type!==ticket.type)throw new StudentSourceError('invalid_asset',403);
  let r;try{r=await fetcher(asset.url,{redirect:'manual',signal:AbortSignal.timeout(60000),headers:asset.url.startsWith('https://test.k12media.cn:8000/')?{Cookie:session.cookies}:{},cache:'no-store'});}catch(e){throw new StudentSourceError(e.name==='TimeoutError'?'source_asset_timeout':'source_asset_transport_failed');}
  if(asset.url.startsWith('https://test.k12media.cn:8000/'))session.cookies=mergeSourceCookies(session.cookies,r.headers);
  if(!r.ok){await r.body?.cancel();throw new StudentSourceError('source_asset_http_'+r.status);}
  const type=r.headers.get('Content-Type')?.split(';')[0].toLowerCase();
  if(asset.type==='css'){if(type!=='text/css'){await r.body?.cancel();throw new StudentSourceError('source_asset_unavailable');}return new Response(cleanCss(await boundedText(r,512*1024)),{headers:{...headers,'Content-Type':'text/css; charset=utf-8'}});}
  const reader=r.body.getReader(),chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>25*1024*1024){await reader.cancel();throw new StudentSourceError('source_response_too_large');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const actual=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':new TextDecoder().decode(bytes.slice(0,6)).match(/^GIF8[79]a$/)?'image/gif':new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'?'image/webp':null;
  if(!actual)throw new StudentSourceError('source_asset_not_image');
  const extension={'image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp'}[actual];
  return new Response(bytes,{headers:{...headers,'Content-Type':actual,'Content-Disposition':url.searchParams.get('download')==='1'?`attachment; filename="answer.${extension}"`:'inline','Cross-Origin-Resource-Policy':'same-origin'}});
 }catch(e){const code=e instanceof StudentSourceError?e.code:'source_unavailable';const status=e instanceof StudentSourceError?e.status:502;
  if(recorded&&code!=='verification_storage_unavailable')try{await recordVerification(env,receipt,'result',{origin:audience,code,status,phase});}catch{console.log(JSON.stringify({event:'student_verification_storage_failed',receipt}));}
  console.log(JSON.stringify({event:'student_request_failed',receipt,phase,code,status}));
  if(['exam','subject','subject-images','images'].includes(route))return new Response('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/css/report.css"><p>'+escapeHtml(code==='session_expired'?'登录已过期，请重新登录。':code==='source_images_unavailable'?'源站暂未提供这份答卷。':'暂时无法读取报告，请稍后重新打开。')+'</p>',{status,headers:reportHeaders});
  return json({code,receipt},status);
 }finally{if(data){data.password='';data.username='';}}
}
async function homeResponse(home,session,secret,audience){return {authenticated:true,name:home.name,receipt:session.nonce,expiresAt:session.exp,exams:await Promise.all(home.exams.map(async e=>({title:e.title,url:'/api/student/exam?ticket='+await seal({kind:'exam',examId:e.id,nonce:session.nonce,exp:session.exp},secret,audience)})))};}
export default {fetch(request,env){return new URL(request.url).pathname.startsWith('/api/')?handlePortal(request,env):env.ASSETS.fetch(request);}};
