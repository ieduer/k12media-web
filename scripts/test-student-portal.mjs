import {build} from '../worker/node_modules/esbuild/lib/main.js';
import {Miniflare} from '../worker/node_modules/miniflare/dist/src/index.js';
const {outputFiles}=await build({entryPoints:['worker/tests/student-portal-fixture.js'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
const mf=new Miniflare({modules:true,script:outputFiles[0].text,compatibilityDate:'2026-01-22'});
try{const r=await mf.dispatchFetch('https://fixture.invalid/');const text=await r.text();console.log(text);if(!r.ok)process.exitCode=1;}finally{await mf.dispose();}
