'use strict';
// 덱 규칙: 슬라이드 형태, 허용 스티커, 덱 설정, 글자 서식 표기, 기본 덱, 덱 검증(sanitize).
// 브라우저(app.js)와 Node(덱 검사 스크립트)가 같은 규칙을 쓰도록 DOM 없이 작성한다.
// 새 형태나 스티커를 추가하면 .claude/skills/slide-deck/SKILL.md 의 표도 함께 고친다.

/* ===== 상수 ===== */
const W = 1920, H = 1080;
const BG = { ivory: 'assets/bg-ivory.png', sage: 'assets/bg-sage.png', bluegray: 'assets/bg-bluegray.png' };
const BG_LABELS = { ivory: '아이보리', sage: '세이지', bluegray: '블루그레이' };

// 스티커 목록: 기존 소품 + Codex가 생성한 스티커 (파일이 없으면 패널에서 자동으로 숨김)
const STICKERS = [
  { src: 'assets/generated/sticker_반짝이.png', w: 220, name: '반짝이' },
  { src: 'assets/generated/sticker_별.png', w: 220, name: '별' },
  { src: 'assets/generated/sticker_체크.png', w: 220, name: '체크' },
  { src: 'assets/generated/sticker_화살표.png', w: 260, name: '화살표' },
  { src: 'assets/generated/sticker_하트.png', w: 220, name: '하트' },
  { src: 'assets/generated/sticker_말풍선.png', w: 320, name: '말풍선' },
  { src: 'assets/face.png', w: 220, name: '캐릭터 얼굴' },
  { src: 'assets/hero-props.png', w: 520, name: '캐릭터와 소품' },
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

/* ===== 슬라이드 형태 (좌표는 1920x1080 기준) =====
   text  : field, cls, x, y, w, h(최대 높이), grow(글이 적을 때 키울 최대 배율), align, plain(서식 없음)
   stack : 위아래로 이어지는 글자 묶음. center면 높이 h 안에서 세로 가운데
   img   : 고정 그림 / bubble : 말풍선 도형 / panel : 바탕 상자 / deco : 장식 글자
   cards, steps : 개수(count)에 따라 칸이 바뀌는 묶음 (필드 c1t, c1 … / s1t, s1 …)
   table : 표 (필드 table, 줄은 \n, 칸은 |) / slot : 그림 칸 (필드 img)
   글자가 h를 넘으면 앱이 글자 크기를 줄이고, grow가 있으면 남을 때 키운다. */
const TITLE = { k: 'text', field: 'title', cls: 'title-m', x: 160, y: 114, w: 1600, h: 160, ph: '슬라이드 제목' };

const TYPES = {
  cover: {
    label: '표지',
    items: [
      { k: 'text', field: 'title', cls: 'title-xl', x: 160, y: 235, w: 800, h: 290, ph: '발표 제목' },
      { k: 'text', field: 'sub', cls: 'sub', x: 165, y: 540, w: 760, h: 330, ph: '한 줄 소개' },
      { k: 'text', field: 'name', cls: 'name', x: 165, y: 905, w: 700, h: 120, ph: '발표자 이름' },
      { k: 'img', src: 'assets/hero-props.png', x: 985, y: 195, w: 815, anim: 'pop float' },
    ],
  },
  body: {
    label: '본문',
    items: [
      TITLE,
      // 본문이 길어지면 보조 설명이 아래로 밀리고, 짧으면 글자를 키워 채운다
      { k: 'stack', x: 165, y: 318, w: 1500, h: 560, gap: 60, grow: 1.5, items: [
        { field: 'body', cls: 'body-l', ph: '본문 내용' },
        { field: 'sub', cls: 'body-m', ph: '보조 설명' },
      ] },
      { k: 'img', src: 'assets/face.png', x: 1690, y: 885, w: 130, anim: 'pop' },
    ],
  },
  explain: {
    label: '설명 (말풍선)',
    items: [
      TITLE,
      { k: 'bubble' },
      { k: 'text', field: 'bubble', cls: 'bubble', x: 235, y: 380, w: 850, h: 270, grow: 1.3, ph: '말풍선 내용', d: 0.5 },
      { k: 'img', src: 'assets/char-hands.png', x: 1318, y: 410, w: 467, anim: 'rise' },
    ],
  },
  compare: {
    label: '2단 비교',
    items: [
      TITLE,
      { k: 'panel', x: 160, y: 300, w: 770, h: 640 },
      { k: 'panel', x: 990, y: 300, w: 770, h: 640 },
      { k: 'text', field: 'leftTitle', cls: 'head acc-blue', x: 210, y: 340, w: 670, h: 130, ph: '왼쪽 제목' },
      { k: 'text', field: 'left', cls: 'card', x: 210, y: 490, w: 670, h: 410, grow: 1.4, ph: '왼쪽 내용' },
      { k: 'text', field: 'rightTitle', cls: 'head acc-orange', x: 1040, y: 340, w: 670, h: 130, ph: '오른쪽 제목' },
      { k: 'text', field: 'right', cls: 'card', x: 1040, y: 490, w: 670, h: 410, grow: 1.4, ph: '오른쪽 내용' },
    ],
  },
  cards: {
    label: '카드 2~4개',
    items: [TITLE, { k: 'cards', x: 160, y: 300, w: 1600, h: 640, gap: 40, min: 2, max: 4, def: 3 }],
  },
  steps: {
    label: '단계 (1→2→3)',
    items: [TITLE, { k: 'steps', x: 160, y: 300, w: 1600, h: 640, gap: 90, min: 2, max: 4, def: 3 }],
  },
  statement: {
    label: '큰 한 문장',
    items: [
      { k: 'deco', text: '“', cls: 'qmark', x: 140, y: 120 },
      { k: 'stack', x: 210, y: 230, w: 1500, h: 640, gap: 70, grow: 1.3, center: true, items: [
        { field: 'quote', cls: 'statement', ph: '강조할 한 문장', align: 'center' },
        { field: 'sub', cls: 'body-m', ph: '덧붙이는 말', align: 'center' },
      ] },
      { k: 'img', src: 'assets/generated/sticker_반짝이.png', x: 1590, y: 150, w: 190, anim: 'pop float' },
    ],
  },
  code: {
    label: '코드·주소',
    items: [
      TITLE,
      { k: 'panel', tone: 'dark', x: 160, y: 300, w: 1600, h: 480 },
      { k: 'text', field: 'code', cls: 'code', plain: true, x: 210, y: 345, w: 1500, h: 390, ph: '코드나 주소' },
      { k: 'text', field: 'sub', cls: 'body-m', x: 165, y: 820, w: 1500, h: 140, ph: '설명' },
    ],
  },
  table: {
    label: '표',
    items: [TITLE, { k: 'table', field: 'table', x: 160, y: 300, w: 1600, h: 640, grow: 1.3 }],
  },
  image: {
    label: '그림+설명',
    items: [
      TITLE,
      { k: 'slot', field: 'img', x: 160, y: 300, w: 760, h: 640 },
      { k: 'stack', x: 990, y: 330, w: 770, h: 580, gap: 50, grow: 1.4, items: [
        { field: 'body', cls: 'body-l', ph: '설명' },
        { field: 'sub', cls: 'body-m', ph: '보조 설명' },
      ] },
    ],
  },
  chapterA: {
    label: '챕터 A (캐릭터)',
    items: [
      { k: 'text', field: 'num', cls: 'num', plain: true, x: 165, y: 205, w: 500, h: 170, ph: '01' },
      { k: 'text', field: 'title', cls: 'title-l', x: 165, y: 478, w: 1200, h: 170, ph: '챕터 제목' },
      { k: 'text', field: 'sub', cls: 'body-m', x: 170, y: 652, w: 1100, h: 330, ph: '이번 장에서 다룰 주제' },
      { k: 'img', src: 'assets/char-hands.png', x: 1465, y: 665, w: 275, anim: 'rise' },
    ],
  },
  chapterB: {
    label: '챕터 B (소품 테두리)',
    items: [
      { k: 'text', field: 'num', cls: 'num', plain: true, x: 165, y: 205, w: 500, h: 170, ph: '01' },
      { k: 'text', field: 'title', cls: 'title-l', x: 165, y: 448, w: 1000, h: 170, ph: '챕터 제목' },
      { k: 'text', field: 'sub', cls: 'body-m', x: 170, y: 622, w: 1000, h: 360, ph: '이번 장에서 다룰 주제' },
      { k: 'img', src: 'assets/props-corner.png', x: 1180, y: 105, w: 640, anim: 'drop-in' },
    ],
  },
  end: {
    label: '종료',
    items: [
      { k: 'text', field: 'title', cls: 'title-xl', x: 160, y: 273, w: 800, h: 260, ph: '감사합니다' },
      { k: 'text', field: 'sub', cls: 'sub', x: 165, y: 540, w: 760, h: 330, ph: '마무리 한마디' },
      { k: 'text', field: 'name', cls: 'name', x: 165, y: 905, w: 700, h: 120, ph: '발표자 이름' },
      { k: 'img', src: 'assets/hero-props.png', x: 985, y: 195, w: 815, anim: 'pop float' },
    ],
  },
};

/* ===== 개수가 바뀌는 묶음(cards, steps)의 칸 배치 ===== */
function groupItem(type) {
  return TYPES[type].items.find(i => i.k === 'cards' || i.k === 'steps');
}
function countOf(slide) {
  const g = groupItem(slide.type);
  if (!g) return 0;
  return Number.isInteger(slide.count) ? Math.min(g.max, Math.max(g.min, slide.count)) : g.def;
}
// 칸마다 상자 위치와 제목·내용 글자 칸을 돌려준다
function groupLayout(g, n) {
  const boxes = [];
  if (g.k === 'cards' && n === 4) {
    const w = (g.w - g.gap) / 2, h = (g.h - g.gap) / 2;
    for (let i = 0; i < 4; i++) boxes.push({ x: g.x + (i % 2) * (w + g.gap), y: g.y + Math.floor(i / 2) * (h + g.gap), w, h });
  } else {
    const w = (g.w - g.gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) boxes.push({ x: g.x + i * (w + g.gap), y: g.y, w, h: g.h });
  }
  const prefix = g.k === 'steps' ? 's' : 'c';
  return boxes.map((b, i) => {
    const small = b.h < 400;
    const top = g.k === 'steps' ? 150 : (small ? 34 : 44);   // 단계는 위쪽에 번호 원이 있다
    const headH = small ? 80 : 130;
    const bodyY = top + headH + (small ? 10 : 20);
    return {
      box: b, no: i + 1,
      head: { field: `${prefix}${i + 1}t`, x: b.x + 40, y: b.y + top, w: b.w - 80, h: headH },
      body: { field: `${prefix}${i + 1}`, x: b.x + 40, y: b.y + bodyY, w: b.w - 80, h: b.h - bodyY - 36 },
    };
  });
}

/* ===== 필드 목록 ===== */
const FIELDS = [
  'title', 'sub', 'name', 'body', 'bubble', 'num', 'quote', 'code', 'table',
  'leftTitle', 'left', 'rightTitle', 'right',
  'c1t', 'c1', 'c2t', 'c2', 'c3t', 'c3', 'c4t', 'c4',
  's1t', 's1', 's2t', 's2', 's3t', 's3', 's4t', 's4',
];
const PLAIN_FIELDS = new Set(['num', 'code']);   // 글자 서식 표기를 해석하지 않는 칸

// 형태가 실제로 쓰는 글자 칸 (count가 있으면 그 개수까지)
function fieldsOf(slide) {
  const out = [];
  for (const it of TYPES[slide.type].items) {
    if (it.k === 'text' || it.k === 'table') out.push(it.field);
    if (it.k === 'stack') it.items.forEach(t => out.push(t.field));
    if (it.k === 'cards' || it.k === 'steps') groupLayout(it, countOf(slide)).forEach(c => out.push(c.head.field, c.body.field));
  }
  return out;
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
      { type: 'image', title: '그림과 함께 설명해요', img: 'assets/hero-props.png', body: '그림 칸을 눌러 다른 그림을 고를 수 있어요', sub: '보조 설명' },
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
  const imgs = Object.values(TYPES).flatMap(t => t.items.filter(i => i.k === 'img').map(i => i.src));
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
  W, H, BG, BG_LABELS, STICKERS, PALETTE, TRANSITIONS, TEXT_ANIMS, DEFAULT_SETTINGS, TYPES, FIELDS, PLAIN_FIELDS,
  MAX_SLIDES, MAX_STICKERS, defaultDeck, sanitize, allowedSrc, fieldsOf, countOf, groupItem, groupLayout,
  parseMarkup, stripMarkup, runsToMarkup, parseTable, tableToString,
};
