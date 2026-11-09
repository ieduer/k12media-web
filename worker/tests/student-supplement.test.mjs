import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeStudentFirstExam as merge} from '../src/student-supplement.js';
const scope = {namespace:'tqweb',sessionNonce:'synthetic-session',schoolId:'1',userId:'2',testId:'3'};
const own = () => ({scope:{...scope},subjects:[{id:'4',name:'Subject',score:null,maxScore:100,level:null}],reportUrl:'/own-report'});
const teacher = () => ({scope:{...scope},subjects:[{id:'4',name:'Subject',score:81,maxScore:100,level:'A'}]});
test('fills missing grade and recomputes totals, preserving student report',()=>{
 const a=own(),before=structuredClone(a),out=merge(a,teacher());
 assert.equal(out.subjects[0].score,81);assert.equal(out.subjects[0].rate,.81);
 assert.deepEqual(out.totals,{score:81,maxScore:100,published:1});
 assert.equal(out.reportUrl,'/own-report');assert.deepEqual(a,before);
});
test('student zero and existing grades remain authoritative',()=>{
 const a=own();a.subjects[0].score=0;a.subjects[0].level='B';
 const out=merge(a,teacher());assert.equal(out.subjects[0].score,0);assert.equal(out.subjects[0].level,'B');
 assert.equal(out.totals.score,0);
});
test('each principal, exam, namespace, and session mismatch rejects supplementation',()=>{
 for(const key of Object.keys(scope)) {const a=own(),b=teacher();b.scope[key]='different';assert.equal(merge(a,b),a);}
 const a=own(),b=teacher();delete b.scope.userId;b.scope.name='same-name';assert.equal(merge(a,b),a);
});
test('Yue numeric ID equality cannot establish TQWEB identity',()=>{
 const a=own(),b=teacher();b.scope.namespace='yue';assert.equal(merge(a,b),a);
});
test('teacher errors, duplicate paper IDs, and malformed scopes preserve own results',()=>{
 for(const b of [null,{success:false}, {...teacher(),subjects:[...teacher().subjects,...teacher().subjects]}]){
  const a=own();assert.equal(merge(a,b),a);
 }
});
test('incompatible denominators and invalid numeric scores are not merged',()=>{
 for(const value of [-1,NaN,Infinity,101,'81']) {const b=teacher();b.subjects[0].score=value;assert.equal(merge(own(),b).subjects[0].score,null);}
 const b=teacher();b.subjects[0].maxScore=150;assert.equal(merge(own(),b).subjects[0].score,null);
});
test('new authorized canonical paper is whitelisted; raw teacher fields never spread',()=>{
 const b=teacher();b.subjects.push({id:'5',name:'Other',score:0,maxScore:100,password:'CANARY',roster:['CANARY'],cookies:'CANARY'});
 b.token='CANARY';const out=merge(own(),b);assert.equal(out.subjects.length,2);assert.equal(out.totals.published,2);
 assert.doesNotMatch(JSON.stringify(out),/CANARY/);
});
const pages=()=>[{order:1,url:'/api/student/asset?ticket=synthetic',downloadUrl:'/api/student/asset?ticket=synthetic&download=1',token:'CANARY'}];
test('whole missing image set accepts only portal links and strips extra fields',()=>{
 const b=teacher();b.subjects[0].pages=pages();const out=merge(own(),b);
 assert.equal(out.subjects[0].pages.length,1);assert.doesNotMatch(JSON.stringify(out),/CANARY/);
});
test('source links, malformed page sequences, and wrong capability routes are rejected',()=>{
 for(const change of [p=>p[0].url='https://source.invalid/image?token=CANARY',p=>p[0].order=2,p=>p[0].url='/api/student/exam?ticket=synthetic']){
  const b=teacher();b.subjects[0].pages=pages();change(b.subjects[0].pages);assert.equal(merge(own(),b).subjects[0].pages,undefined);
 }
});
test('a student partial image set is not mixed with unproven teacher page numbering',()=>{
 const a=own();a.subjects[0].pages=[{order:1,url:'own'}];const b=teacher();b.subjects[0].pages=pages();
 assert.deepEqual(merge(a,b).subjects[0].pages,a.subjects[0].pages);
});
test('only portal subject capabilities can fill missing reports',()=>{
 const b=teacher();b.subjects[0].reportUrl='https://source.invalid/report';assert.equal(merge(own(),b).subjects[0].reportUrl,undefined);
 b.subjects[0].reportUrl='/api/student/subject?ticket=synthetic';assert.equal(merge(own(),b).subjects[0].reportUrl,b.subjects[0].reportUrl);
});
