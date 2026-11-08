import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from '../worker/node_modules/esbuild/lib/main.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [outArg, until] = process.argv.slice(2);
if (!outArg || !until || !Number.isFinite(Date.parse(until))) throw Error('usage: node scripts/build-student-preview.mjs OUTPUT_DIRECTORY DEADLINE_ISO');
if (Date.parse(until) <= Date.now() || Date.parse(until) > Date.now() + 7 * 86400000) throw Error('preview deadline must be within seven days');
const out = resolve(outArg);
if (out === root || !/^\/private\/tmp\/cf-task-paper-(?:student-|mark-style-)/.test(out)) throw Error('use registered task preview build directory');
const source = execFileSync('git', ['rev-parse','HEAD'], {cwd:root,encoding:'utf8'}).trim();
await mkdir(out,{recursive:true});
const assets = {'index.html':'frontend/student.html','student.html':'frontend/student.html','css/student.css':'frontend/css/student.css','js/student-login.mjs':'frontend/js/student-login.mjs',
  'css/mark-style.css':'frontend/css/mark-style.css','css/data/img/bg.webp':'frontend/css/data/img/bg.webp','css/data/fonts/HuWenMingChaoTi.woff2':'frontend/css/data/fonts/HuWenMingChaoTi.woff2'};
for (const [target, from] of Object.entries(assets)) { await mkdir(dirname(resolve(out,target)),{recursive:true}); await copyFile(resolve(root,from),resolve(out,target)); }
await build({ stdin:{contents:`import app from './worker/src/student-preview.js';export default {fetch(request,env){return app.fetch(request,{...env,STUDENT_LOGIN_TEST_ENABLED:'true',STUDENT_LOGIN_TEST_UNTIL:${JSON.stringify(until)}})}}`,resolveDir:root,sourcefile:'student-preview-entry.js'},
  outfile:resolve(out,'_worker.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,sourcemap:false });
await writeFile(resolve(out,'_routes.json'), JSON.stringify({version:1,include:['/api/*'],exclude:[]}));
await writeFile(resolve(out,'_headers'),`/*
  Cache-Control: no-store
  X-Robots-Tag: noindex, nofollow
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
`);
await writeFile(resolve(out,'404.html'),'<meta charset="utf-8"><title>页面不存在</title><p>页面不存在。<a href="/student.html">返回学生登录</a></p>');
const files = [...Object.keys(assets),'_worker.js','_routes.json','_headers','404.html'];
const hashes = {};
for(const file of files) hashes[file]=createHash('sha256').update(await readFile(resolve(out,file))).digest('hex');
await writeFile(resolve(out,'__preview.json'),JSON.stringify({source,channel:'student-login-test',until,files:hashes},null,2)+'\n');
console.log(JSON.stringify({source,out,until,files:files.length+1,worker_sha256:hashes['_worker.js']}));
