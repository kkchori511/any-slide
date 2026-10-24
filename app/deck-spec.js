'use strict';
// 덱 규칙: 슬라이드 형태(개체 목록), 허용 스티커, 덱 설정, 글자 서식 표기, 기본 덱, 덱 검증(sanitize).
// 브라우저(app.js)와 Node(덱 검사 스크립트)가 같은 규칙을 쓰도록 DOM 없이 작성한다.
// 새 형태나 스티커를 추가하면 .claude/skills/slide-deck/SKILL.md 의 표도 함께 고친다.

const APP_VERSION = '1.3.0';

/* ===== 상수 ===== */
const W = 1920, H = 1080;
const BG = { ivory: 'assets/bg-ivory.png', sage: 'assets/bg-sage.png', bluegray: 'assets/bg-bluegray.png' };
const BG_LABELS = { ivory: '아이보리', sage: '세이지', bluegray: '블루그레이' };

// 스티커 목록. group: basic(기본 8개) / extra(덱을 만들며 새로 생성한 그림을 하나씩 추가)
const STICKER_GROUPS = { basic: '기본', extra: '추가' };
const STICKERS = [
  { src: 'assets/generated/sticker_반짝이.png', w: 220, name: '반짝이', group: 'basic' },
  { src: 'assets/generated/sticker_별.png', w: 220, name: '별', group: 'basic' },
  { src: 'assets/generated/sticker_체크.png', w: 220, name: '체크', group: 'basic' },
  { src: 'assets/generated/sticker_화살표.png', w: 260, name: '화살표', group: 'basic' },
  { src: 'assets/generated/sticker_하트.png', w: 220, name: '하트', group: 'basic' },
  { src: 'assets/generated/sticker_말풍선.png', w: 320, name: '말풍선', group: 'basic' },
  { src: 'assets/face.png', w: 220, name: '캐릭터 얼굴', group: 'basic' },
  { src: 'assets/hero-props.png', w: 520, name: '캐릭터와 소품', group: 'basic' },
  { src: 'assets/generated/sticker_API점원.png', w: 360, name: 'API 점원 로봇', group: 'extra' },
  { src: 'assets/generated/sticker_여행.png', w: 320, name: '지도와 여행 가방', group: 'extra' },
];

// 글자 색 (핵심 브리프의 소품 색에서 고름). 덱 파일에는 이름으로 저장한다.
const PALETTE = {
  red: { label: '빨강', color: '#d64541' },
  blue: { label: '파랑', color: '#2e6bd0' },
  green: { label: '초록', color: '#2f9e55' },
  orange: { label: '주황', color: '#e07b1f' },
  gray: { label: '회색', color: '#8a8179' },
};

// 덱 설정: 장 전환, 글자·그림 등장
const TRANSITIONS = { none: '없음', fade: '페이드', slide: '밀기', zoom: '확대', rise: '위로 올라오기' };
const TEXT_ANIMS = { fly: '날아오기', fade: '페이드만', none: '없음' };
const DEFAULT_SETTINGS = { transition: 'fade', duration: 0.5, textAnim: 'fly', imgAnim: true, float: true };

/* ===== 슬라이드 형태: 개체 목록 (좌표는 1920x1080 기준) =====
   모든 개체는 id가 있고, 장마다 slide.layout[id] = { x, y, w, h, rot, hidden } 으로 위치·크기·회전·숨김을 바꿀 수 있다.
   text    : 글자 상자 하나 (field, cls, h는 칸 높이: 넘치면 글자를 줄이고 grow가 있으면 남을 때 키운다)
   stack   : 위아래로 이어지는 글자 묶음 (center면 세로 가운데)
   img     : 그림 (높이는 그림 비율대로) / deco : 장식 글자
   bubble  : 말풍선 도형 + 안의 글자 / codebox : 어두운 상자 + 코드 글자
   card    : 바탕 상자 + 제목 + 내용 (variant: cards / steps / compare)
   group   : 개수(count)에 따라 카드 개체 c1… 또는 단계 개체 s1…(+ 화살표 a1…)로 펼쳐진다
   table   : 표 (field table, 줄은 \n, 칸은 |) / slot : 그림 칸 (field img) */
