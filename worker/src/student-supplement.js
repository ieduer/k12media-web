// Candidate only; deliberately not imported by the public portal.
// Both inputs must come from server-side, authenticated adapters. In particular,
// a teacher adapter MUST verify a source-backed identity/exam/paper crosswalk
// before using TQWEB identifiers here. This merge cannot establish that mapping.
const scopeKeys = ['sessionNonce', 'schoolId', 'userId', 'testId'];
const present = value => value !== null && value !== undefined;
const number = value => typeof value === 'number' && Number.isFinite(value);
const score = value => number(value) && value >= 0;
const maximum = value => number(value) && value > 0;
const id = value => typeof value === 'string' && /^[1-9]\d{0,15}$/.test(value);
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 128;
function sameScope(a, b) {
  return a?.namespace === 'tqweb' && b?.namespace === 'tqweb' &&
    scopeKeys.every(key => typeof a[key] === 'string' && a[key] && a[key] === b[key]);
}
function subjectsValid(rows) {
  return Array.isArray(rows) && rows.length <= 100 &&
    rows.every(row => row && id(row.id)) && new Set(rows.map(row => row.id)).size === rows.length;
}
// Only already-issued portal capabilities may leave the teacher adapter. Never
// copy a source URL, token, roster, cookie, raw report, or additional student.
function portalLink(value, route) {
  if (typeof value !== 'string' || value.length > 32768) return false;
  try {
    const url = new URL(value, 'https://portal.invalid');
    return value.startsWith('/api/student/') && url.origin === 'https://portal.invalid' &&
      url.pathname === '/api/student/' + route && !url.hash &&
      !!url.searchParams.get('ticket') &&
      [...url.searchParams.keys()].every(key => key === 'ticket' || (route === 'asset' && key === 'download'));
  } catch { return false; }
}
function acceptedPages(value) {
  if (!Array.isArray(value) || !value.length || value.length > 40) return null;
  if (!value.every((page, i) => page?.order === i + 1 && portalLink(page.url, 'asset') &&
      portalLink(page.downloadUrl, 'asset'))) return null;
  return value.map(({order, url, downloadUrl}) => ({order, url, downloadUrl}));
}
function mergeSubject(own, teacher) {
  const out = {...own};
  const sourceScore = score(teacher.score) ? teacher.score : null;
  const sourceMax = maximum(teacher.maxScore) ? teacher.maxScore : null;
  const pairValid = sourceScore === null || sourceMax === null || sourceScore <= sourceMax;
  if (!present(out.score) && pairValid && sourceScore !== null &&
      (!present(out.maxScore) || (sourceMax === out.maxScore && sourceScore <= out.maxScore))) out.score = sourceScore;
  if (!present(out.maxScore) && pairValid && sourceMax !== null &&
      (!present(out.score) || (score(out.score) && out.score <= sourceMax))) out.maxScore = sourceMax;
  if (!present(out.level) && text(teacher.level)) out.level = teacher.level;
  if (!out.reportUrl && portalLink(teacher.reportUrl, 'subject')) out.reportUrl = teacher.reportUrl;
  // Do not mix page sets: their numbering alone does not prove the same physical
  // pages or edition. Preserve any student page set, including partial sets.
  if (!Array.isArray(out.pages) || !out.pages.length) {
    const pages = acceptedPages(teacher.pages);
    if (pages) out.pages = pages;
  }
  out.rate = score(out.score) && maximum(out.maxScore) ? out.score / out.maxScore : null;
  return out;
}
export function mergeStudentFirstExam(own, teacher) {
  if (!own || !sameScope(own.scope, teacher?.scope) ||
      !subjectsValid(own.subjects) || !subjectsValid(teacher.subjects)) return own;
  const byId = new Map(teacher.subjects.map(row => [row.id, row]));
  const subjects = own.subjects.map(row => byId.has(row.id) ? mergeSubject(row, byId.get(row.id)) : {...row});
  const known = new Set(subjects.map(row => row.id));
  for (const row of teacher.subjects) {
    if (known.has(row.id) || !text(row.name)) continue;
    const merged = mergeSubject({id: row.id, name: row.name, score: null, maxScore: null, level: null}, row);
    if (present(merged.score) || merged.reportUrl || merged.pages?.length) subjects.push(merged);
  }
  const scored = subjects.filter(row => score(row.score) && maximum(row.maxScore));
  return {...own, subjects, totals: {
    score: scored.reduce((sum, row) => sum + row.score, 0),
    maxScore: scored.reduce((sum, row) => sum + row.maxScore, 0),
    published: scored.length
  }};
}
