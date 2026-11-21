#!/usr/bin/env node
// Downloads a Drive thumbnail for every video that has a Drive ID and no local thumbnail yet.
// A thumbnail you put in assets/thumbs/NN.jpg yourself is never overwritten.
// Usage:  npm run thumbs     (or: node scripts/make-thumbs.js)
'use strict';
const fs = require('fs');
const path = require('path');
const { THUMBS_DIR, readVideos } = require('./lib');

const MIN_BYTES = 2000; // anything smaller is an error page / blank image, not a real frame

function hasLocalThumb(key) {
  return ['jpg', 'jpeg', 'png', 'webp'].some(ext => fs.existsSync(path.join(THUMBS_DIR, `${key}.${ext}`)));
}

async function download(id) {
  const url = `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w640`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) return { ok: false, reason: 'הקובץ כנראה לא משותף "לכל מי שיש לו את הקישור"' };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < MIN_BYTES) return { ok: false, reason: 'התקבלה תמונה ריקה' };
  return { ok: true, buf };
}

async function main() {
  if (typeof fetch !== 'function') {
    throw new Error('נדרשת גרסת Node 18 ומעלה');
  }
  fs.mkdirSync(THUMBS_DIR, { recursive: true });
  const videos = readVideos();
  let saved = 0, kept = 0, skipped = 0, failed = 0;

  for (const v of videos) {
    if (hasLocalThumb(v.key)) { kept++; continue; }
    if (v.youtubeId) { skipped++; continue; } // the site uses YouTube's own thumbnail
    if (!v.driveId) { skipped++; continue; }
    try {
      const r = await download(v.driveId);
      if (r.ok) {
        fs.writeFileSync(path.join(THUMBS_DIR, `${v.key}.jpg`), r.buf);
        console.log(`  ✓ ${v.key} ${v.title}`);
        saved++;
      } else {
        console.log(`  ✗ ${v.key} ${v.title}: ${r.reason}`);
        failed++;
      }
    } catch (e) {
      console.log(`  ✗ ${v.key} ${v.title}: ${e.message}`);
      failed++;
    }
  }
  console.log(`תמונות ממוזערות: ${saved} הורדו · ${kept} קיימות (לא נדרסו) · ${skipped} בלי קישור דרייב · ${failed} נכשלו`);
}

main().catch(e => {
  console.error('שגיאה: ' + e.message);
  process.exit(1);
});