const TITLE = { id: 'title', k: 'text', field: 'title', cls: 'title-m', x: 160, y: 114, w: 1600, h: 160, ph: '슬라이드 제목' };

const TYPES = {
  cover: {
    label: '표지',
    objects: [
      { id: 'title', k: 'text', field: 'title', cls: 'title-xl', x: 160, y: 235, w: 800, h: 290, ph: '발표 제목' },
      { id: 'sub', k: 'text', field: 'sub', cls: 'sub', x: 165, y: 540, w: 760, h: 330, ph: '한 줄 소개' },
      { id: 'name', k: 'text', field: 'name', cls: 'name', x: 165, y: 905, w: 700, h: 120, ph: '발표자 이름' },
      { id: 'hero', k: 'img', src: 'assets/hero-props.png', x: 985, y: 195, w: 815, anim: 'pop float' },
    ],
  },
  body: {
    label: '본문',
    objects: [
      TITLE,
      // 본문이 길어지면 보조 설명이 아래로 밀리고, 짧으면 글자를 키워 채운다
      { id: 'main', k: 'stack', x: 165, y: 318, w: 1500, h: 560, gap: 60, grow: 1.5, items: [
        { field: 'body', cls: 'body-l', ph: '본문 내용' },
        { field: 'sub', cls: 'body-m', ph: '보조 설명' },
      ] },
      { id: 'face', k: 'img', src: 'assets/face.png', x: 1690, y: 885, w: 130, anim: 'pop' },
    ],
  },
  explain: {
    label: '설명 (말풍선)',
    objects: [
      TITLE,
      { id: 'bubble', k: 'bubble', field: 'bubble', x: 150, y: 315, w: 1140, h: 375, grow: 1.3, ph: '말풍선 내용' },
      { id: 'char', k: 'img', src: 'assets/char-hands.png', x: 1318, y: 410, w: 467, anim: 'rise' },
    ],
  },
  compare: {
    label: '2단 비교',
    objects: [
      TITLE,
      { id: 'L', k: 'card', variant: 'compare', accent: 'blue', x: 160, y: 300, w: 770, h: 640, head: 'leftTitle', body: 'left', headPh: '왼쪽 제목', bodyPh: '왼쪽 내용' },
      { id: 'R', k: 'card', variant: 'compare', accent: 'orange', x: 990, y: 300, w: 770, h: 640, head: 'rightTitle', body: 'right', headPh: '오른쪽 제목', bodyPh: '오른쪽 내용' },
    ],
  },
  cards: {
    label: '카드 2~4개',
    objects: [TITLE, { id: 'g', k: 'group', variant: 'cards', x: 160, y: 300, w: 1600, h: 640, gap: 40, min: 2, max: 4, def: 3 }],
  },
  steps: {
    label: '단계 (1→2→3)',
    objects: [TITLE, { id: 'g', k: 'group', variant: 'steps', x: 160, y: 300, w: 1600, h: 640, gap: 90, min: 2, max: 4, def: 3 }],
  },
  statement: {
    label: '큰 한 문장',
    objects: [
      { id: 'qmark', k: 'deco', text: '“', cls: 'qmark', x: 140, y: 120, w: 220, h: 300 },
      { id: 'main', k: 'stack', x: 210, y: 230, w: 1500, h: 640, gap: 70, grow: 1.3, center: true, items: [
        { field: 'quote', cls: 'statement', ph: '강조할 한 문장', align: 'center' },
        { field: 'sub', cls: 'body-m', ph: '덧붙이는 말', align: 'center' },
      ] },
      { id: 'spark', k: 'img', src: 'assets/generated/sticker_반짝이.png', x: 1590, y: 150, w: 190, anim: 'pop float' },
    ],
  },
  code: {
    label: '코드·주소',
    objects: [
      TITLE,
      { id: 'codebox', k: 'codebox', field: 'code', x: 160, y: 300, w: 1600, h: 480, ph: '코드나 주소' },
      { id: 'sub', k: 'text', field: 'sub', cls: 'body-m', x: 165, y: 820, w: 1500, h: 140, ph: '설명' },
    ],
  },
  table: {
    label: '표',
    objects: [TITLE, { id: 'table', k: 'table', field: 'table', x: 160, y: 300, w: 1600, h: 640, grow: 1.3 }],
  },
  image: {
    label: '그림+설명',
    objects: [
      TITLE,
      { id: 'slot', k: 'slot', field: 'img', x: 160, y: 300, w: 760, h: 640 },
      { id: 'main', k: 'stack', x: 990, y: 330, w: 770, h: 580, gap: 50, grow: 1.4, items: [
        { field: 'body', cls: 'body-l', ph: '설명' },
        { field: 'sub', cls: 'body-m', ph: '보조 설명' },
      ] },
    ],
  },
  chapterA: {
    label: '챕터 A (캐릭터)',
    objects: [
      { id: 'num', k: 'text', field: 'num', cls: 'num', plain: true, x: 165, y: 205, w: 500, h: 170, ph: '01' },
      { id: 'title', k: 'text', field: 'title', cls: 'title-l', x: 165, y: 478, w: 1200, h: 170, ph: '챕터 제목' },
      { id: 'sub', k: 'text', field: 'sub', cls: 'body-m', x: 170, y: 652, w: 1100, h: 330, ph: '이번 장에서 다룰 주제' },
      { id: 'char', k: 'img', src: 'assets/char-hands.png', x: 1465, y: 665, w: 275, anim: 'rise' },
    ],
  },
  chapterB: {
    label: '챕터 B (소품 테두리)',
    objects: [
      { id: 'num', k: 'text', field: 'num', cls: 'num', plain: true, x: 165, y: 205, w: 500, h: 170, ph: '01' },
      { id: 'title', k: 'text', field: 'title', cls: 'title-l', x: 165, y: 448, w: 1000, h: 170, ph: '챕터 제목' },
      { id: 'sub', k: 'text', field: 'sub', cls: 'body-m', x: 170, y: 622, w: 1000, h: 360, ph: '이번 장에서 다룰 주제' },
      { id: 'props', k: 'img', src: 'assets/props-corner.png', x: 1180, y: 105, w: 640, anim: 'drop-in' },
    ],
  },
  end: {
    label: '종료',
    objects: [
      { id: 'title', k: 'text', field: 'title', cls: 'title-xl', x: 160, y: 273, w: 800, h: 260, ph: '감사합니다' },
      { id: 'sub', k: 'text', field: 'sub', cls: 'sub', x: 165, y: 540, w: 760, h: 330, ph: '마무리 한마디' },
      { id: 'name', k: 'text', field: 'name', cls: 'name', x: 165, y: 905, w: 700, h: 120, ph: '발표자 이름' },
      { id: 'hero', k: 'img', src: 'assets/hero-props.png', x: 985, y: 195, w: 815, anim: 'pop float' },
    ],
  },
};

