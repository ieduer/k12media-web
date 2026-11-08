// Server-only candidate. Never import into the student router until a trusted
// cross-source identity mapping and real grade/image acceptance are available.
// Protocol authority: Mark's premarkingLogin/getReadingAdminPreviewStudentIds.
const LOGIN = 'https://yue.k12media.cn/premarking/server/Login.ashx';
const ROSTER = 'https://yue.k12media.cn/webReadingPrep/readingAdmcinistrator/getTestStudentInfo';
const MAX_BYTES = 8 * 1024 * 1024;

export class PremarkingSourceError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new PremarkingSourceError(code); };
function id(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) fail('teacher_scope_invalid');
  const text = String(value ?? '');
  if (!/^[1-9]\d{0,15}$/.test(text)) fail('teacher_scope_invalid');
  return text;
}
function failureCode(data) {
  const message = String(data?.failedReason || data?.ErrorReason || data?.Describe || data?.Message || '');
  if (/锁定|鎖定|冻结|凍結/.test(message)) return 'teacher_account_locked';
  if (/用户名或密码|用户.*密码.*错误|帳號.*密碼|重新登录|登录失效|token.*(?:失效|无效)/i.test(message)) return 'teacher_login_required';
  if (/无权|無權|权限不足|没有.*权限/.test(message)) return 'teacher_permission_denied';
  if (/频繁|頻繁|稍后再试|稍後再試/.test(message)) return 'teacher_rate_limited';
  return 'teacher_source_unavailable';
}

// Only explicit source statements establish a missing sheet. Color, missing
// fields, empty rosters and network failures do not establish image absence.
export function classifyPremarkingImageState(status) {
  if (status === '缺考(无卷)' || status === '缺考（无卷）' || status === '无卷') {
    return 'no_answer_images';
  }
  if (status === '卷全') return 'source_reports_complete_sheet';
  return 'source_image_status_unknown';
}

export function parsePremarkingRoster(data, scope) {
  const testId = id(scope.testId), paperId = id(scope.paperId);
  if (data?.result !== 0) fail(failureCode(data));
  if (!Array.isArray(data.data) || data.data.length > 10000) fail('teacher_schema_changed');
  if ((data.testId != null && String(data.testId) !== testId) ||
      (data.paperId != null && String(data.paperId) !== paperId)) fail('teacher_scope_mismatch');
  // The accepted endpoint returns an unpaginated array. Never silently promote
  // a future partial/paginated response to a complete roster.
  if (data.hasNext === true || ['total', 'totalCount'].some(key =>
    data[key] != null && (!Number.isSafeInteger(data[key]) || data[key] !== data.data.length))) {
    fail('teacher_roster_incomplete');
  }
  const seen = new Set();
  const students = data.data.map(row => {
    if (!row || typeof row !== 'object') fail('teacher_schema_changed');
    const testStudentId = id(row.testStudentId);
    if (seen.has(testStudentId)) fail('teacher_roster_ambiguous');
    seen.add(testStudentId);
    if (typeof row.testNo !== 'string' || !row.testNo || row.testNo.length > 128 ||
        typeof row.testStudentName !== 'string' || !row.testStudentName || row.testStudentName.length > 128 ||
        (row.status != null && typeof row.status !== 'string')) fail('teacher_schema_changed');
    if ((row.testId != null && String(row.testId) !== testId) ||
        (row.paperId != null && String(row.paperId) !== paperId)) fail('teacher_scope_mismatch');
    return Object.freeze({
      testStudentId, testNo: row.testNo, name: row.testStudentName,
      imageState: classifyPremarkingImageState(row.status),
      // Never forward arbitrary upstream text/errors to a student or log.
      sourceStatus: ['缺考(无卷)', '缺考（无卷）', '无卷', '卷全'].includes(row.status) ? row.status : null
    });
  });
  return Object.freeze({
    testId, paperId, source: 'premarking:getTestStudentInfo',
    identityNamespace: 'yue:testStudentId', scoreAvailable: false,
    students: Object.freeze(students)
  });
}

