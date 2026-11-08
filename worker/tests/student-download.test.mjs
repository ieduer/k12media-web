import test from 'node:test';import assert from 'node:assert/strict';
import {collectArchive,ownPath,cleanScores} from '../../frontend/js/student-download.mjs';
const ticket='opaque.session',url=route=>'/api/student/'+route+'?ticket='+ticket;
const grade={subjects:[{id:'1',name:'数学',score:0,maxScore:100,rate:0,level:null,reportUrl:url('subject'),imagesDataUrl:url('subject-images-data')}],totals:{score:0,maxScore:100,published:1},reportUrl:url('exam')};
const parse=()=>({querySelectorAll:selector=>[],body:{textContent:'测试报告\n零分必须保留'},documentElement:{outerHTML:'<html><body>测试报告</body></html>'}});
test('only owned source handles are accepted and exported scores contain no access tickets',()=>{
 for(const u of ['https://evil.invalid/x','//evil.invalid/x','/api/student/login','/api/student/asset?url=https://evil.invalid'])assert.throws(()=>ownPath(u));
 assert.equal(ownPath(url('exam')),url('exam'));assert.equal(cleanScores(grade).subjects[0].score,0);assert.ok(!JSON.stringify(cleanScores(grade)).includes(ticket));
});
test('AI ZIP includes per-exam JSON, report text/tables, original images and all-history CSV without credentials',async()=>{
 const fetched=[];const request=async path=>{fetched.push(path);if(path.includes('subject-images-data'))return Response.json({pages:[{order:1,url:url('asset')}]});if(path.includes('asset'))return new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}});return new Response('<html>report</html>');};
 const result=await collectArchive([{title:'考试一'},{title:'考试二'}],{getGrades:async()=>grade,request,parse});
 assert.equal(result.manifest.complete,true);assert.equal(result.manifest.exams.length,2);assert.equal(fetched.length,8);
 assert.equal(result.manifest.files.filter(f=>f.path.endsWith('scores.json')).length,2);assert.equal(result.manifest.files.filter(f=>f.path.endsWith('.jpg')).length,2);
 const bytes=new Uint8Array(await result.blob.arrayBuffer()),text=new TextDecoder().decode(bytes);assert.ok(text.includes('report.json'));assert.ok(text.includes('scores.csv'));assert.ok(!text.includes(ticket));assert.ok(!text.includes('/api/student/'));
});
test('source failure preserves available grades and explicitly marks incomplete; auth failure stops remaining source reads',async()=>{
 let calls=0;const result=await collectArchive([{title:'考试一'},{title:'考试二'}],{getGrades:async()=>grade,request:async()=>{calls++;throw Object.assign(Error('session_expired'),{code:'session_expired'});},parse});
 assert.equal(calls,1);assert.equal(result.manifest.complete,false);assert.ok(result.manifest.failures.some(x=>x.code==='session_expired'));assert.equal(result.manifest.exams.length,2);
});
test('cancellation does not request more data or produce a misleading complete archive',async()=>{
 const controller=new AbortController();controller.abort();await assert.rejects(collectArchive([{title:'考试'}],{getGrades:()=>assert.fail('must not fetch'),request:()=>{},parse,signal:controller.signal}),{name:'AbortError'});
});
