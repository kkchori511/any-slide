#!/usr/bin/env node
// 덱 JSON을 앱과 같은 규칙(app/deck-spec.js의 sanitize)으로 검사하고, 글자 넘침과 빈 공간을 어림해 알린다.
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
const { W, H, TYPES, FIELDS, sanitize, fieldsOf, textBoxes, placedObjects, stripMarkup, parseTable } = ctx.DeckSpec;

// app/style.css 의 글자 크기(--fs)와 줄 간격. CSS를 바꾸면 여기도 맞춘다.
const STYLE = {
  'title-xl': [82, 1.5], 'title-l': [68, 1.3], 'title-m': [64, 1.3], 'body-l': [44, 1.5], 'body-m': [36, 1.5],
  sub: [34, 1.4], name: [28, 1.4], num: [150, 1.1], bubble: [44, 1.5], head: [50, 1.3], card: [38, 1.5],
  statement: [76, 1.4], code: [36, 1.5], cell: [36, 1.4],
};
const FIT_MIN = 0.55;

let raw;
try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error(`✘ JSON을 읽지 못함: ${e.message}`); process.exit(1); }

let deck;
try { deck = sanitize(raw); }
catch (e) { console.error(`✘ 앱이 열 수 없는 덱: ${e.message}`); process.exit(1); }

// 한 줄의 폭을 어림한다: 한글 1em, 영문·숫자 0.58em, 공백 0.3em
const lineWidth = (s, size) => [...s].reduce((w, ch) => w + size * (/\s/.test(ch) ? 0.3 : ch.charCodeAt(0) < 0x1100 ? 0.58 : 1), 0);
const linesOf = (text, size, width) => String(text).split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(lineWidth(l, size) / width)), 0);

const warns = [];
raw.slides.forEach((s, i) => {
  const slide = deck.slides[i];
  const no = `${i + 1}번(${TYPES[s.type].label})`;
  // 버려지는 값 알림
  const known = ['type', 'stickers', 'count', 'img', 'transition', 'styles', 'layout', ...FIELDS];
  for (const k of Object.keys(s)) if (!known.includes(k)) warns.push(`${no}: 알 수 없는 칸 "${k}"는 무시됨`);
  const kept = slide.stickers.length, given = Array.isArray(s.stickers) ? s.stickers.length : 0;
  if (kept < given) warns.push(`${no}: 스티커 ${given - kept}개는 허용 목록에 없어 빠짐 (app/deck-spec.js STICKERS 확인)`);
  if (s.img && !slide.img) warns.push(`${no}: 그림 "${s.img}"는 허용 목록에 없어 빠짐`);
  const used = new Set(fieldsOf(slide));
  for (const f of FIELDS) if (typeof s[f] === 'string' && s[f] && !used.has(f)) warns.push(`${no}: "${f}" 칸은 이 형태${slide.count ? `(${slide.count}개)` : ''}에 없어서 화면에 안 나옴`);
  if (s.type === 'image' && !slide.img) warns.push(`${no}: 그림 칸이 비어 있음 (img)`);
  // layout으로 옮긴 개체의 가운데가 화면 밖이면 안 보인다 (그림은 높이를 폭으로 어림)
  for (const o of placedObjects(slide)) {
    const cx = o.x + o.w / 2, cy = o.y + (o.h || o.w) / 2;
    if (cx < 0 || cx > W || cy < 0 || cy > H) warns.push(`${no}: "${o.id}" 개체가 화면 밖에 있음 (layout 확인)`);
  }

  // 글자 칸은 앱과 같은 규칙(deck-spec.js textBoxes)으로 구한다: 개체를 옮기거나 크기를 바꾼 layout도 반영된다
  for (const b of textBoxes(slide)) {
    const names = b.texts.map(t => t.field).join('+');
    let need;
    if (b.table) {
      const rows = parseTable(slide.table ?? '');
      const cw = b.w / rows[0].length - 50;
      const st = slide.styles?.table || {}, size = 36 * (st.scale || 1), lh = st.lh || 1.4;
      need = k => rows.reduce((sum, r) => sum + Math.max(...r.map(c => linesOf(stripMarkup(c), size * k, cw))) * size * k * lh + size * k * 0.9 + 2, 0);
    } else {
      need = k => b.texts.reduce((sum, t) => {
        const [size, lh] = STYLE[t.cls.split(' ')[0]];
        const scale = slide.styles?.[t.field]?.scale || 1;
        const v = slide[t.field] ?? '';
        if (!v) return sum;
        const text = t.plain ? v : stripMarkup(v);
        const sz = size * scale * k;
        return sum + linesOf(text, sz, b.w) * sz * (slide.styles?.[t.field]?.lh || lh);
      }, b.gap || 0);
    }
    if (need(FIT_MIN) > b.h) warns.push(`${no}: "${names}" 글이 너무 길어 최소 크기로 줄여도 넘침 → 나누거나 줄이기`);
    else if (need(1) > b.h) warns.push(`${no}: "${names}" 글이 길어 글자가 자동으로 작아짐`);
    // 본문 형태에서 키워도 칸의 40%를 못 채우면 비어 보인다
    if (['body', 'image'].includes(s.type) && b.id === 'main' && b.grow && need(1) > 0 && need(b.grow) < b.h * 0.4) {
      warns.push(`${no}: "${names}" 글이 적어 화면이 비어 보임 → 큰 한 문장, 카드, 단계 형태나 그림·스티커 고려`);
    }
  }
});

console.log(`✔ 앱이 열 수 있는 덱: ${deck.slides.length}장`);
for (const w of warns) console.log(`  ⚠ ${w}`);
process.exit(0);
