import test from 'node:test';
import assert from 'node:assert/strict';
import {beginStudentLogin,parseDwrReply,STUDENT_ORIGIN} from '../src/student-source.js';
const reply=(data,batch=1)=>`throw 'allowScriptTagRemoting is false.';\ndwr.engine.remote.handleCallback("${batch}","0",${data});`;
const page='findUnitOrClassMessage /tqweb/j_acegi_security_check';
test('parse only DWR literal data, preserving Unicode and source nulls',()=>{
  const out=parseDwrReply(reply('[{type:1,schoolId:3600,classId:"123",name:"\\u540c\\u5b66",missing:null}]'),1);
  assert.equal(out[0].name,'同学');assert.equal(out[0].missing,null);
  assert.equal(parseDwrReply(reply('"SESSION"'),1),'SESSION');
});
test('reject executable expressions, prototype keys, duplicate keys, wrong batch and exception envelopes',()=>{
  for(const data of ['(()=>process.exit())()','[{__proto__:{x:1}}]','{type:1,type:0}','[window.secret]','NaN','{"x":undefined}'])assert.throws(()=>parseDwrReply(reply(data),1),/source_schema_changed/);
  assert.throws(()=>parseDwrReply(reply('{}',2),1),/source_schema_changed/);
  assert.throws(()=>parseDwrReply("dwr.engine.remote.handleBatchException({name:'X'},null);",1),/source_protocol_rejected/);
});
test('source credential rejection is terminal; no form login or teacher route is attempted',async()=>{
  const calls=[], responses=[page,reply('"SESSION"'),reply('[{type:0,errorMessage:"用户名或密码错误。"}]',2)];
  await assert.rejects(beginStudentLogin({username:'test-student',password:'test-password'},{fetcher:(url,init)=>{
    calls.push({url,init});assert.equal(new URL(url).origin,STUDENT_ORIGIN);assert.ok(!url.includes('/tqms/'));
    return new Response(responses.shift(),{headers:{'Set-Cookie':'JSESSIONID=test-session; HttpOnly'}});
  }}),error=>error.code==='source_credentials_rejected'&&!error.message.includes('private'));
  assert.equal(calls.length,3);assert.equal(responses.length,0);
  const sent=calls[2].init.body;assert.ok(sent.includes('instanceId=0'));assert.ok(sent.includes('number:100030'));
  assert.ok(!sent.includes('test-password'));assert.equal(calls[2].init.redirect,'manual');
  for(const row of sent.split('\n').filter(row=>/^c0-param[01]=/.test(row))) {
    const encoded=row.split('string:')[1];assert.equal(encoded,encodeURIComponent(decodeURIComponent(encoded)));assert.ok(encoded.includes('%3D'));
  }
});
test('lookup success is never an authenticated session and strips returned private DTO fields',async()=>{
  const responses=[page,reply('"SESSION"'),reply('[{type:1,schoolId:3600,classId:123,password:"source-private",userId:777,name:"private-name"}]',2)];
  const out=await beginStudentLogin({username:'sample',password:'sample'},{fetcher:()=>new Response(responses.shift())});
  assert.equal(out.authenticated,false);assert.equal(out.state,'selection_required');
  assert.deepEqual(out.selections,[{schoolId:'3600',classId:'123',userId:'777'}]);
  assert.ok(!JSON.stringify(out).includes('private')); // Trusted ID stays in the sealed server session only.
});
test('source redirects and rate limits stop without following or retrying',async()=>{
  for(const status of [302,429]){
    let calls=0;await assert.rejects(beginStudentLogin({username:'sample',password:'sample'},{fetcher:()=>{calls++;return new Response('',{status,headers:{Location:'https://evil.invalid/'}});}}));assert.equal(calls,1);
  }
});
test('source lock and unknown refusal are distinguished without leaking upstream text',async()=>{
  for(const [message,code]of [['账号已锁定','source_account_locked'],['private account detail','source_login_not_accepted']]){
    const replies=[page,reply('"SESSION"'),reply(JSON.stringify([{type:0,errorMessage:message}]),2)];
    await assert.rejects(beginStudentLogin({username:'fixture',password:'fixture'},{fetcher:()=>new Response(replies.shift())}),e=>e.code===code&&!e.message.includes(message));
    assert.equal(replies.length,0);
  }
});

test('DWR date fields are parsed as data without executing source JavaScript',()=>{
  const reply='dwr.engine.remote.handleCallback("2","0",[{type:1,schoolId:1,classId:2,lockTime:new Date(1700000000000),errorMessage:null}]);';
  assert.equal(parseDwrReply(reply,2)[0].lockTime,1700000000000);
  for(const bad of ['new Date(alert(1))','new Function("return 1")()','new Date("1700000000000")'])
    assert.throws(()=>parseDwrReply(reply.replace('new Date(1700000000000)',bad),2));
});

test('source affinity survives bootstrap and every account lookup with no extra cookies',async()=>{
 const replies=[page,reply('"SESSION"'),reply('[{type:1,schoolId:900,classId:901}]',2)];let index=0;
 const selected=await beginStudentLogin({username:'fixture',password:'fixture'},{fetcher:(url,init)=>{
  if(index>0)assert.ok(init.headers.Cookie.includes('SERVERID=backend-a|1700000000|1700000001'));
  const r=new Response(replies[index++]);r.headers.append('Set-Cookie','SERVERID=backend-a|1700000000|1700000001; Path=/; HttpOnly');r.headers.append('Set-Cookie','JSESSIONID=fixture; Path=/');r.headers.append('Set-Cookie','remember_password=must-not-retain; Path=/');return r;
 }});
 assert.ok(selected.sourceCookies.includes('SERVERID='));assert.ok(!selected.sourceCookies.includes('remember_password'));
});