export async function createPremarkingTeacher(
  { username, password, siteId = '303' },
  { fetcher = fetch, now = Date.now, maxRequests = 10 } = {}
) {
  if (typeof username !== 'string' || !username || username.length > 128 ||
      typeof password !== 'string' || !password || password.length > 256) fail('teacher_credentials_invalid');
  id(siteId);
  if (!Number.isInteger(maxRequests) || maxRequests < 2 || maxRequests > 32) fail('teacher_budget_invalid');
  const cache = new Map(), pending = new Map(), failures = new Map();
  let token = '', requests = 0, terminal = '', createdAt = now();
  function active() {
    if (terminal) fail(terminal);
    if (now() - createdAt > 180000) fail('teacher_session_expired');
  }
  function close() {
    token = ''; terminal = 'teacher_session_closed'; cache.clear(); pending.clear(); failures.clear();
  }
  async function post(url, params) {
    active();
    if (requests >= maxRequests) fail('teacher_request_budget');
    requests++;
    try {
      const response = await fetcher(url, {
        method: 'POST', redirect: 'manual', cache: 'no-store',
        signal: AbortSignal.timeout(20000), body: new URLSearchParams(params),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Origin: 'https://yue.k12media.cn', Referer: 'https://yue.k12media.cn/premarking/h5/index.html'
        }
      });
      if (!response.ok) {
        await response.body?.cancel();
        fail(response.status === 401 ? 'teacher_login_required' : response.status === 403 ?
          'teacher_permission_denied' : response.status === 429 ? 'teacher_rate_limited' : 'teacher_source_unavailable');
      }
      const reader = response.body?.getReader(), chunks = [];
      if (!reader) fail('teacher_schema_changed');
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_BYTES) { await reader.cancel(); fail('teacher_response_too_large'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size);
      let at = 0;
      for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
      let data;
      try { data = JSON.parse(new TextDecoder().decode(bytes)); }
      catch { fail('teacher_schema_changed'); }
      active(); // A closed/expired client cannot deliver an in-flight roster.
      return data;
    } catch (error) {
      const code = error instanceof PremarkingSourceError ? error.code :
        ['TimeoutError', 'AbortError'].includes(error?.name) ? 'teacher_source_timeout' : 'teacher_transport_failed';
      if (['teacher_login_required', 'teacher_account_locked', 'teacher_rate_limited'].includes(code)) {
        close(); terminal = code;
      }
      fail(code);
    }
  }
  try {
    const data = await post(LOGIN, { siteID: String(siteId), loginName: username, password });
    if (data?.BusinessSuccess !== true || typeof data.Token !== 'string' || !data.Token) fail(failureCode(data));
    token = data.Token; createdAt = now();
  } catch (error) { close(); throw error; }
  async function roster(scope) {
    active();
    const testId = id(scope.testId), paperId = id(scope.paperId), key = `${testId}:${paperId}`;
    if (failures.has(key)) fail(failures.get(key));
    const saved = cache.get(key);
    if (saved && now() - saved.at < 60000) return saved.value;
    if (pending.has(key)) return pending.get(key);
    const operation = (async () => {
      try {
        const data = await post(ROSTER, { token, testId, paperId, schoolId: '', testNo: '', studentName: '' });
        const value = parsePremarkingRoster(data, { testId, paperId });
        cache.set(key, { at: now(), value });
        return value;
      } catch (error) {
        const code = error instanceof PremarkingSourceError ? error.code : 'teacher_schema_changed';
        failures.set(key, code);
        if (['teacher_login_required', 'teacher_account_locked', 'teacher_rate_limited'].includes(code)) {
          close(); terminal = code;
        }
        fail(code);
      } finally { pending.delete(key); }
    })();
    pending.set(key, operation);
    return operation;
  }
  return Object.freeze({ close, roster,
    // This uses Yue's own namespace, never a name or a TQWEB userId. It is a
    // private source lookup, not proof that the logged-in student owns this ID.
    async studentImageState(scope, testStudentId) {
      const sid = id(testStudentId), data = await roster(scope);
      const student = data.students.find(row => row.testStudentId === sid);
      if (!student) fail('teacher_student_not_in_roster');
      return Object.freeze({ state: student.imageState, sourceStatus: student.sourceStatus,
        scoreAvailable: false, pages: Object.freeze([]) });
    }
  });
}