/* ===== 개체 펼치기와 배치 ===== */
function groupItem(type) {
  return TYPES[type].objects.find(o => o.k === 'group');
}
function countOf(slide) {
  const g = groupItem(slide.type);
  if (!g) return 0;
  return Number.isInteger(slide.count) ? Math.min(g.max, Math.max(g.min, slide.count)) : g.def;
}
function groupBoxes(g, n) {
  const boxes = [];
  if (g.variant === 'cards' && n === 4) {
    const w = (g.w - g.gap) / 2, h = (g.h - g.gap) / 2;
    for (let i = 0; i < 4; i++) boxes.push({ x: g.x + (i % 2) * (w + g.gap), y: g.y + Math.floor(i / 2) * (h + g.gap), w, h });
  } else {
    const w = (g.w - g.gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) boxes.push({ x: g.x + i * (w + g.gap), y: g.y, w, h: g.h });
  }
  return boxes;
}
// 형태의 개체를 실제 개체 목록으로 펼친다. all이면 개수와 상관없이 가장 많을 때까지 펼친다 (검증용).
function expandObjects(slide, all) {
  const out = [];
  for (const o of TYPES[slide.type].objects) {
    if (o.k !== 'group') { out.push({ ...o }); continue; }
    const n = all ? o.max : countOf(slide);
    const pre = o.variant === 'steps' ? 's' : 'c';
    groupBoxes(o, n).forEach((b, i) => {
      out.push({ id: `${pre}${i + 1}`, k: 'card', variant: o.variant, accent: o.variant === 'cards' ? 'blue' : null, no: i + 1, ...b,
        head: `${pre}${i + 1}t`, body: `${pre}${i + 1}`, headPh: `${i + 1}번 제목`, bodyPh: '내용' });
      if (o.variant === 'steps' && i < n - 1) {
        out.push({ id: `a${i + 1}`, k: 'deco', text: '›', cls: 'arrow', x: b.x + b.w + o.gap / 2 - 22, y: b.y + b.h / 2 - 50, w: 44, h: 100 });
      }
    });
  }
  return out;
}
// 장의 layout(사용자가 옮기고 바꾼 값)을 덮어쓴 개체 목록. 숨긴 개체는 withHidden일 때만 포함한다.
function placedObjects(slide, withHidden) {
  const lay = slide.layout || {};
  return expandObjects(slide).map(o => {
    const v = lay[o.id];
    if (!v) return o;
    const p = { ...o };
    for (const k of ['x', 'y', 'w', 'h', 'rot']) if (Number.isFinite(v[k])) p[k] = v[k];
    if (v.hidden) p.hidden = true;
    return p;
  }).filter(o => withHidden || !o.hidden);
}

