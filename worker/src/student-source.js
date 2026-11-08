import CryptoJS from 'crypto-js';
import { updateCookieJar } from './student-cookies.js';

// Verified against the official student's login.jsp on 2026-11-08 UTC.
// This module implements only the observed pre-login account selection.
// It deliberately does NOT turn a successful lookup into an authenticated session.
export const STUDENT_ORIGIN = 'https://test.k12media.cn:8000';
export class StudentSourceError extends Error {
  constructor(code, status = 502) { super(code); this.code = code; this.status = status; }
}
const failure = code => { throw new StudentSourceError(code); };

// DWR replies contain JavaScript object literals. Parse the data grammar only;
// never eval source responses or run their script/preamble.
export function parseDwrReply(source, batch, call = '0') {
  if (typeof source !== 'string' || source.length > 65536) return failure('source_schema_changed');
  if (/dwr\.engine\.(?:_remoteHandle|remote\.handle)(?:Batch)?Exception\s*\(/.test(source)) return failure('source_protocol_rejected');
  const re = /dwr\.engine\.(?:_remoteHandleCallback|remote\.handleCallback)\s*\(\s*"(\d+)"\s*,\s*"(\d+)"\s*,/g;
  const match = re.exec(source);
  if (!match || match[1] !== String(batch) || match[2] !== String(call) || re.exec(source)) return failure('source_schema_changed');
  let at = match.index + match[0].length;
  const ws = () => { while (/\s/.test(source[at] || '') && at < source.length) at++; };
  function string() {
    const start = at++;
    while (at < source.length) {
      const ch = source[at++];
      if (ch === '\\') { at++; continue; }
      if (ch === '"') { try { return JSON.parse(source.slice(start,at)); } catch { return failure('source_schema_changed'); } }
    }
    return failure('source_schema_changed');
  }
  function value(depth = 0) {
    ws(); if (depth > 12) return failure('source_schema_changed');
    const ch = source[at];
    if (ch === '"') return string();
    // DWR serializes nullable date fields as new Date(milliseconds), even on a
    // successful account DTO. Decode only this exact numeric data production;
    // never evaluate constructors or other source JavaScript.
    if (source.slice(at).startsWith('new Date(')) {
      const date = source.slice(at).match(/^new Date\((-?\d{1,16})\)/);
      if (!date || !Number.isSafeInteger(Number(date[1]))) return failure('source_schema_changed');
      at += date[0].length; return Number(date[1]);
    }
    if (ch === '[' || ch === '{') {
      at++; const array = ch === '[', end = array ? ']' : '}', out = array ? [] : Object.create(null); let count = 0;
      ws(); if (source[at] === end) { at++; return out; }
      while (at < source.length) {
        if (++count > 128) return failure('source_schema_changed');
        if (array) out.push(value(depth + 1));
        else {
          ws(); let key;
          if (source[at] === '"') key = string();
          else { const m = source.slice(at).match(/^[A-Za-z_$][\w$]*/); if (!m) return failure('source_schema_changed'); key = m[0]; at += key.length; }
          if (['__proto__','prototype','constructor'].includes(key) || Object.hasOwn(out,key)) return failure('source_schema_changed');
          ws(); if (source[at++] !== ':') return failure('source_schema_changed'); out[key] = value(depth + 1);
        }
        ws(); if (source[at] === end) { at++; return out; }
        if (source[at++] !== ',') return failure('source_schema_changed');
      }
      return failure('source_schema_changed');
    }
    const literal = source.slice(at).match(/^(?:null|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?)(?![\w.])/);
    if (!literal) return failure('source_schema_changed'); at += literal[0].length; return JSON.parse(literal[0]);
  }
  const data = value(); ws();
  if (!source.slice(at).startsWith(');')) return failure('source_schema_changed');
  return data;
}

export function encryptCredential(value) {
  // Published AES-128 client protocol constant, not a service secret.
  // Keep the source's UTF-8 / ECB / PKCS7 encoding exactly.
  return CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(value), CryptoJS.enc.Utf8.parse('xlfykj@20231026@'), {
    mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7
  }).toString();
}

// A bounded, self-service login diagnostic. No portal session is issued until a
// separately verified source actor adapter exists. Cookies live only in this call.
export async function checkStudentLogin(credentials, { fetcher = fetch } = {}) {
  const selected = await beginStudentLogin(credentials, { fetcher });
  if (selected.selections.length !== 1) return { state: 'source_selection_required', authenticated: false };
  const choice = selected.selections[0];
  const form = new URLSearchParams({
    isLogin: '0', loginNum: '0', ifsecond: '0', ifChangeSelectSchool: '1',
    classId: choice.classId, schoolId: choice.schoolId, pass: '', validCheckCode: '0',
    authType: '100030', j_username: encryptCredential(credentials.username.trim()),
    j_password: encryptCredential(credentials.password)
  });
  let response;
  try {
    response = await fetcher(STUDENT_ORIGIN + '/tqweb/j_acegi_security_check', {
      method: 'POST', body: form.toString(), redirect: 'manual', cache: 'no-store',
      signal: AbortSignal.timeout(30000), headers: {
        'Content-Type': 'application/x-www-form-urlencoded', Origin: STUDENT_ORIGIN,
        Referer: STUDENT_ORIGIN + '/tqweb/login.jsp', Cookie: selected.sourceCookies
      }
    });
  } catch { throw new StudentSourceError('source_login_outcome_unknown'); }
  await response.body?.cancel();
  if (response.status === 429) throw new StudentSourceError('source_rate_limited', 429);
  if (![302,303].includes(response.status)) throw new StudentSourceError('source_login_outcome_unknown');
  let target;
  try { target = new URL(response.headers.get('Location') || '', STUDENT_ORIGIN); } catch { return failure('source_redirect_refused'); }
  if (target.origin !== STUDENT_ORIGIN || target.username || target.password || !target.pathname.startsWith('/tqweb/'))
    return failure('source_redirect_refused');
  if (/\/login(?:\.jsp|\/)|login_error|error=|failure/i.test(target.pathname + target.search))
    throw new StudentSourceError('source_login_not_accepted', 403);
  // A redirect is deliberately not proof of login or student identity. Do not
  // follow an unknown action URL, expose it, persist cookies, or grant data access.
  return { state: 'source_form_submitted', authenticated: false };
}

export async function beginStudentLogin({ username, password }, { fetcher = fetch } = {}) {
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password || username.length > 128 || password.length > 256)
    throw new StudentSourceError('invalid_credentials_input', 400);
  const jar = new Map(); let requests = 0;
  async function request(path, body) {
    if (++requests > 3) return failure('source_request_budget');
    const url = new URL(path, STUDENT_ORIGIN);
    if (url.origin !== STUDENT_ORIGIN) return failure('source_origin_refused');
    let response, text;
    try {
      response = await fetcher(url.href, { method: body === undefined ? 'GET' : 'POST', body, redirect: 'manual',
        signal: AbortSignal.timeout(30000), cache: 'no-store', headers: {
          'Content-Type': 'text/plain', Origin: STUDENT_ORIGIN, Referer: STUDENT_ORIGIN + '/tqweb/login.jsp',
          Cookie: [...jar].map(([key,value])=>`${key}=${value}`).join('; ')
        } });
      if (!response.ok) { await response.body?.cancel(); throw new StudentSourceError(response.status === 429 ? 'source_rate_limited' : 'source_unavailable', response.status === 429 ? 429 : 502); }
      const reader = response.body?.getReader(); if (!reader) return failure('source_empty');
      const chunks = []; let size = 0;
      try {
        while (true) { const {done,value} = await reader.read(); if (done) break; size += value.length;
          if (size > 512 * 1024) { await reader.cancel(); return failure('source_response_too_large'); } chunks.push(value); }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size); let offset=0; for (const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.length;}
      text = new TextDecoder().decode(bytes);
    } catch (error) { if (error instanceof StudentSourceError) throw error; return failure('source_transport_failed'); }
    updateCookieJar(jar, response.headers);
    return text;
  }
  const page = await request('/tqweb/login.jsp');
  if (!page.includes('findUnitOrClassMessage') || !page.includes('/tqweb/j_acegi_security_check')) return failure('source_login_changed');
  function dwr(script,method,params,sid,batch) {
    return ['callCount=1','nextReverseAjaxIndex=0','instanceId=0','page=/tqweb/login.jsp','httpSessionId=',
      `scriptSessionId=${sid}`,`c0-scriptName=${script}`,`c0-methodName=${method}`,'c0-id=0',
      ...params.map((v,i)=>`c0-param${i}=${v}`),`batchId=${batch}`].join('\n');
  }
  const sid = parseDwrReply(await request('/tqweb/dwr/call/plaincall/__System.generateId.dwr', dwr('__System','generateId',[],'',1)),1);
  if (typeof sid !== 'string' || !/^[A-Za-z0-9_.!~+\/-]{1,256}$/.test(sid)) return failure('source_schema_changed');
  jar.set('DWRSESSIONID',sid);
  const found = parseDwrReply(await request('/tqweb/dwr/call/plaincall/SelectUserUtil.findUnitOrClassMessage.dwr',
    dwr('SelectUserUtil','findUnitOrClassMessage',['string:'+encodeURIComponent(encryptCredential(username.trim())),'string:'+encodeURIComponent(encryptCredential(password)),'number:100030'],sid+'/'+Date.now(),2)),2);
  if (!Array.isArray(found) || !found.length || found.length > 20) return failure('source_schema_changed');
  const denial = found.find(row=>row?.type === 0);
  if (denial) {
    const message = String(denial.errorMessage || '');
    if (/锁定|锁死|冻结|解锁/.test(message)) throw new StudentSourceError('source_account_locked',423);
    if (/用户名或密码错误|用户名或密码不正确/.test(message)) throw new StudentSourceError('source_credentials_rejected',401);
    throw new StudentSourceError('source_login_not_accepted',403);
  }
  if (found.some(row=>row?.type !== 1 || !/^\d+$/.test(String(row.schoolId)) || !/^\d+$/.test(String(row.classId)))) return failure('source_schema_changed');
  // INTERNAL ONLY: school/class choices and transient source cookies. Caller must
  // complete official form login and verify the resulting student actor before
  // minting any session or allowing exam/image/chat access. No raw DTO/password.
  return { state: 'selection_required', authenticated: false,
    selections: found.map(row=>({schoolId:String(row.schoolId),classId:String(row.classId)})),
    sourceCookies: [...jar].map(([key,value])=>`${key}=${value}`).join('; ') };
}
