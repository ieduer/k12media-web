export const MESSAGES = Object.freeze({
  source_form_submitted: ['账号核对通过，登录回执待确认', '星立方已接收登录表单。这还不能确认学生身份；本次不会开放成绩或答卷。请向老师反馈下面的提示代码。'],
  source_selection_required: ['需要选择学校或班级', '此账号在星立方对应多个选项，请通过下方星立方入口选择后登录。'],
  source_credentials_rejected: ['星立方未接受姓名或密码', '请先核对登录名和密码。不要连续尝试，以免账号被锁定。'],
  source_account_locked: ['星立方账号已锁定', '本页已停止登录。请通过星立方的正常解锁渠道处理后再验证。'],
  source_login_not_accepted: ['星立方未接受这次登录', '请在星立方学生入口查看账号状态。本页不会自动重试。'],
  source_rate_limited: ['星立方暂时限制了登录', '请稍后通过源站确认账号状态，避免连续提交。'],
  preview_rate_limited: ['请先确认上次登录结果', '测试入口暂时限制了重复提交。请不要连续尝试，稍后再按老师指引验证。'],
  source_transport_failed: ['暂时无法连接星立方', '本次没有获得明确的登录结果，请勿立即重复提交。'],
  source_login_outcome_unknown: ['登录结果尚未确认', '登录请求可能已到达星立方，但没有收到明确回执。请勿立即重复提交。'],
  login_test_closed: ['登录测试暂未开放', '请等待老师通知，或通过下方星立方学生入口登录。'],
  invalid_credentials_input: ['请检查输入', '请填写学生姓名或已绑定手机，以及对应密码。'],
  connection_unknown: ['连接中断，结果未知', '请求可能已经提交。本页不会重发，请先通过星立方确认账号状态。']
});
const fallback = ['暂时无法完成验证', '源站返回了尚未识别的结果，请向老师反馈提示代码。不要发送姓名或密码。'];
export function describeResult(code) { return MESSAGES[code] || fallback; }
export function mountLogin(document, fetcher = fetch) {
  const form = document.getElementById('student-login'); if (!form) return;
  const user = document.getElementById('username'), pass = document.getElementById('password');
  const button = document.getElementById('submit'), reveal = document.getElementById('reveal');
  const result = document.getElementById('result'); let pending = false, submitted = false;
  reveal.addEventListener('click', () => { const show = pass.type === 'password'; pass.type = show ? 'text' : 'password'; reveal.textContent = show ? '隐藏' : '显示'; reveal.setAttribute('aria-label', show ? '隐藏密码' : '显示密码'); reveal.setAttribute('aria-pressed', String(show)); });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (pending || submitted || !form.reportValidity()) return;
    pending = true; submitted = true; button.disabled = true; button.textContent = '正在连接星立方…'; result.hidden = true;
    // One explicit submission per page. No background credential checks, replay,
    // persistent storage, analytics, or automatic retries.
    let body = JSON.stringify({ username: user.value.trim(), password: pass.value });
    pass.value = ''; pass.type = 'password'; reveal.textContent = '显示'; reveal.setAttribute('aria-pressed','false'); reveal.setAttribute('aria-label','显示密码');
    let code = 'connection_unknown';
    try {
      const request = fetcher('/api/student/login-check', { method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
        headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(125000) });
      body = '';
      const response = await request;
      if (!response.headers.get('Content-Type')?.includes('application/json')) throw Error('invalid_response');
      const text = await response.text(); if (text.length > 4096) throw Error('invalid_response');
      const data = JSON.parse(text);
      const value = data.code || data.state;
      code = typeof value === 'string' && /^[a-z_]{1,64}$/.test(value) ? value : 'source_schema_changed';
    } catch { code = 'connection_unknown'; }
    finally { body = ''; pending = false; pass.value = ''; }
    const [title, detail] = describeResult(code);
    document.getElementById('result-title').textContent = title;
    document.getElementById('result-detail').textContent = detail;
    document.getElementById('result-code').textContent = '提示代码：' + code;
    result.dataset.kind = code === 'source_form_submitted' ? 'pending' : 'error'; result.hidden = false; result.focus();
    button.textContent = '本次验证已结束';
  });
  globalThis.addEventListener?.('pagehide', () => { pass.value = ''; user.value = ''; });
}
if (typeof document !== 'undefined') mountLogin(document);
