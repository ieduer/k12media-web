import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { crc32, safeName, zipBlob, readImage, exportExams } from '../../frontend/js/student-export.mjs';

const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64'));
const handle = '/api/student/images/abcdefghijklmnop';
const response = () => new Response(png, { headers: { 'content-type': 'image/png' } });
function exam(id = 'exam-1') { return { id, name: '期中考试', date: '2026-11-04', status: 'complete', subjects: [
  { id: 'chinese', name: '语文', score: 0, fullScore: 150, status: 'complete', expectedPages: 2,
    pages: [{ order: 1, downloadPath: handle }, { order: 2, downloadPath: handle }] }
] }; }
async function unzip(blob) {
  const result = spawnSync('/Users/ylsuen/.venv/bin/python', ['-c', 'import sys,io,zipfile,json,base64; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; print(json.dumps({i.filename:base64.b64encode(z.read(i)).decode() for i in z.infolist()}))'], { input: Buffer.from(await blob.arrayBuffer()) });
  assert.equal(result.status, 0, result.stderr.toString());
  return Object.fromEntries(Object.entries(JSON.parse(result.stdout)).map(([name,data])=>[name,Buffer.from(data,'base64')]));
}
test('ZIP is independently readable, preserves UTF-8 paths and exact image bytes', async () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const files = await unzip(zipBlob([{ name: '考试/语文/page-0001.png', bytes: png }]));
  assert.deepEqual(files['考试/语文/page-0001.png'], Buffer.from(png));
  assert.throws(()=>zipBlob([{name:'../unsafe',bytes:png}]),/invalid_zip_entry/);
  assert.throws(()=>zipBlob([{name:'same',bytes:png},{name:'same',bytes:png}]),/invalid_zip_entry/);
  assert.ok(!safeName('../../恶意\\路径').includes('..'));
});
test('download only follows opaque application handles; no credentials go to arbitrary URLs', async () => {
  let calls = 0;
  for (const path of ['https://evil.invalid/x', '//evil.invalid/x', '/api/proxy-image?url=x', '/api/student/images/../../x']) {
    await assert.rejects(readImage(path,{fetcher:()=>{calls++;}}),/invalid_image_handle/);
  }
  assert.equal(calls,0);
  await readImage(handle,{fetcher:(url,init)=>{assert.equal(init.credentials,'same-origin');assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');return response();}});
});
test('transient download errors retry once; rejected sessions never retry', async () => {
  let n = 0;
  await readImage(handle,{fetcher:()=>++n===1?new Response('',{status:503}):response()}); assert.equal(n,2);
  n=0; await assert.rejects(readImage(handle,{fetcher:()=>{n++;return new Response('',{status:401});}}),/session_rejected/);assert.equal(n,1);
  n=0; await assert.rejects(readImage(handle,{fetcher:()=>{n++;throw Error('private source URL');}}),/network_failed/);assert.equal(n,2);
});
test('HTML masquerading as an image and oversized streaming data fail', async () => {
  await assert.rejects(readImage(handle,{fetcher:()=>new Response('<html>private</html>',{headers:{'content-type':'image/png'}})}),/invalid_image/);
  await assert.rejects(readImage(handle,{maxBytes:10,fetcher:response}),/image_too_large/);
});
test('multi-exam package preserves zero scores, subject/page identity, CRCs and excludes handles', async () => {
  const saved=[];
  const manifest=await exportExams([exam('one'),exam('two')],{fetcher:response,saveVolume:(blob,name)=>saved.push({blob,name})});
  assert.equal(manifest.complete,true);assert.equal(manifest.exams.length,2);
  const images=await unzip(saved[0].blob);assert.equal(Object.keys(images).filter(x=>x.endsWith('.png')).length,4);
  const index=await unzip(saved.at(-1).blob);const stored=JSON.parse(index['manifest.json']);
  assert.equal(stored.exams[0].subjects[0].score,0);assert.ok(!index['manifest.json'].includes(Buffer.from(handle)));
  assert.match(index['scores.csv'].toString(),/"0","150"/);
});
test('missing or unknown expected pages cannot be called complete', async () => {
  for (const count of [null,3]) {
    const x=exam();x.subjects[0].expectedPages=count;
    const m=await exportExams([x],{fetcher:response,saveVolume:()=>{}});assert.equal(m.complete,false);
  }
  const x=exam();x.subjects[0].pages[1].order=3;
  const m=await exportExams([x],{fetcher:response,saveVolume:()=>{}});assert.equal(m.complete,false);
});
test('auth rejection stops remaining requests and remains explicit in the index', async () => {
  let n=0;const saved=[];
  const m=await exportExams([exam(),exam('second')],{fetcher:()=>{n++;return new Response('',{status:403});},saveVolume:(blob,name)=>saved.push({blob,name})});
  assert.equal(n,1);assert.equal(m.complete,false);assert.equal(m.interrupted,true);
  assert.equal(m.exams[0].subjects[0].pages[1].status,'not_attempted');
  const index=await unzip(saved.at(-1).blob);assert.match(index['manifest.json'].toString(),/session_rejected/);
});
test('failed save aborts export and repeated page orders are rejected', async () => {
  await assert.rejects(exportExams([exam()],{fetcher:response,saveVolume:()=>{throw Error('save_cancelled');}}),/save_cancelled/);
  const x=exam();x.subjects[0].pages[1].order=1;
  await assert.rejects(exportExams([x],{fetcher:response,saveVolume:()=>{}}),/invalid_page_order/);
});
test('all history completeness requires source pagination evidence',async()=>{
  const m=await exportExams([exam()],{scope:'all-history',fetcher:response,saveVolume:()=>{}});
  assert.equal(m.complete,false);assert.equal(m.catalogueComplete,false);assert.equal(m.requestedExamCount,1);
});
test('bounded volumes retain every page and cancellation still saves an honest index',async()=>{
  const saved=[];const m=await exportExams([exam()],{volumeBytes:3000,fetcher:response,saveVolume:(blob,name)=>saved.push({blob,name})});
  assert.equal(m.volumes.length,2);assert.equal(m.complete,true);
  for(const volume of saved.slice(0,-1))assert.equal(Object.keys(await unzip(volume.blob)).filter(x=>x.endsWith('.png')).length,1);
  const cancelled=[];const controller=new AbortController();controller.abort();
  const result=await exportExams([exam()],{signal:controller.signal,fetcher:()=>assert.fail('cancelled download'),saveVolume:(blob,name)=>cancelled.push({blob,name})});
  assert.equal(result.interrupted,true);assert.equal(result.complete,false);assert.equal(cancelled.length,1);
});
