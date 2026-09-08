// Actual Worker source with synthetic CryptoJS and fetch. No network fallback,
// package installation, real account, runtime or encryption acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const SECRET = 'SYNTHETIC_PRIVATE_UPSTREAM_SENTINEL';
const STUDENT_NAME = 'Synthetic Student';
const STUDENT_NO = '876543210';
const EXAM_NAME = 'Synthetic Exam Title';
const sourceRoot = new URL('../src/', import.meta.url);
const names = ['auth.js', 'diagnostics.js', 'dwr.js', 'exam.js', 'image.js', 'index.js'];
const source = Object.fromEntries(await Promise.all(names.map(async name => [name, await fs.readFile(new URL(name, sourceRoot), 'utf8')])));

async function load(queue = [], overrides = {}) {
  const logs = [], calls = [];
  const context = vm.createContext({ URL, URLSearchParams, Response, Headers, Date,
    console: Object.fromEntries(['log', 'error', 'info', 'warn'].map(name => [name, (...args) => logs.push(args)])),
    fetch: async (...args) => {
      calls.push(args); assert.ok(queue.length, 'Unexpected fetch; no network fallback exists');
      const result = queue.shift(); if (result instanceof Error) throw result; return result;
    }
  });
  const modules = new Map();
  function synthetic(name, values) {
    modules.set(name, new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context, identifier: name }));
  }
  synthetic('crypto-js', { default: {
    enc: { Utf8: { parse: value => value } }, mode: { ECB: {} }, pad: { Pkcs7: {} },
    AES: { encrypt: value => ({ toString: () => `mock-encrypted(${value})` }) }
  } });
  for (const [name, code] of Object.entries(source)) modules.set(`./${name}`, new vm.SourceTextModule(code, { context, identifier: name }));
  for (const [name, exports] of Object.entries(overrides)) synthetic(name, exports);
  const entry = modules.get('./index.js');
  await entry.link(name => { assert.ok(modules.has(name), 'Unexpected import'); return modules.get(name); });
  await entry.evaluate();
  return { api: entry.namespace.default, dwr: modules.get('./dwr.js').namespace,
    exam: modules.get('./exam.js').namespace, image: modules.get('./image.js').namespace,
    diagnostics: modules.get('./diagnostics.js').namespace, logs, calls };
}
const response = (body = '', status = 200, headers = {}) => new Response(body, { status, headers });
const serialized = value => JSON.parse(JSON.stringify(value));
function privateFree(value, extra = []) {
  const text = JSON.stringify(value);
  for (const sentinel of [SECRET, ...extra]) assert.ok(!text.includes(sentinel), 'Synthetic private data escaped diagnostic boundary');
}
const classes = [{ classId: 42, label: 'Synthetic class', isTeacherClass: false }];
const studentText = () => `{classId:42,noInClass:"${STUDENT_NO}",orgUser:{name:"${STUDENT_NAME}"},session:"${SECRET}"}`;
const examHtml = () => `<input value="${SECRET}"><span onclick="viewTest(12345);"> ${EXAM_NAME} </span>`;
function request(path) { return new Request(`https://fixture.invalid${path}`, { headers: { 'X-Cookie': `JSESSIONID=${SECRET}` } }); }

test('DWR empty/raw responses and per-class exceptions produce fixed diagnostics only', async () => {
  const { dwr, logs, calls } = await load([response(`<html>${SECRET}</html>`), new Error(`${SECRET} cookie=private`), response(SECRET, 503)]);
  const result = await dwr.fetchAllStudents(SECRET, [...classes, ...classes, ...classes], 'synthetic-test', {});
  assert.deepEqual(serialized(result), { allStudents: [], debugLogs: ['dwr_class_empty', 'dwr_class_fetch_failed', 'dwr_class_fetch_failed'] });
  privateFree(result); privateFree(logs);
  assert.equal(calls.length, 3); assert.equal(calls[0][1].headers.Cookie, SECRET);
  assert.equal(calls[0][1].method, 'POST');
});