/* ===== 개체 크기 제한 =====
   최소 크기는 안의 배치(제목·내용 칸)가 바탕 안에 들어가는 크기다. 최대 크기와 위치 제한은 덱 검증(sanitize)과 앱이 같이 쓴다. */
const OBJ_MAX = { w: 2 * W, h: 2 * H };
function objMinSize(o) {
  switch (o.k) {
    case 'card': return o.variant === 'compare' ? { w: 200, h: 290 } : o.variant === 'steps' ? { w: 180, h: 400 } : { w: 180, h: 220 };
    case 'bubble': return { w: 390, h: 170 };
    case 'codebox': return { w: 200, h: 150 };
    case 'slot': return { w: 120, h: 120 };
    case 'img': case 'deco': return { w: 40, h: 40 };
    default: return { w: 60, h: 40 };
  }
}
// 가운데가 슬라이드 밖으로 나가지 않게 한다 (그림은 실제 높이 h를 넘겨야 한다)
function clampPos(x, y, w, h) {
  return { x: Math.min(W - w / 2, Math.max(-w / 2, x)), y: Math.min(H - h / 2, Math.max(-h / 2, y)) };
}

// 묶음 개체 안의 배치 (개체 왼쪽 위 기준). 개체 크기를 바꾸면 안의 배치도 따라 바뀐다.
// 크기가 최소 크기보다 작게 들어와도 칸 폭·높이가 0 이하가 되지 않게 한다.
function cardInner(o) {
  const w = Math.max(o.w, 120), h = Math.max(o.h, 120);
  const cw = pad => Math.max(40, w - pad);
  if (o.variant === 'compare') return { head: { x: 50, y: 40, w: cw(100), h: 130 }, body: { x: 50, y: 190, w: cw(100), h: Math.max(40, h - 230) } };
  if (o.variant === 'steps') return { badge: { x: w / 2 - 48, y: 36 }, head: { x: 40, y: 150, w: cw(80), h: 130 }, body: { x: 40, y: 300, w: cw(80), h: Math.max(40, h - 336) } };
  const small = h < 400, top = small ? 34 : 44, headH = small ? 80 : 130, bodyY = top + headH + (small ? 10 : 20);
  return { head: { x: 40, y: top, w: cw(80), h: headH }, body: { x: 40, y: bodyY, w: cw(80), h: Math.max(40, h - bodyY - 36) } };
}
function bubbleInner(o) { return { x: 85, y: 65, w: Math.max(100, o.w - 290), h: Math.max(60, o.h - 105) }; }
function codeInner(o) { return { x: 50, y: 45, w: Math.max(100, o.w - 100), h: Math.max(60, o.h - 90) }; }

