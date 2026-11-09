import test from 'node:test';
import assert from 'node:assert/strict';
import CryptoJS from 'crypto-js';
import { checkStudentLogin, STUDENT_ORIGIN, StudentSourceError } from '../src/student-source.js';
import { handleStudentPreview } from '../src/student-preview.js';
import previewApp from '../src/student-preview.js';
import { mountLogin, describeResult } from '../../frontend/js/student-login.mjs';
const reply = (data,batch) => `dwr.engine.remote.handleCallback("${batch}","0",${data});`;
const page = 'findUnitOrClassMessage /tqweb/j_acegi_security_check';
const allowed = { STUDENT_LOGIN_TEST_ENABLED: 'true', STUDENT_LOGIN_TEST_UNTIL: '2099-01-01T00:00:00Z' };
function req(body = {username:'fixture',password:'fixture'}, options = {}) {
  return new Request('https://preview.example/api/student/login-check', {
    method:'POST',headers:{Origin:'https://preview.example','Content-Type':'application/json',...options.headers},body:JSON.stringify(body),...options
  });
}
test('single student selection submits exact source student form once; redirect never grants authentication',async()=>{
  const calls=[], responses=[new Response(page),new Response(reply('"SESSION"',1)),new Response(reply('[{type:1,schoolId:3600,classId:23}]',2)),new Response(null,{status:302,headers:{Location:'/tqweb/student.jsp'}})];
  const result=await checkStudentLogin({username:'fixture',password:'source-password'},{fetcher:(url,init)=>{calls.push({url,init});return responses.shift();}});
  assert.deepEqual(result,{state:'source_form_submitted',authenticated:false});assert.equal(calls.length,4);
  const form=new URLSearchParams(calls[3].init.body);
  assert.equal(calls[3].url,STUDENT_ORIGIN+'/tqweb/j_acegi_security_check');assert.equal(calls[3].init.redirect,'manual');
  assert.equal(form.get('authType'),'100030');assert.equal(form.get('classId'),'23');assert.equal(form.get('schoolId'),'3600');assert.equal(form.get('ifSave'),null);
  const decoded=CryptoJS.AES.decrypt(form.get('j_password'),CryptoJS.enc.Utf8.parse('xlfykj@20231026@'),{mode:CryptoJS.mode.ECB,padding:CryptoJS.pad.Pkcs7}).toString(CryptoJS.enc.Utf8);
  assert.equal(decoded,'source-password');assert.ok(!JSON.stringify(result).includes('SESSION'));
});
test('multiple school matches do not autochoose an account or post login form',async()=>{
  const responses=[page,reply('"S"',1),reply('[{type:1,schoolId:1,classId:2},{type:1,schoolId:1,classId:3}]',2)];let calls=0;
  const result=await checkStudentLogin({username:'fixture',password:'fixture'},{fetcher:()=>{calls++;return new Response(responses.shift());}});
  assert.equal(result.state,'source_selection_required');assert.equal(calls,3);
});
test('form error, unsafe redirect and missing definitive reply stop without replay',async()=>{
  for(const [last,code] of [[new Response(null,{status:302,headers:{Location:'/tqweb/login.jsp?login_error=1'}}),'source_login_not_accepted'],[new Response(null,{status:302,headers:{Location:'https://evil.invalid/'}}),'source_redirect_refused'],[new Response('unrecognized HTML'),'source_login_outcome_unknown']]){
    const responses=[new Response(page),new Response(reply('"S"',1)),new Response(reply('[{type:1,schoolId:1,classId:2}]',2)),last];let calls=0;
    await assert.rejects(checkStudentLogin({username:'fixture',password:'fixture'},{fetcher:()=>{calls++;return responses.shift();}}),e=>e.code===code);
    assert.equal(calls,4);
  }
});
test('API fails closed for origin, unknown routes, default-disabled and expired preview',async()=>{
  let calls=0;const deps={checkLogin:async()=>{calls++;return {state:'source_form_submitted',authenticated:false};}};
  assert.equal((await handleStudentPreview(req(),{},deps)).status,503);
  assert.equal((await handleStudentPreview(req(),{...allowed,STUDENT_LOGIN_TEST_UNTIL:'2020-01-01'},deps)).status,503);
  assert.equal((await handleStudentPreview(req({}, {headers:{Origin:'https://evil.invalid','Content-Type':'application/json'}}),allowed,deps)).status,403);
  assert.equal((await handleStudentPreview(new Request('https://preview.example/api/student/exams'),allowed,deps)).status,404);
  assert.equal(calls,0);
});
test('explicit no-expiry testing remains open while manual disable and invalid settings fail closed',async()=>{
  let calls=0; const deps={limiter:async()=>true,checkLogin:async()=>{calls++;return {state:'source_form_submitted',authenticated:false};}};
  assert.equal((await handleStudentPreview(req(),{STUDENT_LOGIN_TEST_ENABLED:'true',STUDENT_LOGIN_TEST_UNTIL:'none'},deps)).status,200);
  for(const env of [{STUDENT_LOGIN_TEST_ENABLED:'false',STUDENT_LOGIN_TEST_UNTIL:'none'},{STUDENT_LOGIN_TEST_ENABLED:'true'},{STUDENT_LOGIN_TEST_ENABLED:'true',STUDENT_LOGIN_TEST_UNTIL:'typo'}])
    assert.equal((await handleStudentPreview(req(),env,deps)).status,503);
  assert.equal(calls,1);
});
test('API strips private source values and returns no-store without cookies or raw exceptions',async()=>{
  let captured;
  const res=await handleStudentPreview(req(),allowed,{limiter:async()=>true,checkLogin:async data=>{captured=data;return {state:'source_form_submitted',authenticated:false,cookies:'private-source',name:'private-name'};}});
  assert.deepEqual(await res.json(),{state:'source_form_submitted',authenticated:false});assert.equal(res.headers.get('Set-Cookie'),null);assert.match(res.headers.get('Cache-Control'),/no-store/);assert.equal(captured.password,'');
  const failed=await handleStudentPreview(req(),allowed,{limiter:async()=>true,checkLogin:async()=>{throw Error('private payload');}});
  assert.deepEqual(await failed.json(),{code:'source_unavailable'});
  const locked=await handleStudentPreview(req(),allowed,{limiter:async()=>true,checkLogin:async()=>{throw new StudentSourceError('source_account_locked',423);}});
  assert.equal(locked.status,423);assert.deepEqual(await locked.json(),{code:'source_account_locked'});
});
test('API rejects oversized bodies and injected target identifiers before source access',async()=>{
  let calls=0;const deps={checkLogin:async()=>{calls++;}};
  assert.equal((await handleStudentPreview(req({username:'x',password:'x',studentId:'other'}),allowed,deps)).status,400);
  assert.equal((await handleStudentPreview(req({username:'x',password:'x'.repeat(3000)}),allowed,deps)).status,413);assert.equal(calls,0);
});
function fakeDocument(){
  const nodes=Object.fromEntries(['student-login','username','password','submit','reveal','result','result-title','result-detail','result-code'].map(id=>[id,{value:'fixture',type:'password',dataset:{},events:{},setAttribute(){},focus(){},reportValidity:()=>true,addEventListener(name,fn){this.events[name]=fn;}}]));
  return {nodes,getElementById:id=>nodes[id]};
}
test('UI duplicate clicks cannot replay credentials and password clears before awaiting the network',async()=>{
  const doc=fakeDocument();let calls=0, finish;
  mountLogin(doc,async(_url,init)=>{calls++;assert.equal(doc.nodes.password.value,'');assert.equal(init.redirect,'error');return await new Promise(resolve=>{finish=resolve;});});
  const submit=doc.nodes['student-login'].events.submit;const first=submit({preventDefault(){}});
  await submit({preventDefault(){}});assert.equal(calls,1);
  finish(new Response(JSON.stringify({code:'source_account_locked'}),{status:423,headers:{'Content-Type':'application/json'}}));await first;
  assert.equal(doc.nodes['result-title'].textContent,'星立方账号已锁定');assert.equal(doc.nodes.submit.disabled,true);
  await submit({preventDefault(){}});assert.equal(calls,1);
});
test('network ambiguity remains unknown and never becomes password rejection or successful login',async()=>{
  const doc=fakeDocument();let calls=0;mountLogin(doc,async()=>{calls++;throw Error('network');});
  await doc.nodes['student-login'].events.submit({preventDefault(){}});
  assert.equal(calls,1);assert.match(doc.nodes['result-code'].textContent,/connection_unknown/);
  assert.match(describeResult('source_form_submitted')[0],/待确认/);assert.match(describeResult('unexpected')[0],/无法/);
});
test('preview limiter blocks a repeated account before another source request',async()=>{
  let calls=0;const deps={checkLogin:async()=>{calls++;return {state:'source_form_submitted',authenticated:false};}};
  const body={username:'limiter-fixture',password:'fixture'};
  assert.equal((await handleStudentPreview(req(body),allowed,deps)).status,200);
  assert.equal((await handleStudentPreview(req(body),allowed,deps)).status,429);assert.equal(calls,1);
});
test('custom paper domain is allowed; teacher and unrelated hosts stay closed',async()=>{
  for (const [host,status] of [['paper.bdfz.net',400],['mark.bdfz.net',503],['k12media-web.pages.dev',503],['evil.invalid',503]]) {
    const request=new Request('https://'+host+'/api/student/login-check',{method:'POST',headers:{Origin:'https://'+host,'Content-Type':'application/json'},body:'{}'});
    const response=await previewApp.fetch(request,allowed);assert.equal(response.status,status,host);
  }
});