test('successful DWR parsing and deduplication retain legitimate student data, never telemetry', async () => {
  const { dwr, logs } = await load([response(studentText()), response(studentText())]);
  const result = await dwr.fetchAllStudents(SECRET, [...classes, ...classes], 'synthetic-test', {});
  assert.deepEqual(serialized(result), { allStudents: [{ classId: 42, classLabel: 'Synthetic class', isTeacherClass: false, noInClass: STUDENT_NO, name: STUDENT_NAME }], debugLogs: [] });
  privateFree(result); privateFree(logs, [STUDENT_NAME, STUDENT_NO]);
});

test('student 404 direct-lookup failure retains status/schema without raw diagnostic reflection', async () => {
  const queue = Array.from({ length: 4 }, () => response(SECRET)); queue.push(new Error(SECRET));
  const { api, logs } = await load(queue);
  const result = await api.fetch(request(`/api/student/${STUDENT_NO}/images?testId=synthetic-test&subjectId=1`), {}, {});
  assert.equal(result.status, 404);
  const body = await result.json();
  assert.deepEqual(Object.keys(body).sort(), ['debugLogs', 'error', 'searchedClasses']);
  assert.deepEqual(body.debugLogs, [...Array(4).fill('dwr_class_empty'), 'dwr_direct_lookup_failed']);
  privateFree(body, [STUDENT_NAME, STUDENT_NO]); privateFree(logs, [STUDENT_NAME, STUDENT_NO]);
});

test('successful direct lookup and image parsing preserve student/subject/image result shape', async () => {
  const queue = Array.from({ length: 4 }, () => response(SECRET));
  queue.push(response(studentText()), response('<img src="/tqms_image_server/DemoAction.a?id=synthetic">'));
  const { api, logs } = await load(queue);
  const result = await api.fetch(request(`/api/student/${STUDENT_NO}/images?testId=synthetic-test&subjectId=1`), {}, {});
  assert.equal(result.status, 200); const body = await result.json();
  assert.equal(body.student.name, STUDENT_NAME); assert.equal(body.student.noInClass, STUDENT_NO);
  assert.equal(body.subjects['1'].images.length, 1);
  assert.equal(body.subjects['1'].images[0].url, 'https://yue.k12media.cn/tqms_image_server/DemoAction.a?id=synthetic');
  assert.ok(body.subjects['1'].images[0].proxyUrl.startsWith('/api/proxy-image?url='));
  privateFree(body); privateFree(logs, [STUDENT_NAME, STUDENT_NO]);
});

test('image fetch failures retain empty-list behavior with constant events', async () => {
  for (const value of [new Error(`${SECRET} https://fixture.invalid/?token=private`), response(SECRET, 503), { ok: true, text: async () => { throw new Error(SECRET); } }]) {
    const { image, logs } = await load([value]);
    const result = await image.fetchStudentImages(SECRET, { name: STUDENT_NAME, classId: 42, isTeacherClass: false }, 1, 'synthetic-test', {});
    assert.deepEqual(serialized(result), []); privateFree(logs, [STUDENT_NAME]);
    assert.ok(logs.every(row => row[1].event === 'image_fetch_failed'));
  }
});

test('exams preserve successful names/IDs in normal and debug envelopes without HTML samples', async () => {
  for (const debug of [false, true]) {
    const { exam, logs } = await load([response(examHtml())]);
    const result = await exam.fetchExams(SECRET, debug);
    assert.deepEqual(serialized(debug ? result.exams : result), [{ id: 12345, name: EXAM_NAME }]);
    if (debug) {
      assert.deepEqual(Object.keys(result).sort(), ['debug', 'exams']);
      assert.equal(result.debug.status, 200); assert.equal(result.debug.parseInfo.matchCount, 1);
      for (const key of ['htmlPreview', 'exception', 'url']) assert.ok(!Object.hasOwn(result.debug, key));
    }
    privateFree(result); privateFree(logs);
  }
});

test('fallback exam parsing and empty/login pages retain content semantics with scalar diagnostics', async () => {
  for (const [html, expected] of [['<a href="javascript:viewTest(67890)">open</a>', [{ id: 67890, name: 'Exam 67890' }]], [`<form>${SECRET} login getToken testId exam</form>`, []]]) {
    const { exam, logs } = await load([response(html)]);
    const result = await exam.fetchExams(SECRET, true);
    assert.deepEqual(serialized(result.exams), expected);
    assert.ok(!Object.hasOwn(result.debug.parseInfo, 'sampleViewTestCalls'));
    privateFree(result); privateFree(logs);
  }
});

