import test from 'node:test';import assert from 'node:assert/strict';import {createYueTeacher} from '../src/teacher-yue.js';
const creds={username:'fixture',password:'fixture-secret'},catalog={OperatorSuccess:true,TestInfos:[{TestID:10,Testpapers:[{PaperID:20,PaperSubjectInfos:[{SubjectID:1}]}]}]};
function mock(responses){const calls=[];return {calls,fetcher:async(url,init)=>{calls.push({url,init});assert(responses.length);const x=responses.shift();return new Response(x instanceof Uint8Array?x:JSON.stringify(x))}}}
test('catalog is source-issued only: no historical constants, denied-list fallback or R2',async()=>{
 const f=mock([{OperatorSuccess:true,Token:'fixture'},catalog,{OperatorSuccess:true,TestInfos:[]}]),c=await createYueTeacher(creds,f);assert.deepEqual((await c.catalog()).map(x=>x.paperId),['20']);assert.deepEqual(await c.catalog(),[]);await assert.rejects(c.scores(20),/yue_paper_not_in_live_catalog/);assert.equal(f.calls.length,3);c.close();
});
test('permission denial is terminal for that request and never becomes fake grades',async()=>{
 const f=mock([{OperatorSuccess:true,Token:'fixture'},catalog,{OperatorSuccess:false,Describe:'无权管理指定的试卷！'}]),c=await createYueTeacher(creds,f);await c.catalog();await assert.rejects(c.scores(20),/yue_permission_denied/);assert.equal(f.calls.length,3);c.close();
});
test('roster-only data is explicitly score-unavailable; two teacher sessions never share cached scores',async()=>{
 const a=mock([{OperatorSuccess:true,Token:'teacher-a'},catalog,{OperatorSuccess:true,StudentInfos:[{StudentID:'A'}]}]),b=mock([{OperatorSuccess:true,Token:'teacher-b'},catalog,{OperatorSuccess:false,Describe:'无权管理指定的试卷！'}]);
 const ca=await createYueTeacher(creds,a),cb=await createYueTeacher(creds,b);await ca.catalog();await cb.catalog();assert.equal((await ca.scores(20)).scoreAvailable,false);await assert.rejects(cb.scores(20),/yue_permission_denied/);ca.close();cb.close();
});
test('original pages require the exact source student and file metadata; guessed paths cannot be downloaded',async()=>{
 const f=mock([{OperatorSuccess:true,Token:'fixture'},catalog,{OperatorSuccess:true,PaperID:20,StudentInfos:[{StudentID:'A'}],PaperSubjectScores:[{StudentID:'A',Score:10}]},{OperatorSuccess:true,Path:'/fixture'},{OperatorSuccess:true,PaperID:20,AnswerPaperFileInfos:[{StudentID:'B',FileName:'other_1.jpg'},{StudentID:'A',FileName:'own_1.jpg',AnswerPaperSN:1}]},new Uint8Array([255,216,255,0])]);
 const c=await createYueTeacher(creds,f);await c.catalog();await c.scores(20);await assert.rejects(c.originalPages(20,'B'),/yue_identity_unverified/);const images=await c.originalPages(20,'A');assert.equal(images.pages.length,1);await assert.rejects(c.downloadOriginal({...images.pages[0]}),/yue_image_scope_invalid/);assert.equal((await c.downloadOriginal(images.pages[0])).type,'image/jpeg');assert.equal(new URLSearchParams(f.calls.at(-1).init.body).get('fileName'),'own_1.jpg');c.close();
});
test('expired sessions and uncertain network outcomes stop without retries',async()=>{
 let calls=0;await assert.rejects(createYueTeacher(creds,{fetcher:async()=>{calls++;throw Error('raw private source')}}),/yue_transport_failed/);assert.equal(calls,1);
 let now=0;const f=mock([{OperatorSuccess:true,Token:'fixture'}]),c=await createYueTeacher(creds,{...f,now:()=>now});now=180001;await assert.rejects(c.catalog(),/yue_session_expired/);assert.equal(f.calls.length,1);c.close();
});