// 장의 글자 칸 목록 (검사 스크립트와 필드 목록에 쓴다): { texts:[{field, cls, plain}], w, h, gap, grow, table }
function textBoxes(slide) {
  const out = [];
  for (const o of placedObjects(slide)) {
    if (o.k === 'text') out.push({ id: o.id, texts: [{ field: o.field, cls: o.cls, plain: o.plain }], w: o.w, h: o.h, grow: o.grow });
    if (o.k === 'stack') out.push({ id: o.id, texts: o.items, w: o.w, h: o.h, gap: o.gap * (o.items.length - 1), grow: o.grow });
    if (o.k === 'bubble') { const r = bubbleInner(o); out.push({ id: o.id, texts: [{ field: o.field, cls: 'bubble' }], w: r.w, h: r.h, grow: o.grow }); }
    if (o.k === 'codebox') { const r = codeInner(o); out.push({ id: o.id, texts: [{ field: o.field, cls: 'code', plain: true }], w: r.w, h: r.h }); }
    if (o.k === 'card') {
      const r = cardInner(o);
      out.push({ id: o.id, texts: [{ field: o.head, cls: 'head' }], w: r.head.w, h: r.head.h });
      out.push({ id: o.id, texts: [{ field: o.body, cls: 'card' }], w: r.body.w, h: r.body.h, grow: 1.4 });
    }
    if (o.k === 'table') out.push({ id: o.id, table: true, texts: [{ field: 'table', cls: 'cell' }], w: o.w, h: o.h, grow: o.grow });
  }
  return out;
}

/* ===== 필드 목록 ===== */
const FIELDS = [
  'title', 'sub', 'name', 'body', 'bubble', 'num', 'quote', 'code', 'table',
  'leftTitle', 'left', 'rightTitle', 'right',
  'c1t', 'c1', 'c2t', 'c2', 'c3t', 'c3', 'c4t', 'c4',
  's1t', 's1', 's2t', 's2', 's3t', 's3', 's4t', 's4',
];
const PLAIN_FIELDS = new Set(['num', 'code']);   // 글자 서식 표기를 해석하지 않는 칸

// 형태가 실제로 쓰는 글자 칸 (숨긴 개체 제외)
function fieldsOf(slide) {
  return textBoxes(slide).flatMap(b => b.texts.map(t => t.field));
}

/* ===== 표·상자 내용의 자동 정렬 =====
   제목·머리 줄은 가운데. 내용은 짧으면(2줄 이내, 줄마다 14자 이내) 가운데, 길면 왼쪽.
   글머리표(•, -, ·)나 번호(1. 1))로 시작하는 목록은 짧아도 왼쪽. 사용자가 정렬을 정하면 그 값이 우선. */
function autoAlign(text) {
  const lines = stripMarkup(text).split('\n');
  if (lines.some(l => /^\s*([•\-·*]|\d+[.)])\s/.test(l))) return 'left';
  return lines.length <= 2 && lines.every(l => [...l].length <= 14) ? 'center' : 'left';
}
// 나란히 놓인 상자(카드·단계·비교)의 내용과 표의 각 열은 정렬을 하나로 맞춘다.
// 묶음 안에 긴 글이나 목록이 하나라도 있으면 모두 왼쪽, 모두 짧으면 모두 가운데. 비어 있는 칸은 판단에서 뺀다.
function groupAlign(texts) {
  const filled = texts.filter(t => stripMarkup(t ?? '').trim());
  return filled.some(t => autoAlign(t) === 'left') ? 'left' : 'center';
}
// 장의 자동 정렬 값: { fields: {상자 내용 필드: 정렬}, cols: [표 열별 정렬] }
function slideAligns(slide) {
  const bodies = placedObjects(slide).filter(o => o.k === 'card').map(o => o.body);
  const a = groupAlign(bodies.map(f => slide[f]));
  const fields = Object.fromEntries(bodies.map(f => [f, a]));
  let cols = [];
  if (TYPES[slide.type].objects.some(o => o.k === 'table')) {
    const rows = parseTable(slide.table ?? '').slice(1);
    cols = parseTable(slide.table ?? '')[0].map((_, c) => groupAlign(rows.map(r => r[c])));
  }
  return { fields, cols };
}

/* ===== 글자 서식 표기 =====
   **굵게**  __밑줄__  ==형광펜==  {{red:색 글자}}  \* 처럼 \ 뒤 글자는 그대로
   서로 겹쳐 써도 된다. 닫지 않은 표기는 글 끝에서 닫힌다. */
