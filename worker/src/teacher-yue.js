// Yue direct protocol adapted from Mark34ad49b, without historical/R2 fallback,
// global cross-account caches, guessed filenames or name-based authorization.
// Candidate only: not imported by the student router before real acceptance.
const BASE='https://yue.k12media.cn/testmate/json/';
export class YueSourceError extends Error {constructor(code){super(code);this.code=code}}
const fail=code=>{throw new YueSourceError(code)};
const list=x=>Array.isArray(x)?x:[];
const id=x=>{const s=String(x??'');if(!/^[1-9]\d{0,11}$/.test(s))fail('yue_scope_invalid');return s};
const mime=b=>b[0]===255&&b[1]===216&&b[2]===255?'image/jpeg':b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71?'image/png':null;
function checked(data){
  if(data?.OperatorSuccess===true)return data;
  const text=String(data?.Describe||data?.ReasonOfCannotDownload||'');
  if(/无权|無權|没有.*权限|沒有.*權限|权限不足/.test(text))fail('yue_permission_denied');
  if(/重新登录|登录失效|token.*失效/i.test(text))fail('yue_login_required');
  fail('yue_source_unavailable');
}
export async function createYueTeacher({username,password,siteId='303'},{fetcher=fetch,now=Date.now,maxRequests=16}={}){
  if(typeof username!=='string'||!username||username.length>128||typeof password!=='string'||!password||password.length>256)fail('yue_credentials_invalid');
  id(siteId);if(!Number.isInteger(maxRequests)||maxRequests<2||maxRequests>64)fail('yue_budget_invalid');
  let token='',requests=0,closed=false,createdAt=now();const papers=new Map(),scores=new Map(),imageRefs=new WeakMap();
  async function post(endpoint,params={},raw=false){
    if(closed)fail('yue_session_closed');if(now()-createdAt>180000)fail('yue_session_expired');if(++requests>maxRequests)fail('yue_request_budget');
    let r,bytes;
    try{
      r=await fetcher(BASE+endpoint+'.ashx',{method:'POST',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20000),body:new URLSearchParams(token?{token,...params}:params),headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',Origin:'https://yue.k12media.cn',Referer:'https://yue.k12media.cn/testmate/index.html'}});
      if(!r.ok){await r.body?.cancel();fail(r.status===401?'yue_login_required':r.status===403?'yue_permission_denied':r.status===429?'yue_rate_limited':'yue_source_unavailable')}
      const reader=r.body?.getReader(),chunks=[];let size=0;if(!reader)fail('yue_source_empty');
      try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>(raw?16:8)*1024*1024){await reader.cancel();fail('yue_response_too_large')}chunks.push(value)}}finally{reader.releaseLock()}
      bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length}
    }catch(error){if(error instanceof YueSourceError)throw error;fail('yue_transport_failed')}
    if(raw&&mime(bytes))return {bytes,type:mime(bytes)};
    let data;try{data=JSON.parse(new TextDecoder().decode(bytes))}catch{fail('yue_schema_changed')}
    if(!raw)return checked(data);
    checked(data);const text=String(data.FileContent||data.fileContent||data.PackageContent||'');
    if(!text||text.length>22*1024*1024)fail('yue_image_unavailable');
    try{bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0))}catch{fail('yue_image_unavailable')}
    const type=mime(bytes);if(!type)fail('yue_image_unavailable');return {bytes,type};
  }
  const close=()=>{token='';closed=true;papers.clear();scores.clear()};
  try{const login=await post('Login',{clientType:'html5',siteID:String(siteId),username,password});if(typeof login.Token!=='string'||!login.Token)fail('yue_login_required');token=login.Token;createdAt=now()}catch(error){close();throw error}
  function paper(value){const key=id(value);if(!papers.has(key))fail('yue_paper_not_in_live_catalog');return papers.get(key)}
  return {
    close,
    async catalog(){
      const data=await post('GetAllTestInfo');papers.clear();scores.clear();
      if(!Array.isArray(data.TestInfos)||data.TestInfos.length>500)fail('yue_schema_changed');
      for(const t of data.TestInfos)for(const p of list(t.Testpapers)){
        const paperId=id(p.PaperID),testId=id(t.TestID);if(papers.has(paperId))fail('yue_catalog_ambiguous');
        papers.set(paperId,Object.freeze({paperId,testId,testName:String(t.TestName||''),paperName:String(p.PaperName||''),subjectId:p.PaperSubjectInfos?.[0]?.SubjectID??p.SubjectID??null,source:'live:GetAllTestInfo'}));
      }
      return [...papers.values()];
    },
    async scores(paperId){
      const p=paper(paperId);if(scores.has(p.paperId))return scores.get(p.paperId);
      const data=await post('GetPaperScore',{paperID:p.paperId});
      if(data.PaperID!=null&&String(data.PaperID)!==p.paperId)fail('yue_paper_mismatch');
      const value={paper:p,students:list(data.StudentInfos),subjectScores:list(data.PaperSubjectScores),itemScores:list(data.PaperItemScores),classes:list(data.ClassInfos)};
      value.scoreAvailable=value.subjectScores.length>0||value.itemScores.length>0;
      // A roster-only fallback is never relabeled as successful grade data.
      scores.set(p.paperId,value);return value;
    },
    async originalPages(paperId,studentId){
      const p=paper(paperId),sid=String(studentId||'');
      const score=scores.get(p.paperId),students=score?.students.filter(s=>String(s.StudentID)===sid)||[];
      if(!sid||students.length!==1)fail('yue_identity_unverified');
      const outcomes=await Promise.allSettled([
        post('DownloadInkSynthesis',{paperID:p.paperId}),
        post('GetAnswerPaperStatusInfo',{paperID:p.paperId,schoolName:'',classNo:''})
      ]);
      for(const item of outcomes)if(item.status==='rejected')throw item.reason;
      const [ink,status]=outcomes.map(x=>x.value);
      const path=String(ink.Path||ink.path||ink.Directory||ink.directory||String(ink.ReasonOfCannotDownload||ink.Describe||'').match(/位置[:：]\s*(.+)$/)?.[1]||'').trim();
      if(!path)fail('yue_image_unavailable');
      if(status.PaperID!=null&&String(status.PaperID)!==p.paperId)fail('yue_paper_mismatch');
      const files=list(status.AnswerPaperFileInfos).filter(f=>String(f.StudentID||f.studentID)===sid);
      if(files.length>16)fail('yue_schema_changed');
      const pages=[];
      for(const f of files){
        const fileName=String(f.ImageFileName||f.FileName||f.fileName||'').trim(),sub=String(f.SubDirName||'').replace(/\\/g,'/').replace(/^\/+|\/+$/g,'');
        if(!fileName||/[\/\\\x00-\x1f]/.test(fileName)||sub.split('/').includes('..'))fail('yue_image_scope_invalid');
        const ref=Object.freeze({pageNo:Number(f.AnswerPaperSN||f.answerPaperSN||fileName.match(/_(\d+)\.[a-z0-9]+$/i)?.[1]||pages.length+1)});
        imageRefs.set(ref,{paperID:p.paperId,path:path.replace(/\\/g,'/').replace(/\/+$/g,'')+(sub?'/'+sub:''),fileName});pages.push(ref);
      }
      return {state:pages.length?'available':'source_returned_no_images',pages:pages.sort((a,b)=>a.pageNo-b.pageNo)};
    },
    async downloadOriginal(ref){if(!imageRefs.has(ref))fail('yue_image_scope_invalid');return post('DownloadInkSynthesisFile',imageRefs.get(ref),true)}
  };
}
