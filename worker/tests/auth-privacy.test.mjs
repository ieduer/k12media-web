// Real source evaluated with an explicitly synthetic CryptoJS dependency.
// This verifies privacy/control flow, not encryption, upstream auth or runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const SECRET = 'SYNTHETIC_PRIVATE_SENTINEL';
const USER_ID = '987654321';
const sourceRoot = new URL('../src/', import.meta.url);
const source = Object.fromEntries(await Promise.all(['auth.js', 'diagnostics.js', 'index.js'].map(async name => [name, await fs.readFile(new URL(name, sourceRoot), 'utf8')])));

async function load(queue = []) {
  const logs = [], calls = [];
  const context = vm.createContext({
    URL, URLSearchParams, Response, Headers, Date,
    console: Object.fromEntries(['log', 'error', 'info', 'warn'].map(name => [name, (...args) => logs.push(args)])),
    fetch: async (...args) => {
      calls.push(args);
      assert.ok(queue.length, 'Unexpected fetch: no network fallback exists');
      const result = queue.shift();
      if (result instanceof Error) throw result;
      return result;
    }
  });
  const cache = new Map();
  function synthetic(name, exports) {
    const module = new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context, identifier: name });
    cache.set(name, module); return module;
  }
  synthetic('crypto-js', { default: {
    enc: { Utf8: { parse: value => value } }, mode: { ECB: {} }, pad: { Pkcs7: {} },
    AES: { encrypt: value => ({ toString: () => `mock-encrypted(${value})` }) }
  } });
  synthetic('./dwr.js', Object.fromEntries(['fetchAllStudents', 'findStudent', 'findStudentByNo'].map(name => [name, () => { throw new Error('Unused mocked dependency'); }])));
  synthetic('./image.js', { fetchStudentImages() {}, proxyImage() {} });
  synthetic('./exam.js', { fetchExams() {} });
  for (const [name, code] of Object.entries(source)) {
    cache.set(`./${name}`, new vm.SourceTextModule(code, { context, identifier: name }));
  }
  const linker = name => { assert.ok(cache.has(name), 'Unexpected import'); return cache.get(name); };
  await cache.get('./index.js').link(linker);
  await cache.get('./index.js').evaluate();
  return { auth: cache.get('./auth.js').namespace, api: cache.get('./index.js').namespace.default,
    diagnostics: cache.get('./diagnostics.js').namespace, logs, calls };
}
function response(body = '', status = 200, headers = {}) { return new Response(body, { status, headers }); }
function successQueue() { return [
  response('', 200, { 'Set-Cookie': `JSESSIONID=${SECRET}-sso; HttpOnly` }),
  response(`dwr.engine._dwrSessionId = "${SECRET}-dwr";`),
  response(`{userId:${USER_ID},schoolName:"${SECRET}"}`),
  response('', 302, { Location: `https://fixture.invalid/callback?token=${SECRET}` }),
  response('', 200, { 'Set-Cookie': `JSESSIONID=${SECRET}-session; HttpOnly` }),
  response(`dwr.engine._dwrSessionId = "${SECRET}-main";`)
]; }
function privateFree(value) {
  const text = JSON.stringify(value);
  for (const sentinel of [SECRET, USER_ID, 'mock-encrypted', 'token=']) assert.ok(!text.includes(sentinel), 'Private synthetic value escaped');
}

test('successful auth preserves cookie response while all telemetry is private-free', async () => {
  const { auth, logs, calls } = await load(successQueue());
  const result = await auth.ssoLogin(`${SECRET}-username`, `${SECRET}-password`);
  assert.equal(result.success, true);
  assert.equal(result.cookie, `JSESSIONID=${SECRET}-session; DWRSESSIONID=${SECRET}-main`);
  assert.deepEqual(Object.keys(result).sort(), ['cookie', 'message', 'success']);
  assert.equal(calls.length, 6);
  assert.equal(calls[2][1].method, 'POST');
  assert.ok(calls[2][1].body.includes(`mock-encrypted(${SECRET}-password)`));
  assert.ok(calls[3][1].body.includes(encodeURIComponent(`${SECRET}-username`)));
  privateFree(logs);
});

test('each upstream error is sanitized; optional main engine failure remains non-fatal', async () => {
  for (let step = 0; step < 6; step++) {
    const queue = successQueue(); queue[step] = new Error(`${SECRET} cookie=private https://fixture.invalid/?token=private`);
    const { auth, logs } = await load(queue);
    const result = await auth.ssoLogin(SECRET, SECRET);
    assert.equal(result.success, step === 5);
    privateFree(logs);
    if (!result.success) { privateFree(result); assert.deepEqual(Object.keys(result).sort(), ['error', 'success']); }
  }
});

test('DWR parse failure, upstream rejection and missing token never reflect upstream text', async () => {
  for (const kind of ['dwr', 'dwr-status', 'html', 'http', 'token']) {
    const queue = successQueue();
    if (kind === 'dwr') queue[2] = response(SECRET);
    if (kind === 'dwr-status') queue[2] = response(SECRET, 503);
    if (kind === 'html') queue[3] = response(`<font color="red">password ${SECRET}</font>`);
    if (kind === 'http') queue[3] = response(SECRET, 503);
    if (kind === 'token') queue[3] = response('', 302, { Location: `https://fixture.invalid/${SECRET}` });
    const { auth, logs } = await load(queue);
    const result = await auth.ssoLogin(SECRET, SECRET);
    assert.equal(result.success, false); privateFree(result); privateFree(logs);
  }
});

test('missing auth cookies retains a fixed failure schema', async () => {
  const queue = successQueue(); queue[4] = response();
  const { auth, logs } = await load(queue);
  const result = await auth.ssoLogin(SECRET, SECRET);
  assert.equal(result.success, false); privateFree(result); privateFree(logs);
});

test('cookie validation success/expiry/error retains valid/message shape', async () => {
  for (const [value, valid] of [[response('viewTest'), true], [response('', 302, { Location: '/login' }), false], [new Error(SECRET), false]]) {
    const { auth, logs } = await load([value]); const result = await auth.validateCookie(SECRET);
    assert.equal(result.valid, valid); assert.deepEqual(Object.keys(result).sort(), ['message', 'valid']);
    privateFree(result); privateFree(logs);
  }
});

test('API boundary sanitizes JSON/parser errors while preserving 500 and normal 400 validation', async () => {
  const { api, logs } = await load();
  const request = { method: 'POST', url: 'https://fixture.invalid/api/login', json: async () => { throw new Error(SECRET); } };
  const failed = await api.fetch(request, {}, {});
  assert.equal(failed.status, 500); privateFree(await failed.json()); privateFree(logs);
  const invalid = await api.fetch({ ...request, json: async () => ({}) }, {}, {});
  assert.equal(invalid.status, 400); privateFree(await invalid.json());
});

test('diagnostic event allowlist refuses arbitrary strings and objects without serialization', async () => {
  const { diagnostics, logs } = await load();
  diagnostics.reportDiagnostic(SECRET);
  diagnostics.reportDiagnostic({ toString() { throw new Error('must not serialize'); } });
  assert.equal(logs.length, 2); privateFree(logs);
  assert.ok(logs.every(row => row[1].event === 'unexpected_error'));
});
