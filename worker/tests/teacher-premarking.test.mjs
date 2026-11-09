import test from 'node:test';
import assert from 'node:assert/strict';
import { createPremarkingTeacher, parsePremarkingRoster, classifyPremarkingImageState } from '../src/teacher-premarking.js';

const credentials = { username: 'fixture', password: 'fixture-private' };
const scope = { testId: 10, paperId: 20 };
const login = { BusinessSuccess: true, Token: 'fixture-token' };
const student = { testStudentId: 30, testNo: 'fixture-no', testStudentName: 'fixture-name', status: '缺考(无卷)', color: 'red' };
const roster = (rows = [student]) => ({ result: 0, failedReason: '', data: rows });
function mock(responses) {
  const calls = [];
  return { calls, fetcher: async (url, init) => {
    calls.push({ url, init });
    assert(responses.length, 'unexpected source request');
    const value = responses.shift();
    if (typeof value === 'function') return value();
    return value instanceof Response ? value : new Response(JSON.stringify(value));
  } };
}

test('six paper rosters use only premarking endpoints and exact source parameters', async () => {
  const f = mock([login, ...Array.from({ length: 6 }, () => roster())]);
  const client = await createPremarkingTeacher(credentials, f);
  for (let paperId = 20; paperId < 26; paperId++) {
    const result = await client.roster({ testId: 10, paperId });
    assert.equal(result.scoreAvailable, false);
    assert.equal(result.students[0].imageState, 'no_answer_images');
    assert.equal(result.identityNamespace, 'yue:testStudentId');
    const body = f.calls.at(-1).init.body;
    assert.deepEqual(Object.fromEntries(body), { token: 'fixture-token', testId: '10', paperId: String(paperId), schoolId: '', testNo: '', studentName: '' });
  }
  assert.deepEqual(Object.fromEntries(f.calls[0].init.body), { siteID: '303', loginName: 'fixture', password: 'fixture-private' });
  assert(f.calls[0].url.endsWith('/premarking/server/Login.ashx'));
  assert(f.calls.slice(1).every(c => c.url.endsWith('/webReadingPrep/readingAdmcinistrator/getTestStudentInfo')));
  assert.equal(f.calls.length, 7);
  client.close();
});

test('explicit missing sheet is data, not an auth error, and never triggers image calls', async () => {
  const f = mock([login, roster()]), client = await createPremarkingTeacher(credentials, f);
  assert.deepEqual(await client.studentImageState(scope, 30), {
    state: 'no_answer_images', sourceStatus: '缺考(无卷)', scoreAvailable: false, pages: []
  });
  await assert.rejects(client.studentImageState(scope, student.testStudentName), /teacher_scope_invalid/);
  await assert.rejects(client.studentImageState(scope, 31), /teacher_student_not_in_roster/);
  assert.equal(f.calls.length, 2);
  client.close();
});

test('unknown, missing, red or complete-sheet statuses are not proof of images or grades', () => {
  for (const status of [undefined, '', '缺考', '缺卷', 'source-private-message']) {
    const data = parsePremarkingRoster(roster([{ ...student, status }]), scope);
    assert.equal(data.students[0].imageState, 'source_image_status_unknown');
    assert.equal(data.students[0].sourceStatus, null);
    assert.equal(data.scoreAvailable, false);
  }
  assert.equal(classifyPremarkingImageState('卷全'), 'source_reports_complete_sheet');
  assert.equal(classifyPremarkingImageState('缺考（无卷）'), 'no_answer_images');
  assert.deepEqual(parsePremarkingRoster(roster([]), scope).students, []);
});

test('duplicate identities, pagination and scope mismatches fail closed', () => {
  assert.throws(() => parsePremarkingRoster(roster([student, student]), scope), /teacher_roster_ambiguous/);
  for (const extra of [{ total: 2 }, { totalCount: '1' }, { hasNext: true }]) {
    assert.throws(() => parsePremarkingRoster({ ...roster(), ...extra }, scope), /teacher_roster_incomplete/);
  }
  assert.throws(() => parsePremarkingRoster({ ...roster(), paperId: 21 }, scope), /teacher_scope_mismatch/);
  assert.throws(() => parsePremarkingRoster(roster([{ ...student, testId: 11 }]), scope), /teacher_scope_mismatch/);
  assert.throws(() => parsePremarkingRoster(roster([{ ...student, testStudentId: 2 ** 53 }]), scope), /teacher_scope_invalid/);
});

test('same-session reads coalesce while teacher sessions and paper scopes remain separate', async () => {
  const a = mock([login, roster(), roster([{ ...student, status: '卷全' }])]);
  const b = mock([login, roster([{ ...student, status: '卷全' }])]);
  const ca = await createPremarkingTeacher(credentials, a), cb = await createPremarkingTeacher(credentials, b);
  const [one, two] = await Promise.all([ca.roster(scope), ca.roster(scope)]);
  assert.strictEqual(one, two);
  assert.equal((await cb.roster(scope)).students[0].imageState, 'source_reports_complete_sheet');
  assert.equal((await ca.roster({ testId: 11, paperId: 20 })).students[0].imageState, 'source_reports_complete_sheet');
  assert.equal(a.calls.length, 3); assert.equal(b.calls.length, 2);
  ca.close(); cb.close();
});

