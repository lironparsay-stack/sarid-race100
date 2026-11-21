#!/usr/bin/env node
// Reads race100-videos.xlsx + data/pairs.json and writes data.js for the site.
// Usage:  npm run build      (or: node scripts/build-data.js)
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, readVideos, clean } = require('./lib');

const PAIRS_FILE = path.join(ROOT, 'data', 'pairs.json');
const OUT_FILE = path.join(ROOT, 'data.js');
const HERO_CANDIDATES = ['assets/hero.jpg', 'assets/hero.jpeg', 'assets/hero.png', 'assets/hero.webp'];

const exists = rel => fs.existsSync(path.join(ROOT, rel));

// Thumbnail priority: path from the Excel column (relative to assets/), then assets/thumbs/NN.jpg.
function findThumb(v) {
  const candidates = [];
  if (v.thumbHint) {
    const hint = v.thumbHint.replace(/\\/g, '/').replace(/^\.?\//, '');
    candidates.push(hint.startsWith('assets/') ? hint : `assets/${hint}`);
  }
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) candidates.push(`assets/thumbs/${v.key}.${ext}`);
  return candidates.find(exists) || null;
}

function readPairs() {
  if (!fs.existsSync(PAIRS_FILE)) return [];
  let list;
  try {
    list = JSON.parse(fs.readFileSync(PAIRS_FILE, 'utf8'));
  } catch (e) {
    throw new Error(`שגיאה בקובץ data/pairs.json (JSON לא תקין): ${e.message}`);
  }
  return list
    .filter(p => p && clean(p.team))
    .map((p, i) => ({
      num: i + 1,
      team: clean(p.team),
      members: Array.isArray(p.members) ? p.members.map(clean).filter(Boolean) : [],
      youtubeId: clean(p.youtubeId),
    }));
}

function main() {
  const videos = readVideos();
  const out = { A: [], B: [], auditions: [] };
  const warnings = [];

  for (const v of videos) {
    const item = {
      num: v.num,
      title: v.title,
      meta: v.meta,
      desc: v.desc,
      duration: v.duration,
      driveId: v.driveId || null,
      thumb: findThumb(v),
    };
    if (!v.part) warnings.push(`סרטון ${v.num}: עמודת "חלק" ריקה או לא מזוהה, שויך לחלק א'`);
    out[v.part || 'A'].push(item);
  }

  const hero = HERO_CANDIDATES.find(exists) || null;
  const pairs = readPairs();

  const data = {
    generatedAt: new Date().toISOString(),
    hero,
    partA: out.A,
    partB: out.B,
    auditions: out.auditions,
    pairs,
  };

  const js =
    '// קובץ זה נוצר אוטומטית על ידי scripts/build-data.js. אל תערכו אותו ידנית.\n' +
    '// לעדכון: ערכו את race100-videos.xlsx או data/pairs.json והריצו: npm run update\n' +
    'window.RACE_DATA = ' + JSON.stringify(data, null, 2) + ';\n';
  fs.writeFileSync(OUT_FILE, js, 'utf8');

  const all = [...out.A, ...out.B, ...out.auditions];
  const withId = all.filter(v => v.driveId).length;
  const withThumb = all.filter(v => v.thumb).length;
  console.log(`נכתב data.js:`);
  console.log(`  חלק א': ${out.A.length} סרטונים · חלק ב': ${out.B.length} · אודישנים: ${out.auditions.length}`);
  console.log(`  עם קישור דרייב: ${withId}/${all.length} · עם תמונה ממוזערת: ${withThumb}/${all.length}`);
  console.log(`  זוגות: ${pairs.length} · תמונת רקע: ${hero || 'אין (ישמש גרדיאנט / תמונה ממוזערת)'}`);
  for (const w of warnings) console.warn('  אזהרה: ' + w);
}

try {
  main();
} catch (e) {
  console.error('שגיאה: ' + e.message);
  process.exit(1);
}
