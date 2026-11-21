// Shared helpers: read the video list from the Excel file.
'use strict';
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const XLSX_FILE = path.join(ROOT, 'race100-videos.xlsx');
const THUMBS_DIR = path.join(ROOT, 'assets', 'thumbs');

// Header labels in the Excel file -> field names.
// Matching is by "starts with", so small edits to a header (e.g. adding "(mm:ss)") still work.
const COLUMNS = {
  num: "מס'",
  file: 'שם קובץ',
  title: 'כותרת לתצוגה',
  meta: 'שורת מטא',
  part: 'חלק',
  desc: 'תיאור קצר',
  duration: 'משך',
  driveLink: 'קישור דרייב',
  youtubeLink: 'קישור יוטיוב',
  thumb: 'קובץ תמונה ממוזערת',
  notes: 'הערות',
};

function clean(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

// Accepts a Drive share link in any common form, or a bare file ID.
function extractDriveId(link) {
  const s = clean(link);
  if (!s) return '';
  let m = s.match(/\/d\/([A-Za-z0-9_-]{10,})/);           // .../file/d/ID/view
  if (m) return m[1];
  m = s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);             // ...open?id=ID / uc?id=ID
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(s)) return s;           // bare ID pasted directly
  return '';
}

// Accepts youtube.com/watch?v=ID, youtu.be/ID, /shorts/ID, /embed/ID, /live/ID, or a bare 11-char ID.
function extractYouTubeId(link) {
  const s = clean(link);
  if (!s) return '';
  let m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  m = s.match(/(?:youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return '';
}

// Duration: accepts "3:16", "03:16", "1:02:03", or an Excel time value (fraction of a day).
function normalizeDuration(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    const total = Math.round(v < 1 ? v * 86400 : v);
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }
  return clean(v);
}

// "חלק א'" -> A, "חלק ב'" -> B, anything mentioning אודישן -> auditions.
function normalizePart(v) {
  const s = clean(v);
  if (/אודישן/.test(s)) return 'auditions';
  if (/ב['׳]?\s*$/.test(s) || /חלק\s*ב/.test(s)) return 'B';
  if (/א['׳]?\s*$/.test(s) || /חלק\s*א/.test(s)) return 'A';
  return '';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function readVideos() {
  if (!fs.existsSync(XLSX_FILE)) {
    throw new Error(`לא נמצא קובץ האקסל: ${XLSX_FILE}`);
  }
  const wb = XLSX.readFile(XLSX_FILE, { cellFormula: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  // Find the header row (the one whose first cell is "מס'").
  const headerIdx = rows.findIndex(r => r && clean(r[0]).replace(/[׳’]/g, "'") === COLUMNS.num);
  if (headerIdx < 0) throw new Error("לא נמצאה שורת הכותרות (עמודה A = \"מס'\") באקסל");
  const header = rows[headerIdx].map(clean);
  const col = {};
  for (const [key, label] of Object.entries(COLUMNS)) {
    col[key] = header.findIndex(h => h.startsWith(label));
  }
  // "חלק" also prefixes nothing else today, but make sure we didn't grab a wrong column.
  for (const k of ['num', 'title', 'part']) {
    if (col[k] < 0) throw new Error(`חסרה עמודה באקסל: ${COLUMNS[k]}`);
  }
  const get = (r, k) => (col[k] >= 0 ? r[col[k]] : null);

  const videos = [];
  for (const r of rows.slice(headerIdx + 1)) {
    if (!r) continue;
    const num = parseInt(clean(get(r, 'num')), 10);
    const title = clean(get(r, 'title'));
    if (!num || !title) continue; // skip empty / note rows
    videos.push({
      num,
      key: pad2(num),
      file: clean(get(r, 'file')),
      title,
      meta: clean(get(r, 'meta')),
      part: normalizePart(get(r, 'part')),
      desc: clean(get(r, 'desc')),
      duration: normalizeDuration(get(r, 'duration')),
      driveId: extractDriveId(get(r, 'driveLink')),
      youtubeId: extractYouTubeId(get(r, 'youtubeLink')),
      thumbHint: clean(get(r, 'thumb')),
    });
  }
  videos.sort((a, b) => a.num - b.num);
  return videos;
}

module.exports = { ROOT, XLSX_FILE, THUMBS_DIR, readVideos, extractDriveId, extractYouTubeId, pad2, clean };