const MARKS = { '**': 'b', '__': 'u', '==': 'm' };
function parseMarkup(s) {
  const runs = [];
  let st = { b: false, u: false, m: false, c: null }, buf = '';
  const colors = [];
  const flush = () => { if (buf) { runs.push({ text: buf, ...st }); buf = ''; } };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i], two = s.slice(i, i + 2);
    if (ch === '\\' && i + 1 < s.length) { buf += s[++i]; continue; }
    if (MARKS[two]) { flush(); st = { ...st, [MARKS[two]]: !st[MARKS[two]] }; i++; continue; }
    if (two === '{{') {
      const m = /^\{\{([a-z]+):/.exec(s.slice(i));
      if (m && Object.hasOwn(PALETTE, m[1])) { flush(); colors.push(st.c); st = { ...st, c: m[1] }; i += m[0].length - 1; continue; }
    }
    if (two === '}}' && colors.length) { flush(); st = { ...st, c: colors.pop() }; i++; continue; }
    buf += ch;
  }
  flush();
  return runs;
}
function stripMarkup(s) {
  return parseMarkup(String(s ?? '')).map(r => r.text).join('');
}
// 글자별 서식 묶음(runs)을 표기 문자열로 바꾼다. 바뀌는 지점에만 표기를 넣는다.
function runsToMarkup(runs) {
  let out = '', st = { b: false, u: false, m: false, c: null };
  const SPECIAL = '\\*_={}';
  for (const r of runs) {
    if (st.c !== r.c && st.c) out += '}}';
    for (const [mk, key] of Object.entries(MARKS)) if (st[key] !== r[key]) out += mk;
    if (st.c !== r.c && r.c) out += `{{${r.c}:`;
    st = { b: r.b, u: r.u, m: r.m, c: r.c };
    // 표기와 헷갈릴 수 있는 글자만 \로 감싼다: 같은 글자가 붙어 있거나 조각의 처음·끝
    const t = r.text;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      const risky = ch === '\\' || (SPECIAL.includes(ch) && (t[i - 1] === ch || t[i + 1] === ch || i === 0 || i === t.length - 1));
      out += (risky ? '\\' : '') + ch;
    }
  }
  if (st.c) out += '}}';
  for (const [mk, key] of Object.entries(MARKS)) if (st[key]) out += mk;
  return out;
}

/* ===== 표: 줄은 \n, 칸은 | (칸 안의 |는 \|) ===== */
function parseTable(s) {
  const rows = String(s ?? '').split('\n').map(line => {
    const cells = []; let buf = '';
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '\\' && i + 1 < line.length) { buf += line[i] + line[i + 1]; i++; continue; }
      if (line[i] === '|') { cells.push(buf.trim()); buf = ''; continue; }
      buf += line[i];
    }
    cells.push(buf.trim());
    return cells;
  });
  const cols = Math.max(1, ...rows.map(r => r.length));
  return rows.map(r => Array.from({ length: cols }, (_, i) => r[i] ?? ''));
}
// 칸 안의 |는 구분자가 아니도록 \| 로 감싼다. 앞의 \ 개수가 홀수면 이미 감싼 것이고, 짝수(\\ 는 \ 글자)면 감싸야 한다.
function tableToString(rows) {
  const escCell = c => c.replace(/(\\*)\|/g, (m, bs) => (bs.length % 2 ? m : bs + '\\|'));
  return rows.map(r => r.map(escCell).join(' | ')).join('\n');
}