test('exam HTTP/transport/read exceptions preserve empty exam shape and fixed error codes', async () => {
  for (const debug of [false, true]) {
    for (const [value, errorCode] of [[response(SECRET, 503), 'exam_upstream_http_error'], [new Error(SECRET), 'exam_fetch_failed'], [{ ok: true, status: 200, text: async () => { throw new Error(SECRET); } }, 'exam_fetch_failed']]) {
      const { exam, logs } = await load([value]);
      const result = await exam.fetchExams(SECRET, debug);
      assert.deepEqual(serialized(debug ? result.exams : result), []);
      if (debug) assert.equal(result.debug.error, errorCode);
      privateFree(result); privateFree(logs);
    }
  }
});

test('actual exam API route retains 401/200 and safe debug envelope', async () => {
  for (const suffix of ['', '&debug=1']) {
    const { api, logs } = await load([response(examHtml())]);
    const result = await api.fetch(request(`/api/exams?fixture=1${suffix}`), {}, {});
    assert.equal(result.status, 200); const body = await result.json();
    assert.deepEqual(body.exams, [{ id: 12345, name: EXAM_NAME }]);
    assert.equal(Object.hasOwn(body, 'debug'), Boolean(suffix)); privateFree(body); privateFree(logs);
    const unauthorized = await api.fetch(new Request('https://fixture.invalid/api/exams?debug=1'), {}, {});
    assert.equal(unauthorized.status, 401);
  }
});

test('API exam boundary drops unsafe new producer fields (synthetic producer, actual route/helper)', async () => {
  const { api, logs } = await load([], { './exam.js': { fetchExams: async () => ({
    exams: [{ id: 12345, name: EXAM_NAME }], extra: SECRET,
    debug: { status: 200, htmlLength: 123, isRedirect: false, htmlPreview: SECRET, exception: SECRET, error: SECRET,
      url: `https://fixture.invalid/?token=${SECRET}`, parseInfo: { matchCount: 1, sampleViewTestCalls: [SECRET], arbitrary: SECRET } }
  }) } });
  const result = await api.fetch(request('/api/exams?debug=1'), {}, {});
  assert.equal(result.status, 200); const body = await result.json();
  assert.deepEqual(body, { exams: [{ id: 12345, name: EXAM_NAME }], debug: { status: 200, htmlLength: 123, isRedirect: false, parseInfo: { matchCount: 1 } } });
  privateFree(body); privateFree(logs);
});

test('exam scalar allowlist rejects invalid types/ranges and arbitrary metadata', async () => {
  const { diagnostics } = await load();
  for (const debug of [null, SECRET, { status: SECRET, htmlLength: -1, error: SECRET, containsLogin: SECRET, parseInfo: { matchCount: Infinity, viewTestCalls: -1, hasTestId: SECRET } }]) {
    const result = diagnostics.sanitizeExamDebug(debug); privateFree(result);
    assert.ok(!Object.hasOwn(result, 'status')); assert.ok(!Object.hasOwn(result, 'error'));
  }
});

test('image proxy preserves exact bytes/content type/CORS/cache and sanitizes failure boundary', async () => {
  const bytes = new Uint8Array([0, 1, 127, 255]);
  const { api, logs, calls } = await load([response(bytes, 200, { 'Content-Type': 'image/png' })]);
  const result = await api.fetch(request('/api/proxy-image?url=https%3A%2F%2Ffixture.invalid%2Fimage'), {}, {});
  assert.equal(result.status, 200); assert.deepEqual(new Uint8Array(await result.arrayBuffer()), bytes);
  assert.equal(result.headers.get('Content-Type'), 'image/png');
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(result.headers.get('Cache-Control'), 'public, max-age=3600');
  assert.equal(calls[0][1].headers.Cookie, `JSESSIONID=${SECRET}`); privateFree(logs);
  for (const value of [new Error(SECRET), response(SECRET, 503)]) {
    const failed = await load([value]);
    const output = await failed.api.fetch(request('/api/proxy-image?url=https%3A%2F%2Ffixture.invalid%2Fimage'), {}, {});
    assert.equal(output.status, 500); privateFree(await output.json()); privateFree(failed.logs);
  }
});
