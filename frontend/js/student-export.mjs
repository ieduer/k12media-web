/* Source-only export: all bytes live in this tab until the user saves a ZIP.
 * No localStorage, IndexedDB, service worker, analytics, or AI upload.
 * ZIP volumes stay below 64 MiB so mobile browsers never buffer all history.
 */
const encoder = new TextEncoder();
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = (n & 1) ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
export function safeName(value) {
  const out = String(value).normalize('NFC').replace(/[\\/\x00-\x1f\x7f:*?"<>|]/g, '_')
    .replace(/\.{2,}/g, '_').replace(/^\.+|[. ]+$/g, '').slice(0, 80);
  return out || '未命名';
}
function header(size) {
  const bytes = new Uint8Array(size), view = new DataView(bytes.buffer);
  return { bytes, u16: (offset, value) => view.setUint16(offset, value, true),
    u32: (offset, value) => view.setUint32(offset, value, true) };
}
// Uncompressed ZIP, UTF-8 names and CRC32. Never crosses ZIP32 size/count limits.
export function zipBlob(entries) {
  const parts = [], directory = [], names = new Set(); let offset = 0, centralSize = 0;
  if (entries.length > 65535) throw new Error('zip_entry_limit');
  for (const { name, bytes } of entries) {
    if (!(bytes instanceof Uint8Array) || name.startsWith('/') || name.split('/').some(p => !p || p === '..') || names.has(name)) throw new Error('invalid_zip_entry');
    names.add(name);
    const path = encoder.encode(name), crc = crc32(bytes), local = header(30), central = header(46);
    if (path.length > 65535 || bytes.length + offset >= 0xffffffff) throw new Error('zip_size_limit');
    local.u32(0, 0x04034b50); local.u16(4, 20); local.u16(6, 0x800); local.u16(12, 33);
    local.u32(14, crc); local.u32(18, bytes.length); local.u32(22, bytes.length); local.u16(26, path.length);
    central.u32(0, 0x02014b50); central.u16(4, 20); central.u16(6, 20); central.u16(8, 0x800); central.u16(14, 33);
    central.u32(16, crc); central.u32(20, bytes.length); central.u32(24, bytes.length); central.u16(28, path.length); central.u32(42, offset);
    parts.push(local.bytes, path, bytes); directory.push(central.bytes, path);
    offset += 30 + path.length + bytes.length; centralSize += 46 + path.length;
  }
  if (offset + centralSize >= 0xffffffff) throw new Error('zip_size_limit');
  const end = header(22); end.u32(0, 0x06054b50); end.u16(8, entries.length); end.u16(10, entries.length);
  end.u32(12, centralSize); end.u32(16, offset);
  return new Blob([...parts, ...directory, end.bytes], { type: 'application/zip' });
}
export class ExportError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export async function readImage(path, { signal, fetcher = fetch, maxBytes = 32 * 1024 * 1024 } = {}) {
  // Only opaque, session-bound application image handles are accepted.
  if (!/^\/api\/student\/images\/[A-Za-z0-9_-]{16,4096}$/.test(path)) throw new ExportError('invalid_image_handle');
  for (let attempt = 0; attempt < 2; attempt++) {
    signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(30000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response;
    try { response = await fetcher(path, { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: combined }); }
    catch (error) {
      if (signal?.aborted) throw new ExportError('cancelled');
      if (attempt === 0) continue;
      throw new ExportError('network_failed');
    }
    if ([401, 403].includes(response.status)) { await response.body?.cancel(); throw new ExportError('session_rejected'); }
    if ([502, 503, 504].includes(response.status) && attempt === 0) { await response.body?.cancel(); continue; }
    if (!response.ok) { await response.body?.cancel(); throw new ExportError('source_unavailable'); }
    const type = (response.headers.get('content-type') || '').split(';')[0];
    const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    if (!extensions[type] || !response.body) { await response.body?.cancel(); throw new ExportError('invalid_image'); }
    if (Number(response.headers.get('content-length')) > maxBytes) { await response.body.cancel(); throw new ExportError('image_too_large'); }
    const reader = response.body.getReader(), chunks = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > maxBytes) throw new ExportError('image_too_large');
        chunks.push(value);
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error instanceof ExportError ? error : new ExportError('image_interrupted'); }
    finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const valid = type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : type === 'image/png' ? bytes.slice(0, 8).every((b, i) => b === [137,80,78,71,13,10,26,10][i]) && size >= 8
      : size >= 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
    if (!valid) throw new ExportError('invalid_image');
    return { bytes, extension: extensions[type] };
  }
}
function textEntry(name, value) { return { name, bytes: encoder.encode(value) }; }
function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export async function exportExams(exams, { saveVolume, fetcher, signal, onProgress = () => {}, volumeBytes = 64 * 1024 * 1024,
  scope = 'selected', catalogueComplete = scope === 'selected' } = {}) {
  if (typeof saveVolume !== 'function' || volumeBytes < 1024 || volumeBytes > 256 * 1024 * 1024) throw new ExportError('invalid_export_options');
  if (!['selected','latest','all-history'].includes(scope)) throw new ExportError('invalid_export_scope');
  const manifest = { format: 'paper-student-export-v1', generatedAt: new Date().toISOString(), source: '本人源站会话',
    scope, catalogueComplete: catalogueComplete === true, requestedExamCount: Array.isArray(exams) ? exams.length : null,
    completeness: 'source_available_only', exams: [], volumes: [], failures: [] };
  const scores = [['考试标识','考试','科目标识','科目','成绩','满分','源站状态']];
  let entries = [], bytes = 0, volume = 0, stopped = false;
  async function flush() {
    if (!entries.length) return;
    const name = `exam-export-${String(++volume).padStart(3,'0')}.zip`;
    const listing = entries.map(x => ({ path: x.name, bytes: x.bytes.length, crc32: crc32(x.bytes).toString(16).padStart(8,'0') }));
    const blob = zipBlob([...entries, textEntry('volume.json', JSON.stringify({ volume, files: listing }, null, 2))]);
    await saveVolume(blob, name); // Await actual user save; rejected/blocked saves abort.
    manifest.volumes.push({ name, files: listing }); entries = []; bytes = 0;
  }
  const seen = new Set();
  for await (const exam of exams) {
    if (signal?.aborted) { stopped = true; break; }
    if (!exam || !String(exam.id) || seen.has(String(exam.id))) throw new ExportError('duplicate_or_invalid_exam');
    seen.add(String(exam.id));
    const record = { id: String(exam.id), name: String(exam.name), date: exam.date || null, status: exam.status || 'unknown', subjects: [] };
    manifest.exams.push(record); const subjects = new Set();
    for (const subject of exam.subjects) {
      if (subjects.has(String(subject.id))) throw new ExportError('duplicate_subject'); subjects.add(String(subject.id));
      const result = { id: String(subject.id), name: String(subject.name), score: subject.score ?? null, fullScore: subject.fullScore ?? null,
        status: subject.status || 'unknown', expectedPages: subject.expectedPages ?? null, pages: [] };
      record.subjects.push(result); scores.push([record.id,record.name,result.id,result.name,result.score,result.fullScore,result.status]);
      const orders = new Set();
      for (const page of subject.pages || []) {
        if (!Number.isSafeInteger(page.order) || page.order < 1 || orders.has(page.order)) throw new ExportError('invalid_page_order'); orders.add(page.order);
        const p = { order: page.order, status: 'pending' }; result.pages.push(p);
        if (stopped || signal?.aborted) { p.status = stopped ? 'not_attempted' : 'cancelled'; continue; }
        try {
          const data = await readImage(page.downloadPath, { signal, fetcher, maxBytes: Math.min(volumeBytes - 1024, 32 * 1024 * 1024) });
          if (bytes + data.bytes.length + 2048 > volumeBytes) await flush();
          const path = `${String(manifest.exams.length).padStart(4,'0')}_${safeName(record.id)}_${safeName(record.name)}/${String(record.subjects.length).padStart(2,'0')}_${safeName(result.id)}_${safeName(result.name)}/page-${String(page.order).padStart(4,'0')}.${data.extension}`;
          entries.push({ name: path, bytes: data.bytes }); bytes += data.bytes.length + 2048;
          p.status = 'downloaded'; p.path = path; p.bytes = data.bytes.length;
        } catch (error) {
          if (!(error instanceof ExportError)) throw error; // Includes failed user saves.
          p.status = error.code; manifest.failures.push({ exam: record.id, subject: result.id, page: p.order, reason: error.code });
          if (error.code === 'session_rejected' || error.code === 'cancelled') stopped = true;
        }
        onProgress({ exam: record.name, subject: result.name, page: p.order, status: p.status, volume: volume + 1 });
      }
      result.allAvailablePagesDownloaded = result.pages.length > 0 && result.pages.every(p => p.status === 'downloaded');
      result.complete = Number.isSafeInteger(result.expectedPages) && result.expectedPages > 0 && result.pages.length === result.expectedPages
        && result.allAvailablePagesDownloaded && [...orders].sort((a,b)=>a-b).every((n,i)=>n === i + 1);
    }
    if (stopped) break;
  }
  await flush();
  manifest.interrupted = stopped || Boolean(signal?.aborted);
  manifest.complete = manifest.catalogueComplete && !manifest.interrupted && manifest.exams.length > 0 && manifest.exams.every(e => e.status === 'complete' && e.subjects.length > 0 && e.subjects.every(s => s.complete && s.status === 'complete'));
  const info = '个人考试导出\n图片与成绩均读取自本人源站会话，仅在浏览器打包。\n未自动上传到任何 AI。请自行选择可信的工具。\n按考试/科目/页序存放；manifest.json 列出状态与缺页。\n分卷 ZIP 必须全部保存，并与本索引放在一起。\ncomplete=false 或 expectedPages=null 时不可视为整卷完整。\n源站未发布、未完成或缺失的资料无法由本站补齐。\n';
  await saveVolume(zipBlob([textEntry('manifest.json', JSON.stringify(manifest,null,2)), textEntry('scores.csv', '\ufeff'+scores.map(row=>row.map(csvCell).join(',')).join('\r\n')),textEntry('README.txt',info)]), 'exam-export-index.zip');
  return manifest;
}
