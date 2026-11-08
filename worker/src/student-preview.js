import { checkStudentLogin, StudentSourceError } from './student-source.js';

const HEADERS = {
  'Cache-Control': 'no-store, private', 'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
};
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: HEADERS });
// Best-effort isolate-local throttling for this short-lived preview. Production
// requires a shared limiter; this is not a cross-region/account lock guarantee.
const attempts = new Map(); let salt;
async function takeSlot(request, username) {
  salt ||= crypto.randomUUID();
  const now = Date.now();
  for (const [key, until] of attempts) if (until <= now) attempts.delete(key);
  if (attempts.size >= 2000) return false;
  const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
  const account = 'a:' + await digest(username.trim()), ip = 'i:' + await digest(request.headers.get('CF-Connecting-IP') || 'local');
  if (attempts.has(account) || attempts.has(ip)) return false;
  attempts.set(account, now + 15 * 60000); attempts.set(ip, now + 60000); return true;
}
export async function handleStudentPreview(request, env = {}, { checkLogin = checkStudentLogin, limiter = takeSlot } = {}) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/student/login-check') return json({ code: 'not_found' }, 404);
  if (request.method !== 'POST') return json({ code: 'method_not_allowed' }, 405);
  if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site')
    return json({ code: 'origin_refused' }, 403);
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return json({ code: 'invalid_request' }, 415);
  // This flag and deadline are preview-only deployment controls. Default off.
  const deadline = Date.parse(env.STUDENT_LOGIN_TEST_UNTIL || '');
  if (env.STUDENT_LOGIN_TEST_ENABLED !== 'true' || !Number.isFinite(deadline) || Date.now() >= deadline)
    return json({ code: 'login_test_closed' }, 503);
  let data;
  try {
    const reader = request.body?.getReader(); if (!reader) return json({ code: 'invalid_request' }, 400);
    let size = 0; const chunks = [];
    try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length;
      if (size > 2048) { await reader.cancel(); return json({ code: 'invalid_request' }, 413); } chunks.push(value); }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || Object.keys(data).sort().join(',') !== 'password,username') return json({ code: 'invalid_request' }, 400);
    if (typeof data.username !== 'string' || typeof data.password !== 'string' || !data.username.trim() || !data.password || data.username.length > 128 || data.password.length > 256)
      return json({ code: 'invalid_credentials_input' }, 400);
  } catch { return json({ code: 'invalid_request' }, 400); }
  try {
    if (!await limiter(request, data.username)) return json({ code: 'preview_rate_limited' }, 429);
    const result = await checkLogin(data);
    const states = ['source_selection_required', 'source_form_submitted'];
    if (!states.includes(result.state) || result.authenticated !== false) return json({ code: 'source_schema_changed' }, 502);
    return json({ state: result.state, authenticated: false });
  } catch (error) {
    const allowed = new Set(['invalid_credentials_input','source_schema_changed','source_protocol_rejected',
      'source_account_locked','source_credentials_rejected','source_login_not_accepted','source_rate_limited',
      'source_transport_failed','source_login_outcome_unknown','source_login_changed','source_unavailable',
      'source_empty','source_response_too_large','source_redirect_refused','source_request_budget','source_origin_refused']);
    return json({ code: error instanceof StudentSourceError && allowed.has(error.code) ? error.code : 'source_unavailable' },
      error instanceof StudentSourceError ? error.status : 502);
  } finally { if (data) { data.password = ''; data.username = ''; } }
}

export default { async fetch(request, env) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    if (url.hostname !== 'paper.bdfz.net' && !/^[a-z0-9-]+\.k12media-web\.pages\.dev$/.test(url.hostname)) return json({code:'login_test_closed'},503);
    return handleStudentPreview(request, env);
  }
  return env.ASSETS.fetch(request);
} };