test('permission denial is preserved and not retried or relabeled as empty data', async () => {
  const f = mock([login, { result: -1, failedReason: '无权管理指定的试卷！' }]);
  const client = await createPremarkingTeacher(credentials, f);
  await assert.rejects(client.roster(scope), /teacher_permission_denied/);
  await assert.rejects(client.roster(scope), /teacher_permission_denied/);
  assert.equal(f.calls.length, 2); client.close();
});

test('login rejection, account lock and rate limit stop without any replay', async () => {
  const rejection = mock([{ BusinessSuccess: false, ErrorReason: '用户名或密码错误' }]);
  await assert.rejects(createPremarkingTeacher(credentials, rejection), /teacher_login_required/);
  assert.equal(rejection.calls.length, 1);
  for (const [reply, code] of [
    [{ result: -1, failedReason: '帐号锁定' }, 'teacher_account_locked'],
    [{ result: -1, failedReason: '登录失效' }, 'teacher_login_required'],
    [new Response('', { status: 429 }), 'teacher_rate_limited']
  ]) {
    const f = mock([login, reply]), client = await createPremarkingTeacher(credentials, f);
    await assert.rejects(client.roster(scope), new RegExp(code));
    await assert.rejects(client.roster({ testId: 10, paperId: 21 }), new RegExp(code));
    assert.equal(f.calls.length, 2); client.close();
  }
});

test('transport failure and timeout expose only fixed codes and do not retry', async () => {
  for (const error of [new Error('raw private source response'), new DOMException('private timeout', 'TimeoutError')]) {
    const f = mock([login, () => { throw error; }]), client = await createPremarkingTeacher(credentials, f);
    const code = error.name === 'TimeoutError' ? 'teacher_source_timeout' : 'teacher_transport_failed';
    for (let i = 0; i < 2; i++) await assert.rejects(client.roster(scope), e => e.code === code && !e.message.includes('private'));
    assert.equal(f.calls.length, 2); client.close();
  }
});

test('source cache expires, request budget stays bounded, and session expiry blocks cached reads', async () => {
  let now = 0;
  const f = mock([login, roster(), roster([{ ...student, status: '卷全' }])]);
  const client = await createPremarkingTeacher(credentials, { ...f, now: () => now, maxRequests: 3 });
  assert.equal((await client.roster(scope)).students[0].imageState, 'no_answer_images');
  now = 60001;
  assert.equal((await client.roster(scope)).students[0].imageState, 'source_reports_complete_sheet');
  await assert.rejects(client.roster({ testId: 10, paperId: 21 }), /teacher_request_budget/);
  now = 180001;
  await assert.rejects(client.roster(scope), /teacher_session_expired/);
  assert.equal(f.calls.length, 3); client.close();
});

test('closing a client suppresses an already in-flight private roster', async () => {
  let resolve;
  const f = mock([login, () => new Promise(r => { resolve = r; })]);
  const client = await createPremarkingTeacher(credentials, f);
  const pending = client.roster(scope);
  client.close(); resolve(new Response(JSON.stringify(roster())));
  await assert.rejects(pending, /teacher_session_closed/);
});

test('redirects and oversized source payloads stop with bounded sanitized errors', async () => {
  for (const [response, code] of [
    [new Response('', { status: 302, headers: { Location: 'https://example.invalid/private' } }), 'teacher_source_unavailable'],
    [new Response('x'.repeat(8 * 1024 * 1024 + 1)), 'teacher_response_too_large']
  ]) {
    const f = mock([login, response]), client = await createPremarkingTeacher(credentials, f);
    await assert.rejects(client.roster(scope), new RegExp(code));
    assert.equal(f.calls.length, 2); client.close();
  }
});

const completeStudent = { ...student, status: '卷全' };
const picture = (pageNo, extra = {}) => ({ testNo: student.testNo, testStudentName: student.testStudentName,
  pathId: 'fixture-path', imageFileScanName: `scan-${pageNo}.jpg`, answerPaperSn: pageNo, ...extra });
const pictureResponse = rows => ({ result: 0, data: rows });
const imageBytes = () => { const bytes = new Uint8Array(300); bytes.set([255, 216, 255]); return bytes; };

