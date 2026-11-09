// Only source-issued session and backend-affinity cookies are retained.
// Values never leave the sealed portal session or a source-origin request.
const names = new Set(['JSESSIONID', 'DWRSESSIONID', 'SERVERID']);
function pair(raw) {
  const first = raw.split(';', 1)[0];
  const at = first.indexOf('=');
  if (at < 1) return null;
  const name = first.slice(0, at).trim(), value = first.slice(at + 1);
  if (!names.has(name) || !/^[\x21-\x7e]{1,512}$/.test(value) || /[;,"\\]/.test(value)) return null;
  return [name, value];
}
export function updateCookieJar(jar, headers) {
  const values = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : headers.getAll('Set-Cookie');
  for (const value of values) { const parsed = pair(value); if (parsed) jar.set(...parsed); }
  return jar;
}
export function mergeSourceCookies(previous, headers) {
  const jar = new Map(previous.split(';').map(x => pair(x.trim())).filter(Boolean));
  updateCookieJar(jar, headers);
  return [...jar].map(([key, value]) => `${key}=${value}`).join('; ');
}
export const hasAffinity = cookies => /(?:^|;\s*)SERVERID=[^;]+/.test(cookies);
