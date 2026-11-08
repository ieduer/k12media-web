import { collectArchive, ownPath } from './student-download.mjs';
const $ = id => document.getElementById(id);
const messages = {
  source_credentials_rejected: '姓名或密码不正确。', source_account_locked: '账号已锁定，请先在星立方解锁。',
  source_login_not_accepted: '星立方未接受本次登录，请核对账号。', source_rate_limited: '星立方暂时限制了登录，请稍后再试。', login_cooldown: '请稍后再试。',
  session_expired: '登录已过期，请重新登录。', source_transport_failed: '暂时无法连接星立方，请稍后再试。',
  source_login_outcome_unknown: '登录结果尚未确认，请勿连续提交。', source_catalog_unavailable: '暂时无法读取考试记录，请稍后再试。',
  service_unavailable: '服务暂时不可用，请稍后再试。', verification_storage_unavailable: '服务暂时不可用，请稍后再试。'
};
let busy = false, selection = '', credentials = null, selectedExam = null, examData = null;
let scoreMode = 'rate', loadSequence = 0;
let catalogue = [], historyGeneration = 0, historyRunning = false, exporting = false, exportAbort, savedZip, imageSequence = 0;
const gradeCache = new Map(), gradePending = new Map(), cardViews = new Map();
let requestQueue = Promise.resolve();
// Source exam selection is session state. Serialize document/data reads.
function sourceRequest(path, { signal } = {}) {
  const run = requestQueue.catch(() => {}).then(async () => {
    signal?.throwIfAborted();
    let response;
    for(let attempt=0;attempt<2;attempt++) {
      response = await fetch(ownPath(path), { credentials:'same-origin', cache:'no-store', redirect:'error', signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(125000)]) : AbortSignal.timeout(125000) });
      if(response.ok)break;
      let code=response.status===401?'session_expired':'source_unavailable';
      if(response.headers.get('content-type')?.includes('json')){try{code=(await response.json()).code||code;}catch{}}else await response.body?.cancel();
      // Only a failed image GET is replayed; authentication and exam selection
      // never retry here. A second failure is retained in the export manifest.
      if(attempt===0&&path.startsWith('/api/student/asset?')&&(/^source_asset_http_50[0234]$/.test(code)||['source_asset_timeout','source_asset_transport_failed'].includes(code)))continue;
      throw Object.assign(new Error(code),{code});
    }
    return response;
  });
  requestQueue = run.then(() => {}, () => {}); return run;
}
async function getGrades(exam, signal) {
  if (gradeCache.has(exam.url)) return gradeCache.get(exam.url);
  if (gradePending.has(exam.url)) return gradePending.get(exam.url);
  const pending=(async()=>{const data = await (await sourceRequest(exam.url.replace('/exam?','/exam-data?'), { signal })).json();
    gradeCache.set(exam.url, data); updateCard(exam, data); return data;})();
  gradePending.set(exam.url,pending);
  try{return await pending;}finally{gradePending.delete(exam.url);}
}
let retryAt = 0, cooldownTimer;
function updateSubmit() {
  clearTimeout(cooldownTimer);
  const seconds = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
  $('submit').disabled = busy || seconds > 0;
  $('submit').textContent = busy ? '正在登录…' : seconds ? `${seconds} 秒后可重试` : '登录';
  if (seconds) cooldownTimer = setTimeout(updateSubmit, 1000);
}
const number = value => Number.isFinite(value) ? new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value) : '—';
const percent = value => Number.isFinite(value) ? number(value * 100) + '%' : '—';
function showError(code) { $('login-error').textContent = messages[code] || '暂时无法完成登录，请稍后再试。'; $('login-error').hidden = false; }
function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
function showScores() {
  ++imageSequence; $('score-view').hidden = false; $('document-view').hidden = true; $('answers-view').hidden = true;
  $('tab-scores').setAttribute('aria-selected', 'true'); $('tab-report').setAttribute('aria-selected', 'false'); $('tab-answers').setAttribute('aria-selected', 'false');
}
async function showDocument(url, title, full = false) {
  ++imageSequence;
  const run=requestQueue.catch(()=>{}).then(async()=>{
    if(!selectedExam)return;
    $('score-view').hidden = true; $('document-view').hidden = false; $('answers-view').hidden = true; $('document-title').textContent = title;
    $('document-open').href = ownPath(url);
    $('tab-scores').setAttribute('aria-selected', 'false'); $('tab-report').setAttribute('aria-selected', String(full)); $('tab-answers').setAttribute('aria-selected', 'false');
    await new Promise(resolve=>{const frame=$('report');let timer;const done=()=>{clearTimeout(timer);frame.removeEventListener('load',done);resolve();};frame.addEventListener('load',done,{once:true});timer=setTimeout(done,125000);frame.src=url;});
  });
  requestQueue=run.then(()=>{},()=>{});return run;
}
function drawBars() {
  if (!examData) return;
  $('score-bars').replaceChildren();
  const ceiling = Math.max(1, ...examData.subjects.map(s => s.maxScore || 0));
  for (const subject of examData.subjects) {
    const row = node('div', undefined, 'score-bar-row');
    const label = node('span', subject.name, 'score-subject');
    const track = node('div', undefined, 'score-track');
    const value = scoreMode === 'rate' ? subject.rate : subject.score === null ? null : subject.score / ceiling;
    const fill = node('span', undefined, 'score-fill'); fill.style.width = (value === null ? 0 : Math.max(0, Math.min(1, value)) * 100) + '%';
    track.append(fill); track.setAttribute('role', 'meter'); track.setAttribute('aria-label', subject.name);
    track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', scoreMode === 'rate' ? '100' : String(ceiling));
    if (value !== null) track.setAttribute('aria-valuenow', String(scoreMode === 'rate' ? subject.rate * 100 : subject.score));
    track.setAttribute('aria-valuetext', subject.score === null ? '未公布' : `${number(subject.score)} / ${number(subject.maxScore)}，${percent(subject.rate)}`);
    const detail = node('span', subject.score === null ? '未公布' : scoreMode === 'rate' ? percent(subject.rate) : `${number(subject.score)} / ${number(subject.maxScore)}`, 'score-value');
    row.append(label, track, detail); $('score-bars').append(row);
  }
  $('mode-rate').setAttribute('aria-pressed', String(scoreMode === 'rate')); $('mode-score').setAttribute('aria-pressed', String(scoreMode === 'score'));
}
function renderScores(data) {
  examData = data;
  const total = data.totals;
  $('total-score').textContent = total.published ? number(total.score) : '—';
  $('total-max').textContent = total.published ? ' / ' + number(total.maxScore) : '';
  $('total-rate').textContent = total.maxScore ? percent(total.score / total.maxScore) : '—';
  $('subject-count').textContent = data.subjects.length;
  $('grade-rows').replaceChildren();
  for (const subject of data.subjects) {
    const tr = node('tr');
    tr.append(node('th', subject.name), node('td', subject.score === null ? '未公布' : `${number(subject.score)} / ${number(subject.maxScore)}`), node('td', percent(subject.rate)), node('td', subject.level || '—'));
    const actions = node('td', undefined, 'grade-actions');
    for (const [label, action] of [['学科报告', () => showDocument(subject.reportUrl, subject.name + ' · 学科报告')], ['答卷', () => showAnswers([subject])]]) {
      const button = node('button', label); button.type = 'button'; button.addEventListener('click', action); actions.append(button);
    }
    tr.append(actions); $('grade-rows').append(tr);
  }
  drawBars(); $('score-loading').hidden = true; $('score-content').hidden = false;
}
async function loadScores() {
  const sequence = ++loadSequence;
  $('score-content').hidden = true; $('score-error').hidden = true; $('score-loading').hidden = false; examData = null;
  try {
    const data = await getGrades(selectedExam); if (sequence !== loadSequence) return;
    renderScores(data);
  } catch (error) {
    if (sequence !== loadSequence) return;
    $('score-loading').hidden = true; $('score-error').hidden = false;
    $('score-error-text').textContent = messages[error.code] || '暂时无法读取这次考试，请稍后再试。';
  }
}
function openExam(exam) {
  selectedExam = exam; $('exam-list').hidden = true; $('report-view').hidden = false; $('report-title').textContent = exam.title;
  showScores(); loadScores(); window.scrollTo({ top: 0, behavior: 'auto' });
}
function render(data) {
  credentials = null; selection = ''; $('password').value = ''; $('login-view').hidden = true; $('portal-view').hidden = false; $('student-name').textContent = data.name || '';
  $('exam-list').hidden = false; $('report-view').hidden = true; $('exam-count').textContent = data.exams.length + ' 场'; $('empty').hidden = !!data.exams.length; $('exams').replaceChildren();
  catalogue = data.exams; ++historyGeneration; gradeCache.clear(); cardViews.clear();
  for (const [i, exam] of catalogue.entries()) {
    const card = node('article', undefined, 'exam-card'), heading = node('div', undefined, 'exam-card-heading');
    heading.append(node('span', String(i + 1).padStart(2,'0'), 'exam-number'), node('h3', exam.title));
    const summary = node('div','等待读取成绩…','exam-inline-scores'), actions = node('div',undefined,'exam-card-actions');
    const open = node('button','报告与答卷 →','exam-open'); open.type='button'; open.addEventListener('click',()=>openExam(exam));
    const download = node('button','本次打包下载','exam-open'); download.type='button'; download.addEventListener('click',()=>downloadExams([exam]));
    actions.append(open,download); card.append(heading,summary,actions); $('exams').append(card); cardViews.set(exam.url,summary);
  }
  loadHistory();
}
function updateCard(exam, data) {
  const target = cardViews.get(exam.url); if (!target) return;
  target.replaceChildren();
  const total = node('div',undefined,'exam-inline-total'); total.append(node('strong',data.totals.published ? number(data.totals.score) : '—'),node('span',data.totals.published ? ' / '+number(data.totals.maxScore) : '尚未公布'));
  target.append(total); const grid=node('div',undefined,'inline-subjects');
  for (const s of data.subjects) {
    const row=node('div',undefined,'inline-subject'), values=node('div',undefined,'inline-subject-values');
    values.append(node('span',s.name),node('strong',s.score===null?'未公布':number(s.score)),node('small',s.maxScore===null?'':' / '+number(s.maxScore)),node('span',percent(s.rate),'inline-rate'));
    const track=node('div',undefined,'inline-track'),fill=node('span'); fill.style.width=(s.rate===null?0:Math.min(100,Math.max(0,s.rate*100)))+'%';track.append(fill);row.append(values,track);grid.append(row);
  }
  if(!data.subjects.length) grid.append(node('p','源站暂未提供科目成绩。'));
  target.append(grid);
}
async function loadHistory() {
  if(historyRunning) return; historyRunning=true; const generation=historyGeneration;
  try {
    for(const exam of catalogue) {
      if(generation!==historyGeneration||selectedExam||exporting) break;
      if(gradeCache.has(exam.url)) continue;
      const target=cardViews.get(exam.url);target.textContent='正在读取成绩…';
      try { await getGrades(exam); }
      catch(error) {
        target.replaceChildren(node('p',messages[error.code]||'这次成绩暂未读取。'));
        const retry=node('button','重新读取','exam-open');retry.type='button';retry.addEventListener('click',async()=>{retry.disabled=true;try{await getGrades(exam);}catch{retry.disabled=false;}});target.append(retry);
        if(['session_expired','source_rate_limited'].includes(error.code)) break;
      }
      $('history-progress').textContent=`已读取 ${gradeCache.size} / ${catalogue.length} 场`;
    }
  } finally { historyRunning=false; }
}
async function showAnswers(subjects) {
  const sequence=++imageSequence;
  $('score-view').hidden=true; $('document-view').hidden=true; $('answers-view').hidden=false;
  for(const id of ['scores','report','answers'])$('tab-'+id).setAttribute('aria-selected',String(id==='answers'));
  $('answer-pages').replaceChildren(); $('answers-loading').textContent='正在读取全部答卷…';
  try {
    if(!subjects) subjects=(examData||await getGrades(selectedExam)).subjects;
    for(const subject of subjects) {
      if(sequence!==imageSequence) return;
      const section=node('section',undefined,'answer-subject');section.append(node('h3',subject.name));$('answer-pages').append(section);
      try {
        const data=await (await sourceRequest(subject.imagesDataUrl||subject.imagesUrl.replace('/subject-images?','/subject-images-data?'))).json();
        if(sequence!==imageSequence) return;
        const gallery=node('div',undefined,'answer-gallery');section.append(gallery);
        for(const page of data.pages) {
          const figure=node('figure'),button=node('button',undefined,'answer-preview'),img=node('img');button.type='button';img.src=page.url;img.alt=`${subject.name} · 第 ${page.order} 页`;img.loading='lazy';img.decoding='async';button.append(img);
          button.addEventListener('click',()=>{$('preview-image').style.width='100%';$('preview-zoom').textContent='放大';$('preview-image').src=page.url;$('preview-image').alt=img.alt;$('preview-download').href=page.downloadUrl;$('image-preview').showModal();});
          img.addEventListener('error',()=>{button.replaceChildren(node('span','图片未能加载'));const retry=node('button','重新读取图片','btn');retry.type='button';retry.addEventListener('click',()=>{button.replaceChildren(img);img.src=page.url;retry.remove();});figure.append(retry);},{once:true});
          const caption=node('figcaption'),link=node('a','下载高清原图');link.href=page.downloadUrl;link.download=`${subject.name}-${page.order}`;caption.append(node('span',`第 ${page.order} 页`),link);figure.append(button,caption);gallery.append(figure);
        }
      } catch(error) { section.append(node('p',error.code==='source_images_unavailable'?'源站暂未提供答卷。':messages[error.code]||'这份答卷暂时无法读取。','msg-box'));if(error.code==='session_expired')break; }
    }
  } finally { if(sequence===imageSequence)$('answers-loading').textContent=''; }
}
async function downloadExams(exams) {
  if(exporting) return; exporting=true;exportAbort=new AbortController();$('download-panel').hidden=false;$('download-cancel').hidden=false;$('download-save').hidden=true;
  if(savedZip){URL.revokeObjectURL(savedZip);savedZip=null;}
  $('download-all').disabled=true;$('download-exam').disabled=true;
  try {
    const {blob,manifest}=await collectArchive(exams,{getGrades,request:sourceRequest,signal:exportAbort.signal,onProgress:p=>{$('download-progress').textContent=`${p.exam} / ${p.exams} · ${p.stage} · ${(p.bytes/1048576).toFixed(1)} MB`;}});
    savedZip=URL.createObjectURL(blob);$('download-save').href=savedZip;$('download-save').download=exams.length===1?'exam-ai.zip':'all-exams-ai.zip';$('download-save').hidden=false;
    $('download-progress').textContent=`${manifest.exams.length} 场 · ${(blob.size/1048576).toFixed(1)} MB`+(manifest.complete?'':' · 部分资料未取得，详见清单');
    $('download-save').click();
  } catch(error) { $('download-progress').textContent=exportAbort.signal.aborted?'下载已取消。':messages[error.code]||'打包未完成，请重试。'; }
  finally {exporting=false;$('download-cancel').hidden=true;$('download-all').disabled=false;$('download-exam').disabled=false;if(!selectedExam)loadHistory();}
}
$('reveal').addEventListener('click', () => { const show = $('password').type === 'password'; $('password').type = show ? 'text' : 'password'; $('reveal').textContent = show ? '隐藏' : '显示'; $('reveal').setAttribute('aria-pressed', String(show)); });
$('student-login').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || retryAt > Date.now() || !$('student-login').reportValidity()) return;
  busy = true; $('submit').disabled = true; $('submit').textContent = '正在登录…'; $('login-error').hidden = true;
  let payload = selection ? { ...credentials, selection, choice: Number($('choice').value) } : { username: $('username').value.trim(), password: $('password').value };
  try {
    const response = await fetch('/api/student/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(155000) });
    const data = await response.json();
    if (data.state === 'selection_required') {
      selection = data.selection; credentials = { username: payload.username, password: payload.password }; $('choice-field').hidden = false; $('choice').replaceChildren();
      for (const item of data.choices) { const option = node('option', item.label); option.value = item.index; $('choice').append(option); } return;
    }
    if (!response.ok || !data.authenticated) {
      if (data.code === 'login_cooldown' && Number.isFinite(data.retryAfter)) retryAt = Date.now() + Math.min(60, data.retryAfter) * 1000;
      showError(data.code); credentials = null; selection = ''; $('password').value = ''; return;
    }
    render(data);
  } catch { showError('source_login_outcome_unknown'); credentials = null; selection = ''; $('password').value = ''; }
  finally { payload = null; busy = false; updateSubmit(); }
});
$('logout').addEventListener('click', async () => { await fetch('/api/student/logout', { method: 'POST', credentials: 'same-origin' }); location.replace('/'); });
$('back').addEventListener('click', () => { ++loadSequence; ++imageSequence; $('report').src = 'about:blank'; $('report-view').hidden = true; $('exam-list').hidden = false; selectedExam = null; examData = null; loadHistory(); });
$('tab-scores').addEventListener('click', showScores); $('report-back').addEventListener('click', showScores);
$('tab-report').addEventListener('click', () => { if (selectedExam) showDocument(examData?.reportUrl || selectedExam.url, '完整报告', true); });
$('mode-rate').addEventListener('click', () => { scoreMode = 'rate'; drawBars(); });
$('mode-score').addEventListener('click', () => { scoreMode = 'score'; drawBars(); });
$('score-retry').addEventListener('click', loadScores);
for(const mode of ['embedded','list'])$('view-'+mode).addEventListener('click',()=>{$('exams').classList.toggle('list-view',mode==='list');for(const m of ['embedded','list'])$('view-'+m).setAttribute('aria-pressed',String(m===mode));});
$('tab-answers').addEventListener('click',()=>showAnswers());
$('download-all').addEventListener('click',()=>downloadExams(catalogue));
$('download-exam').addEventListener('click',()=>{if(selectedExam)downloadExams([selectedExam]);});
$('download-cancel').addEventListener('click',()=>exportAbort?.abort());
$('preview-zoom').addEventListener('click',()=>{const img=$('preview-image'),zoom=img.style.width==='100%';img.style.width=zoom?Math.max(img.naturalWidth,1200)+'px':'100%';$('preview-zoom').textContent=zoom?'适应':'放大';});
$('preview-close').addEventListener('click',()=>{$('image-preview').close();$('preview-image').removeAttribute('src');});
function fitReport() {
  try {const frame=$('report'),doc=frame.contentDocument;if(!doc?.body||!frame.clientWidth)return;doc.body.style.zoom='1';const width=Math.max(doc.body.scrollWidth,doc.documentElement.scrollWidth);doc.body.style.zoom=String(Math.min(1,(frame.clientWidth-2)/width));}catch{}
}
$('report').addEventListener('load',()=>{fitReport();try{$('report').contentDocument?.addEventListener('click',event=>{const a=event.target.closest?.('a[href]');if(a?.getAttribute('href')?.startsWith('/api/student/subject?')){event.preventDefault();showDocument(a.getAttribute('href'),a.textContent.trim()||'学科报告');}});}catch{}});new ResizeObserver(fitReport).observe($('report'));
addEventListener('pagehide',()=>{++historyGeneration;++imageSequence;exportAbort?.abort();if(savedZip)URL.revokeObjectURL(savedZip);gradeCache.clear();});
addEventListener('pagehide', () => { credentials = null; selection = ''; $('password').value = ''; });
fetch('/api/student/me', { credentials: 'same-origin', cache: 'no-store' }).then(async response => {
  const data = await response.json(); if (response.ok) render(data); else if (response.status !== 401) showError(data.code);
}).catch(() => {});
