const $ = id => document.getElementById(id);
const messages = {
  source_credentials_rejected: '姓名或密码不正确。', source_account_locked: '账号已锁定，请先在星立方解锁。',
  source_login_not_accepted: '星立方未接受本次登录，请核对账号。', source_rate_limited: '星立方暂时限制了登录，请稍后再试。', login_cooldown: '请稍后再试。',
  session_expired: '登录已过期，请重新登录。', source_transport_failed: '暂时无法连接星立方，请稍后再试。',
  source_login_outcome_unknown: '登录结果尚未确认，请勿连续提交。', source_catalog_unavailable: '暂时无法读取考试记录，请稍后再试。',
  service_unavailable: '服务暂时不可用，请稍后再试。'
};
let busy = false, selection = '', credentials = null, selectedExam = null, examData = null;
let scoreMode = 'rate', loadSequence = 0;
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
  $('score-view').hidden = false; $('document-view').hidden = true;
  $('tab-scores').setAttribute('aria-selected', 'true'); $('tab-report').setAttribute('aria-selected', 'false');
}
function showDocument(url, title, full = false) {
  $('score-view').hidden = true; $('document-view').hidden = false; $('document-title').textContent = title;
  $('report').src = url; $('document-open').href = url;
  $('tab-scores').setAttribute('aria-selected', 'false'); $('tab-report').setAttribute('aria-selected', String(full));
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
    for (const [label, url] of [['学科报告', subject.reportUrl], ['答卷', subject.imagesUrl]]) {
      const button = node('button', label); button.type = 'button'; button.addEventListener('click', () => showDocument(url, subject.name + ' · ' + label)); actions.append(button);
    }
    tr.append(actions); $('grade-rows').append(tr);
  }
  drawBars(); $('score-loading').hidden = true; $('score-content').hidden = false;
}
async function loadScores() {
  const sequence = ++loadSequence;
  $('score-content').hidden = true; $('score-error').hidden = true; $('score-loading').hidden = false; examData = null;
  try {
    const response = await fetch(selectedExam.url.replace('/exam?', '/exam-data?'), { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(125000) });
    const data = await response.json(); if (sequence !== loadSequence) return;
    if (!response.ok) throw Object.assign(new Error(), { code: data.code });
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
  for (const [i, exam] of data.exams.entries()) {
    const card = node('button', undefined, 'exam-card'); card.type = 'button';
    card.append(node('span', String(i + 1).padStart(2, '0'), 'exam-number'), node('h3', exam.title), node('span', '查看成绩与报告 →', 'exam-open'));
    card.addEventListener('click', () => openExam(exam)); $('exams').append(card);
  }
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
$('back').addEventListener('click', () => { ++loadSequence; $('report').src = 'about:blank'; $('report-view').hidden = true; $('exam-list').hidden = false; selectedExam = null; examData = null; });
$('tab-scores').addEventListener('click', showScores); $('report-back').addEventListener('click', showScores);
$('tab-report').addEventListener('click', () => { if (selectedExam) showDocument(examData?.reportUrl || selectedExam.url, '完整报告', true); });
$('mode-rate').addEventListener('click', () => { scoreMode = 'rate'; drawBars(); });
$('mode-score').addEventListener('click', () => { scoreMode = 'score'; drawBars(); });
$('score-retry').addEventListener('click', loadScores);
addEventListener('pagehide', () => { credentials = null; selection = ''; $('password').value = ''; });
fetch('/api/student/me', { credentials: 'same-origin', cache: 'no-store' }).then(async response => {
  const data = await response.json(); if (response.ok) render(data); else if (response.status !== 401) showError(data.code);
}).catch(() => {});
