import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoginLimiter} from '../src/student-login-limit.js';
test('shared school network permits different students while one account stays bounded', async()=>{
 let now=0; const limit=createLoginLimiter({now:()=>now});
 const req=new Request('https://paper.invalid',{headers:{'CF-Connecting-IP':'192.0.2.1'}});
 assert.equal((await limit(req,'student-one')).allowed,true);
 assert.deepEqual(await limit(req,' student-one '),{allowed:false,retryAfter:60});
 assert.equal((await limit(req,'student-two')).allowed,true);
 for(let i=2;i<20;i++)assert.equal((await limit(req,'student-'+i)).allowed,true);
 assert.deepEqual(await limit(req,'over-burst'),{allowed:false,retryAfter:10});
 now=10001;assert.equal((await limit(req,'over-burst')).allowed,true);
 assert.equal((await limit(req,'student-one')).allowed,false);
 now=60001;assert.equal((await limit(req,'student-one')).allowed,true);
});
