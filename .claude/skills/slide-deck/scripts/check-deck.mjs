#!/usr/bin/env node
// 덱 JSON을 앱과 같은 규칙(app/deck-spec.js의 sanitize)으로 검사한다.
// 사용법: node .claude/skills/slide-deck/scripts/check-deck.mjs decks/<파일>.json
// 종료 코드: 0 통과(경고 있을 수 있음), 1 앱이 열 수 없는 덱
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const file = process.argv[2];
if (!file) { console.error('사용법: node check-deck.mjs <덱.json>'); process.exit(1); }

const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'app/deck-spec.js'), 'utf8'), ctx);
const { TYPES, sanitize, FIELDS } = ctx.DeckSpec;

// app/style.css 의 글자 크기와 줄 간격. CSS를 바꾸면 여기도 맞춘다.
const STYLE = {
  'title-xl': [82, 1.5], 'title-l': [68, 1.3], 'title-m': [64, 1.3], 'body-l': [44, 1.5],
  'body-m': [36, 1.5], sub: [34, 1.4], name: [28, 1.4], num: [150, 1.1], bubble: [44, 1.5],
};
const FIT_MIN = 0.55;

let raw;
try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error(`✘ JSON을 읽지 못함: ${e.message}`); process.exit(1); }

let deck;
try { deck = sanitize(raw); }
catch (e) { console.error(`✘ 앱이 열 수 없는 덱: ${e.message}`); process.exit(1); }

const warns = [];
raw.slides.forEach((s, i) => {
  const no = `${i + 1}번(${TYPES[s.type].label})`;
  // 버려지는 값 알림
  for (const k of Object.keys(s)) if (!['type', 'stickers', ...FIELDS].includes(k)) warns.push(`${no}: 알 수 없는 칸 "${k}"는 무시됨`);
  const kept = deck.slides[i].stickers.length, given = Array.isArray(s.stickers) ? s.stickers.length : 0;
  if (kept < given) warns.push(`${no}: 스티커 ${given - kept}개는 허용 목록에 없어 빠짐 (app/deck-spec.js STICKERS 확인)`);

  // 이 형태가 쓰는 칸과 높이 (stack은 묶음 전체 높이를 나눠 쓴다)
  const boxes = [];
  for (const it of TYPES[s.type].items) {
    if (it.k === 'text') boxes.push({ h: it.h, w: it.w, texts: [it] });
    if (it.k === 'stack') boxes.push({ h: it.h, w: it.w, gap: it.gap * (it.items.length - 1), texts: it.items });
  }
  const used = new Set(boxes.flatMap(b => b.texts.map(t => t.field)));
  for (const f of FIELDS) if (typeof s[f] === 'string' && !used.has(f)) warns.push(`${no}: "${f}" 칸은 이 형태에 없어서 화면에 안 나옴`);
  for (const b of boxes) {
    // 한글 한 글자 폭을 글자 크기만큼으로 어림한다 (실제보다 약간 넉넉하게 계산됨)
    const need = k => b.texts.reduce((sum, t) => {
      const [size, lh] = STYLE[t.cls]; const perLine = Math.max(1, Math.floor(b.w / (size * k)));
      const lines = String(s[t.field] ?? '').split('\n').reduce((n, l) => n + Math.max(1, Math.ceil([...l].length / perLine)), 0);
      return sum + lines * size * k * lh;
    }, b.gap || 0);
    const names = b.texts.map(t => t.field).join('+');
    if (need(FIT_MIN) > b.h) warns.push(`${no}: "${names}" 글이 너무 길어 최소 크기로 줄여도 넘침 → 나누거나 줄이기`);
    else if (need(1) > b.h) warns.push(`${no}: "${names}" 글이 길어 글자가 자동으로 작아짐`);
  }
});

console.log(`✔ 앱이 열 수 있는 덱: ${deck.slides.length}장`);
for (const w of warns) console.log(`  ⚠ ${w}`);
process.exit(0);