/* ===== 기본 덱 (모든 형태 예시) ===== */
function defaultDeck() {
  return {
    bg: 'ivory', font: '', settings: { ...DEFAULT_SETTINGS },
    slides: [
      { type: 'cover', title: '발표 제목을\n입력하세요', sub: '발표의 주제를 한 문장으로 적어주세요', name: '발표자 이름' },
      { type: 'body', title: '슬라이드 제목', body: '본문 내용을 입력하세요', sub: '필요한 설명이나 자료를 자유롭게 배치하세요' },
      { type: 'explain', title: '캐릭터와 함께하는 이야기', bubble: '여기에 하고 싶은\n이야기를 적어주세요' },
      { type: 'compare', title: '두 가지를 비교해요', leftTitle: '이전', left: '• 첫째 특징\n• 둘째 특징', rightTitle: '이후', right: '• 첫째 특징\n• 둘째 특징' },
      { type: 'cards', title: '핵심 세 가지', count: 3, c1t: '첫째', c1: '설명을 적어주세요', c2t: '둘째', c2: '설명을 적어주세요', c3t: '셋째', c3: '설명을 적어주세요' },
      { type: 'steps', title: '이렇게 진행해요', count: 3, s1t: '준비', s1: '무엇을 준비할까요', s2t: '실행', s2: '어떻게 할까요', s3t: '확인', s3: '무엇을 확인할까요' },
      { type: 'statement', quote: '꼭 기억할 **한 문장**', sub: '덧붙이는 말' },
      { type: 'code', title: '코드나 주소', code: 'https://example.com/api?key=내키', sub: '설명을 적어주세요' },
      { type: 'table', title: '표로 정리해요', table: '구분 | 내용\n첫째 | 설명\n둘째 | 설명' },
      { type: 'image', title: '그림과 함께 설명해요', img: 'assets/hero-props.png', body: '그림 칸을 두 번 눌러 다른 그림을 고를 수 있어요', sub: '보조 설명' },
      { type: 'chapterA', num: '01', title: '챕터 제목을 입력하세요', sub: '이번 장에서 다룰 주제를 적어주세요' },
      { type: 'chapterB', num: '02', title: '챕터 제목을 입력하세요', sub: '이번 장에서 다룰 주제를 적어주세요' },
      { type: 'end', title: '감사합니다', sub: '궁금한 점을 함께 나눠요', name: '발표자 이름' },
    ].map(s => ({ stickers: [], ...s })),
  };
}

// 앱이 만들 수 있는 범위와 같아야 한다. 늘리면 addSlide/btnDup/addSticker의 검사도 같이 바뀐다.
const MAX_SLIDES = 300, MAX_STICKERS = 100;
const STYLE_KEYS = { scale: [0.5, 2], lh: [1, 2.4] };
const ALIGNS = ['left', 'center', 'right'];

// 스티커와 그림 칸 이미지는 앱이 아는 파일만 허용한다 (외부 주소, 인코딩된 상위 경로 차단)
function allowedSrc() {
  const imgs = Object.values(TYPES).flatMap(t => t.objects.filter(o => o.k === 'img').map(o => o.src));
  return new Set([...STICKERS.map(s => s.src), ...imgs]);
}

