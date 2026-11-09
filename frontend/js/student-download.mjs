import { zipBlob, safeName } from './student-export.mjs';
const encode = text => new TextEncoder().encode(text);
const csv = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
export function ownPath(value) {
  if (typeof value !== 'string' || !/^\/api\/student\/(?:exam|exam-data|subject|subject-images-data|asset)\?ticket=[A-Za-z0-9_.~-]+(?:&download=1)?$/.test(value)) throw Error('invalid_source_handle');
  return value;
}
export function cleanScores(data) {
  return { subjects: data.subjects.map(s => ({ id: s.id ?? null, name: s.name, score: s.score, maxScore: s.maxScore, rate: s.rate, level: s.level })), totals: data.totals };
}
export function extractDocument(html, parse = text => new DOMParser().parseFromString(text, 'text/html')) {
  const doc = parse(html);
  const tables = [...doc.querySelectorAll('table')].map(table => [...table.rows].map(row => [...row.cells].map(cell => cell.textContent.trim())));
  const assets = [...new Set([...doc.querySelectorAll('img[src]')].map(img => img.getAttribute('src')).filter(url => /^\/api\/student\/asset\?ticket=/.test(url)))];
  for (const el of doc.querySelectorAll('script,style,link,nav')) el.remove();
  const text = doc.body.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
  return { doc, text, tables, assets };
}
export async function collectArchive(exams, { getGrades, request, signal, onProgress = () => {}, maxBytes = 256 * 1024 * 1024, parse } = {}) {
  const manifest = { format: 'paper-ai-export-v2', generatedAt: new Date().toISOString(), scope: exams.length === 1 ? 'exam' : 'all-history', requestedExams: exams.length, source: 'authenticated_student_source', complete: true, exams: [], failures: [], files: [] };
  const entries = [], scores = [['exam_index','exam','subject_id','subject','score','max_score','rate','level']];
  let total = 0, stopped = false;
  const add = (name, value) => {
    const bytes = typeof value === 'string' ? encode(value) : value;
    if (total + bytes.length > maxBytes) throw Error('archive_size_limit');
    total += bytes.length; entries.push({ name, bytes }); manifest.files.push({ path: name, bytes: bytes.length });
  };
  const failure = (path, error) => {
    const code = error.code || (/^[a-z_]+$/.test(error.message) ? error.message : 'source_unavailable');
    manifest.failures.push({ path, code }); manifest.complete = false;
    if (['session_expired','session_rejected','source_rate_limited','archive_size_limit'].includes(code)) stopped = true;
  };
  const check = () => { signal?.throwIfAborted(); if (stopped) throw Error('not_attempted_after_failure'); };
  async function report(url, folder) {
    check(); const response = await request(ownPath(url), { signal });
    const { doc, text, tables, assets } = extractDocument(await response.text(), parse);
    const paths = new Map();
    for (const [i, asset] of assets.entries()) {
      check();
      try { const file = await image(asset, `${folder}/chart-${i + 1}`); paths.set(asset, file.split('/').at(-1)); }
      catch (error) { if (signal?.aborted) throw error; failure(`${folder}/chart-${i + 1}`, error); }
    }
    for (const el of doc.querySelectorAll('[src],[href]')) {
      if (el.tagName === 'IMG' && paths.has(el.getAttribute('src'))) el.setAttribute('src', paths.get(el.getAttribute('src')));
      else { el.removeAttribute('src'); el.removeAttribute('href'); }
    }
    add(`${folder}/report.json`, JSON.stringify({ text, tables, chartFiles: [...paths.values()] }, null, 2));
    add(`${folder}/report.txt`, text);
    add(`${folder}/report.html`, '<!doctype html>\n' + doc.documentElement.outerHTML);
  }
  async function image(url, path) {
    check(); const response = await request(ownPath(url), { signal });
    const type = response.headers.get('content-type')?.split(';')[0];
    const extension = { 'image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp' }[type];
    if (!extension) throw Error('invalid_image');
    if (Number(response.headers.get('content-length')) > 25 * 1024 * 1024) throw Error('image_too_large');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 25 * 1024 * 1024 || !bytes.length) throw Error('invalid_image');
    const name = `${path}.${extension}`; add(name, bytes); return name;
  }
  for (const [index, exam] of exams.entries()) {
    signal?.throwIfAborted();
    const folder = `${String(index + 1).padStart(2,'0')}_${safeName(exam.title)}`;
    const item = { index: index + 1, title: exam.title, folder, status: 'pending', subjects: [] }; manifest.exams.push(item);
    onProgress({ exam: index + 1, exams: exams.length, title: exam.title, stage: '成绩', bytes: total });
    try {
      check(); const data = await getGrades(exam, signal);
      add(`${folder}/scores.json`, JSON.stringify(cleanScores(data), null, 2)); item.status = 'grades_downloaded';
      for (const s of data.subjects) scores.push([index + 1, exam.title, s.id, s.name, s.score, s.maxScore, s.rate, s.level]);
      try { await report(data.reportUrl, `${folder}/full-report`); } catch (error) { if (signal?.aborted) throw error; failure(`${folder}/full-report`, error); }
      for (const [j, subject] of data.subjects.entries()) {
        check(); const dir = `${folder}/${String(j + 1).padStart(2,'0')}_${safeName(subject.name)}`;
        onProgress({ exam: index + 1, exams: exams.length, title: exam.title, stage: subject.name, bytes: total });
        const state = { name: subject.name, pages: [], report: 'pending' }; item.subjects.push(state);
        try { await report(subject.reportUrl, `${dir}/report`); state.report = 'downloaded'; } catch (error) { if (signal?.aborted) throw error; state.report = 'unavailable'; failure(`${dir}/report`, error); }
        try {
          check(); const response = await request(ownPath(subject.imagesDataUrl || subject.imagesUrl.replace('/subject-images?', '/subject-images-data?')), { signal });
          const images = await response.json(); state.sourcePages = images.pages.length;
          for (const page of images.pages) {
            try { state.pages.push({ order: page.order, path: await image(page.url, `${dir}/answers/page-${String(page.order).padStart(2,'0')}`) }); }
            catch (error) { if (signal?.aborted) throw error; failure(`${dir}/answers/page-${page.order}`, error); }
          }
        } catch (error) { if (signal?.aborted) throw error; failure(`${dir}/answers`, error); }
      }
    } catch (error) { if (signal?.aborted) throw error; item.status = 'incomplete'; failure(folder, error); }
  }
  // Leave a little room for the index even when source assets hit the bound.
  const index = JSON.stringify(manifest, null, 2), csvText = scores.map(row => row.map(csv).join(',')).join('\r\n');
  entries.push({name:'manifest.json',bytes:encode(index)},{name:'scores.csv',bytes:encode(csvText)},
    {name:'README.txt',bytes:encode('UTF-8. Start with manifest.json and scores.csv. Null or empty scores mean unpublished/unknown, never zero. Each exam contains scores.json; each report contains text and tables in report.json, report.txt and HTML, plus source chart images. answers/ contains original source-resolution images without resizing. Check complete and failures before analysis. Report data represents only information currently provided by the source. No credentials or session links are included. CSV is machine-oriented; JSON is authoritative.')});
  return { blob: zipBlob(entries), manifest };
}