test('complete source manifest uses exact roster identity and source original-download action', async () => {
  const f = mock([login, roster([completeStudent]), pictureResponse([picture(2), picture(1)]), new Response(imageBytes()), new Response(imageBytes())]);
  const client = await createPremarkingTeacher(credentials, f);
  const manifest = await client.originalPages(scope, 30);
  assert.equal(manifest.state, 'source_declared_pages');
  assert.deepEqual(manifest.pages.map(p => p.pageNo), [1, 2]);
  await assert.rejects(client.downloadOriginal({ pageNo: 1 }), /teacher_image_scope_invalid/);
  for (const page of manifest.pages) {
    const image = await client.downloadOriginal(page);
    assert.equal(image.type, 'image/jpeg'); assert.equal(image.bytes.length, 300);
    const call = f.calls.at(-1), url = new URL(call.url);
    assert.equal(call.init.method, 'GET');
    assert.equal(url.origin, 'https://yue.k12media.cn');
    assert.equal(url.pathname, '/premarking/server/DownloadRawImageFile.ashx');
    assert.equal(url.searchParams.get('imageFileName'), `scan-${page.pageNo}.jpg`);
    assert.equal(call.init.headers.Referer, 'https://yue.k12media.cn/premarking/h5/index.html');
    assert(!JSON.stringify(page).includes('fixture-token'));
  }
  client.close(); await assert.rejects(client.downloadOriginal(manifest.pages[0]), /teacher_session_closed/);
});

test('no-sheet state prevents all manifest and download calls', async () => {
  const f = mock([login, roster()]), client = await createPremarkingTeacher(credentials, f);
  assert.deepEqual(await client.originalPages(scope, 30), { state: 'no_answer_images', pages: [] });
  assert.equal(f.calls.length, 2); client.close();
});

test('foreign identities, gaps, duplicate pages and filename traversal never issue image references', async () => {
  for (const [rows, error] of [
    [[picture(1, { testNo: 'other-student' })], 'teacher_image_identity_mismatch'],
    [[picture(1), picture(3)], 'teacher_image_manifest_incomplete'],
    [[picture(1), picture(1)], 'teacher_image_manifest_invalid'],
    [[picture(1, { imageFileScanName: '../foreign.jpg' })], 'teacher_image_manifest_invalid']
  ]) {
    const f = mock([login, roster([completeStudent]), pictureResponse(rows)]), client = await createPremarkingTeacher(credentials, f);
    await assert.rejects(client.originalPages(scope, 30), new RegExp(error));
    await assert.rejects(client.originalPages(scope, 30), new RegExp(error));
    assert.equal(f.calls.length, 3); client.close();
  }
});

test('a denied first image stops the subject; a two-page manifest is not image acceptance', async () => {
  const f = mock([login, roster([completeStudent]), pictureResponse([picture(1), picture(2)]),
    { BusinessSuccess: false, ErrorReason: '用户无权限下载图片' }]);
  const client = await createPremarkingTeacher(credentials, f), manifest = await client.originalPages(scope, 30);
  assert.equal(manifest.state, 'source_declared_pages');
  for (const page of manifest.pages) await assert.rejects(client.downloadOriginal(page), /teacher_permission_denied/);
  assert.equal(f.calls.length, 4); client.close();
});

test('JSON-wrapped source images decode but JSON errors and truncated images are not accepted', async () => {
  for (const [reply, succeeds] of [
    [{ BusinessSuccess: true, FileContent: Buffer.from(imageBytes()).toString('base64') }, true],
    [{ BusinessSuccess: true, FileContent: Buffer.from('private error').toString('base64') }, false],
    [new Response(new Uint8Array([255, 216, 255])), false]
  ]) {
    const f = mock([login, roster([completeStudent]), pictureResponse([picture(1)]), reply]);
    const client = await createPremarkingTeacher(credentials, f), manifest = await client.originalPages(scope, 30);
    if (succeeds) assert.equal((await client.downloadOriginal(manifest.pages[0])).bytes.length, 300);
    else await assert.rejects(client.downloadOriginal(manifest.pages[0]), /teacher_image_unavailable/);
    client.close();
  }
});

test('subjective item inspection preserves an empty response and never fabricates a zero grade', async () => {
  const f = mock([login, roster([completeStudent]), { result: 0, data: [] }]);
  const client = await createPremarkingTeacher(credentials, f);
  await assert.rejects(client.itemScores(scope, 31), /teacher_student_not_in_roster/);
  assert.deepEqual(await client.itemScores(scope, 30), []);
  assert.equal(f.calls.at(-1).url, 'https://yue.k12media.cn/webReadingPrep/testmateDivision/testStudentIdItemId');
  assert.equal(f.calls.at(-1).init.body.get('checkType'), '0');
  assert.equal((await client.roster(scope)).scoreAvailable, false);
  client.close();
});

test('business-level authentication failures in image and score readers stop the entire session', async () => {
  for (const method of ['originalPages', 'itemScores']) {
    const f = mock([login, roster([completeStudent]), { result: -1, failedReason: '登录失效' }]);
    const client = await createPremarkingTeacher(credentials, f);
    await assert.rejects(client[method](scope, 30), /teacher_login_required/);
    await assert.rejects(client.roster({ testId: 10, paperId: 21 }), /teacher_login_required/);
    assert.equal(f.calls.length, 3); client.close();
  }
});