// 허용한 필드만 새 객체로 복사한다. 잘못된 구조는 예외를 던져 호출한 쪽이 기존 덱을 지키게 한다.
// 내용은 잘라 내지 않는다: 앱에서 만든 덱은 그대로 다시 열 수 있어야 한다.
function sanitize(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.slides) || !d.slides.length) {
    throw new Error('슬라이드가 없는 파일입니다.');
  }
  if (d.slides.length > MAX_SLIDES) throw new Error(`슬라이드가 ${MAX_SLIDES}장을 넘습니다.`);
  const ok = allowedSrc();
  const num = (v, min, max, dflt) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt);
  const int = (v, min, max, dflt) => Math.round(num(v, min, max, dflt));

  // 설정: 예전 덱의 anim:false는 모든 등장 효과 끄기로 옮긴다
  const s0 = d.settings && typeof d.settings === 'object' ? d.settings : {};
  const legacyOff = d.anim === false;
  const settings = {
    transition: Object.hasOwn(TRANSITIONS, s0.transition) ? s0.transition : DEFAULT_SETTINGS.transition,
    duration: Math.round(num(s0.duration, 0.2, 1, DEFAULT_SETTINGS.duration) * 10) / 10,
    textAnim: Object.hasOwn(TEXT_ANIMS, s0.textAnim) ? s0.textAnim : (legacyOff ? 'none' : DEFAULT_SETTINGS.textAnim),
    imgAnim: typeof s0.imgAnim === 'boolean' ? s0.imgAnim : !legacyOff,
    float: typeof s0.float === 'boolean' ? s0.float : !legacyOff,
  };

  return {
    bg: Object.hasOwn(BG, d.bg) ? d.bg : 'ivory',
    font: typeof d.font === 'string' ? d.font.slice(0, 100) : '',
    settings,
    slides: d.slides.map(s => {
      if (!s || typeof s !== 'object' || !Object.hasOwn(TYPES, s.type)) throw new Error('알 수 없는 슬라이드 형태가 있습니다.');
      const out = { type: s.type, stickers: [] };
      for (const f of FIELDS) if (typeof s[f] === 'string') out[f] = s[f];
      const g = groupItem(s.type);
      if (g && Number.isFinite(s.count)) out.count = int(s.count, g.min, g.max, g.def);
      if (typeof s.img === 'string' && ok.has(s.img)) out.img = s.img;
      if (Object.hasOwn(TRANSITIONS, s.transition)) out.transition = s.transition;
      // 칸 전체 서식: 글자 크기 배율, 정렬, 줄 간격
      if (s.styles && typeof s.styles === 'object') {
        const styles = {};
        for (const f of FIELDS) {
          const v = s.styles[f];
          if (!v || typeof v !== 'object') continue;
          const o = {};
          if (Number.isFinite(v.scale)) o.scale = Math.round(num(v.scale, ...STYLE_KEYS.scale, 1) * 100) / 100;
          if (Number.isFinite(v.lh)) o.lh = Math.round(num(v.lh, ...STYLE_KEYS.lh, 1.5) * 100) / 100;
          if (ALIGNS.includes(v.align)) o.align = v.align;
          if (Object.keys(o).length) styles[f] = o;
        }
        if (Object.keys(styles).length) out.styles = styles;
      }
      // 개체 배치: 이 형태에 있는 개체 id만, 숫자는 범위 안으로
      if (s.layout && typeof s.layout === 'object') {
        const objs = new Map(expandObjects(out, true).map(o => [o.id, o]));
        const layout = {};
        for (const [id, base] of objs) {
          const v = s.layout[id];
          if (!v || typeof v !== 'object') continue;
          const o = {}, min = objMinSize(base);
          if (Number.isFinite(v.x)) o.x = int(v.x, -W, 2 * W, 0);
          if (Number.isFinite(v.y)) o.y = int(v.y, -H, 2 * H, 0);
          if (Number.isFinite(v.w)) o.w = int(v.w, min.w, OBJ_MAX.w, base.w);
          if (Number.isFinite(v.h)) o.h = int(v.h, min.h, OBJ_MAX.h, base.h || min.h);
          if (Number.isFinite(v.rot)) o.rot = int(v.rot, -180, 180, 0);
          if (v.hidden === true) o.hidden = true;
          if (Object.keys(o).length) layout[id] = o;
        }
        if (Object.keys(layout).length) out.layout = layout;
      }
      const list = Array.isArray(s.stickers) ? s.stickers : [];
      if (list.length > MAX_STICKERS) throw new Error(`한 장의 스티커가 ${MAX_STICKERS}개를 넘습니다.`);
      for (const k of list) {
        if (!k || typeof k.src !== 'string' || !ok.has(k.src)) continue;
        const w = int(k.w, 40, W, 220);
        out.stickers.push({
          src: k.src, w,
          x: int(k.x, -w / 2, W - w / 2, 0), y: int(k.y, -w / 2, H - w / 2, 0),
          rot: int(k.rot, -180, 180, 0), flip: k.flip === true, float: k.float !== false,
        });
      }
      return out;
    }),
  };
}

// Node에서 읽을 수 있게 내보낸다 (브라우저에서는 위 선언이 그대로 전역으로 쓰인다)
globalThis.DeckSpec = {
  APP_VERSION, W, H, BG, BG_LABELS, STICKERS, STICKER_GROUPS, PALETTE, TRANSITIONS, TEXT_ANIMS, DEFAULT_SETTINGS,
  TYPES, FIELDS, PLAIN_FIELDS, MAX_SLIDES, MAX_STICKERS, defaultDeck, sanitize, allowedSrc,
  OBJ_MAX, objMinSize, clampPos, expandObjects, placedObjects, textBoxes, fieldsOf, countOf, groupItem, groupBoxes, cardInner, bubbleInner, codeInner, autoAlign, groupAlign, slideAligns,
  parseMarkup, stripMarkup, runsToMarkup, parseTable, tableToString,
};
