import { allowedAsset, parseSubjectCall, extractImageForm } from './student-portal-source.js';
import { StudentSourceError } from './student-source.js';
export const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tags=new Set('html head body title div span p br hr section article main header footer nav h1 h2 h3 h4 h5 h6 table thead tbody tfoot tr th td caption col colgroup ul ol li dl dt dd strong b em i u s small sub sup a img link'.split(' '));
const attrs=new Set(['class','id','title','alt','colspan','rowspan','width','height','align','valign','role','scope']);
export const reportHeaders={
 'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
 'Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-same-origin allow-downloads"
};
export function cleanCss(css){return css.replace(/@import[^;]*(?:;|$)/gi,'').replace(/url\([^)]*\)/gi,'none').replace(/expression\([^)]*\)/gi,'').replace(/(?:behavior|-moz-binding)\s*:[^;}]+[;}]?/gi,'');}
export async function renderReport(html,{session,examId,paperId,capability}){
 let count=0;
 const make=async(kind,data)=>{if(++count>180)throw new StudentSourceError('source_response_too_large');return '/api/student/'+kind+'?ticket='+await capability(kind,{examId,...data});};
 let imageLink='';if(paperId){const form=await extractImageForm(html,examId,paperId);if(form)imageLink=await make('images',{fields:form});}
 const rw=new HTMLRewriter().on('*',{async element(e){
   const tag=e.tagName.toLowerCase();const original=Object.fromEntries(e.attributes);
   if(!tags.has(tag)){if(['script','style','iframe','object','embed','svg','math','template','noscript'].includes(tag))e.remove();else e.removeAndKeepContent();return;}
   // Production HTMLRewriter invalidates its native iterator on mutation.
   for(const name of Object.keys(original))e.removeAttribute(name);
   for(const [k,v] of Object.entries(original))if(attrs.has(k)&&v.length<512)e.setAttribute(k,v);
   if(original.style&&original.style.length<2048&&!/[\\@<>]|url|expression|behavior|binding|image-set/i.test(original.style))e.setAttribute('style',original.style);
   if(tag==='head')e.append('<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/report.css">',{html:true});
   if(tag==='body')e.setAttribute('data-paper-report',paperId?'subject':'exam');
   if(tag==='body'&&imageLink)e.prepend('<nav class="paper-toolbar"><a href="'+escapeHtml(imageLink)+'">查看我的答卷</a></nav>',{html:true});
   if(tag==='a'){
     const fields=parseSubjectCall(original.href,examId,session.schoolId);
     if(fields)e.setAttribute('href',await make('subject',{fields}));
     else if(/^#[\w-]+$/.test(original.href||''))e.setAttribute('href',original.href);
     else if(imageLink&&/findStudentImgJs/.test((original.href||'')+' '+(original.onclick||'')))e.setAttribute('href',imageLink);
   }
   if(tag==='img'){
     const asset=allowedAsset(original.src||'',examId);
     if(!asset||asset.type!=='image'){e.remove();return;}
     e.setAttribute('src',await make('asset',asset));e.setAttribute('loading','lazy');e.setAttribute('referrerpolicy','no-referrer');
   }
   if(tag==='link'){
     const asset=allowedAsset(original.href||'',examId);
     if(original.rel!=='stylesheet'||asset?.type!=='css'){e.remove();return;}
     e.setAttribute('rel','stylesheet');e.setAttribute('href',await make('asset',asset));
   }
 }});
 const output=await rw.transform(new Response(html)).text();
 if(output.length<100)throw new StudentSourceError('source_report_unavailable');
 return new Response(output,{headers:reportHeaders});
}
