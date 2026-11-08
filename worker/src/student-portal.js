import { StudentSourceError } from './student-source.js';
import { beginStudentLogin,finishStudentLogin,parseHome,sourceRequest,loadExamReport,extractImages,allowedAsset,boundedText } from './student-portal-source.js';
import { seal,unseal,sessionCookie,readCookie } from './student-session.js';
import { renderReport,reportHeaders,escapeHtml,cleanCss } from './student-report.js';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"};
const json=(v,status=200,extra={})=>new Response(JSON.stringify(v),{status,headers:{...headers,...extra}});
const attempts=new Map();
async function limit(request,username){const now=Date.now();for(const[k,v]of attempts)if(v<=now)attempts.delete(k);if(attempts.size>4000)return false;
 const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
 const a=await hash(username),ip=await hash(request.headers.get('CF-Connecting-IP')||'local');if(attempts.has(a)||attempts.has(ip))return false;attempts.set(a,now+60000);attempts.set(ip,now+10000);return true;}
async function readInput(request){const raw=await boundedText(request,16000);try{return JSON.parse(raw);}catch{throw new StudentSourceError('invalid_request',400);}}
export async function handlePortal(request,env,{fetcher=fetch,limiter=limit}={}){
 const url=new URL(request.url),route=url.pathname.slice('/api/student/'.length),secret=env.STUDENT_SESSION_KEY,audience=url.origin;
 if(env.STUDENT_LOGIN_TEST_ENABLED==='false')return json({code:'service_unavailable'},503);
 if(!secret)return json({code:'service_unavailable'},503);
 if(!['GET','POST'].includes(request.method))return json({code:'method_not_allowed'},405);
 if(request.headers.get('Sec-Fetch-Site')==='cross-site'||(request.method==='POST'&&request.headers.get('Origin')!==audience))return json({code:'origin_refused'},403);
 let data;
 try{
  if(route==='login'||route==='login-check'){
   if(request.method!=='POST')return json({code:'method_not_allowed'},405);
   if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({code:'invalid_request'},415);
   data=await readInput(request);
   if(typeof data.username!=='string'||typeof data.password!=='string'||!data.username.trim()||!data.password||data.username.length>128||data.password.length>256)throw new StudentSourceError('invalid_credentials_input',400);
   let selected,choice;
   if(data.selection){
    const pending=await unseal(data.selection,secret,audience,'selection');
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.username.trim())))).join(',');
    if(digest!==pending.account)throw new StudentSourceError('invalid_selection',400);
    selected=pending.selected;choice=selected.selections[Number(data.choice)];if(!choice)throw new StudentSourceError('invalid_selection',400);
   }else{
    if(!await limiter(request,data.username))return json({code:'source_rate_limited'},429);
    selected=await beginStudentLogin(data,{fetcher});choice=selected.selections[0];
    if(selected.selections.length!==1){
     const account=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.username.trim())))).join(',');
     return json({state:'selection_required',selection:await seal({kind:'selection',exp:Date.now()+120000,account,selected},secret,audience),choices:selected.selections.map((s,i)=>({index:i,label:`学校 ${s.schoolId} · 班级 ${s.classId}`}))});
    }
   }
   const login=await finishStudentLogin(data,selected,choice,{fetcher});
   const session={kind:'session',nonce:crypto.randomUUID(),exp:Date.now()+7200000,cookies:login.cookies,schoolId:login.schoolId,classId:login.classId};
   const token=await seal(session,secret,audience);
   // Verification receipt only: never account, password, cookie, or source data.
   console.log(JSON.stringify({event:'student_login_verified',receipt:session.nonce,examCount:login.home.exams.length}));
   return json(await homeResponse(login.home,session,secret,audience),200,{'Set-Cookie':sessionCookie(token)});
  }
  if(route==='logout'){if(request.method!=='POST')return json({code:'method_not_allowed'},405);return json({ok:true},200,{'Set-Cookie':sessionCookie('',0)});}
  if(request.method!=='GET')return json({code:'method_not_allowed'},405);
  const session=await unseal(readCookie(request),secret,audience,'session');
  if(route==='me')return json(await homeResponse(await parseHome(await sourceRequest('/tqweb/demo/MainAction.a?loginDispatcher',session.cookies,{fetcher})),session,secret,audience));
  if(!['exam','subject','images','asset'].includes(route))return json({code:'not_found'},404);
  const ticket=await unseal(url.searchParams.get('ticket'),secret,audience,route,session.nonce);
  const capability=(kind,fields)=>seal({kind,nonce:session.nonce,exp:session.exp,...fields},secret,audience);
  if(route==='exam')return renderReport(await loadExamReport(session,ticket.examId,{fetcher}),{session,examId:ticket.examId,capability});
  if(route==='subject'){
   const html=await sourceRequest('/tqweb/report/SubjectReportSmallPointsAction.a?showSubjectStudentReport',session.cookies,{body:new URLSearchParams({...ticket.fields,schoolIdStr:''}).toString(),fetcher});
   if(!html.includes('findStudentImgJs'))throw new StudentSourceError('source_report_unavailable');
   return renderReport(html,{session,examId:ticket.examId,paperId:ticket.fields.paperId,capability});
  }
  if(route==='images'){
   const html=await sourceRequest('/tqweb/report/ShowStudentImgsAction.a?findStudentImgs',session.cookies,{body:new URLSearchParams(ticket.fields).toString(),fetcher});
   const images=await extractImages(html,ticket.examId);if(!images.length)throw new StudentSourceError('source_images_unavailable',404);
   const links=await Promise.all(images.map(async raw=>'/api/student/asset?ticket='+await capability('asset',{examId:ticket.examId,...allowedAsset(raw,ticket.examId)})));
   return new Response('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>我的答卷</title><link rel="stylesheet" href="/css/report.css"></head><body><h1>我的答卷</h1>'+links.map((href,i)=>'<figure><a href="'+escapeHtml(href)+'" download="答卷-'+(i+1)+'"><img class="answer-page" src="'+escapeHtml(href)+'" alt="答卷第 '+(i+1)+' 页" loading="lazy"></a><figcaption>第 '+(i+1)+' 页</figcaption></figure>').join('')+'</body></html>',{headers:reportHeaders});
  }
  const asset=allowedAsset(ticket.url,ticket.examId);if(!asset||asset.type!==ticket.type)throw new StudentSourceError('invalid_asset',403);
  const r=await fetcher(asset.url,{redirect:'manual',signal:AbortSignal.timeout(30000),headers:asset.url.startsWith('https://test.k12media.cn:8000/')?{Cookie:session.cookies}:{},cache:'no-store'});
  if(!r.ok){await r.body?.cancel();throw new StudentSourceError('source_asset_unavailable');}
  const type=r.headers.get('Content-Type')?.split(';')[0].toLowerCase();
  if(asset.type==='css'){if(type!=='text/css'){await r.body?.cancel();throw new StudentSourceError('source_asset_unavailable');}return new Response(cleanCss(await boundedText(r,512*1024)),{headers:{...headers,'Content-Type':'text/css; charset=utf-8'}});}
  if(!['image/png','image/jpeg','image/gif','image/webp'].includes(type)){await r.body?.cancel();throw new StudentSourceError('source_asset_unavailable');}
  return new Response(r.body,{headers:{...headers,'Content-Type':type,'Content-Disposition':'inline','Cross-Origin-Resource-Policy':'same-origin'}});
 }catch(e){const code=e instanceof StudentSourceError?e.code:'source_unavailable';const status=e instanceof StudentSourceError?e.status:502;
  if(['exam','subject','images'].includes(route))return new Response('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/css/report.css"><p>'+escapeHtml(code==='session_expired'?'登录已过期，请重新登录。':code==='source_images_unavailable'?'源站暂未提供这份答卷。':'暂时无法读取报告，请稍后重新打开。')+'</p>',{status,headers:reportHeaders});
  return json({code},status);
 }finally{if(data){data.password='';data.username='';}}
}
async function homeResponse(home,session,secret,audience){return {authenticated:true,name:home.name,receipt:session.nonce,expiresAt:session.exp,exams:await Promise.all(home.exams.map(async e=>({title:e.title,url:'/api/student/exam?ticket='+await seal({kind:'exam',examId:e.id,nonce:session.nonce,exp:session.exp},secret,audience)})))};}
export default {fetch(request,env){return new URL(request.url).pathname.startsWith('/api/')?handlePortal(request,env):env.ASSETS.fetch(request);}};
