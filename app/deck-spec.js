'use strict';
// 덱 규칙: 슬라이드 형태, 허용 스티커, 기본 덱, 덱 검증(sanitize).
// 브라우저(app.js)와 Node(덱 검사 스크립트)가 같은 규칙을 쓰도록 DOM 없이 작성한다.
// 새 형태나 스티커를 추가하면 .claude/skills/slide-deck/SKILL.md 의 표도 함께 고친다.

/* ===== 상수 ===== */
const W = 1920, H = 1080;
const BG = { ivory: 'assets/bg-ivory.png', sage: 'assets/bg-sage.png', bluegray: 'assets/bg-bluegray.png' };

// 스티커 목록: 기존 소품 + Codex가 생성한 스티커 (파일이 없으면 패널에서 자동으로 숨김)
const STICKERS = [
  { src: 'assets/generated/sticker_반짝이.png', w: 220 },
  { src: 'assets/generated/sticker_별.png', w: 220 },
  { src: 'assets/generated/sticker_체크.png', w: 220 },
  { src: 'assets/generated/sticker_화살표.png', w: 260 },
  { src: 'assets/generated/sticker_하트.png', w: 220 },
  { src: 'assets/generated/sticker_말풍선.png', w: 320 },
  { src: 'assets/face.png', w: 220 },
  { src: 'assets/hero-props.png', w: 520 },
];

/* ===== 슬라이드 형태 (좌표는 1920x1080 기준) ===== */
// text: field, cls, x, y, w, h(최대 높이) / stack: 위아래로 이어지는 글자 묶음 / img: src, x, y, w, anim / bubble: 말풍선 도형
// 글자가 h를 넘으면 fitText()가 글자 크기를 줄인다.
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
      { k: 'text', field: 'title', cls: 'title-m', x: 160, y: 114, w: 1600, h: 180, ph: '슬라이드 제목' },
      // 본문이 길어지면 보조 설명이 아래로 밀린다
      { k: 'stack', x: 165, y: 318, w: 1500, h: 540, gap: 68, items: [
        { field: 'body', cls: 'body-l', ph: '본문 내용' },
        { field: 'sub', cls: 'body-m', ph: '보조 설명' },
      ] },
      { k: 'img', src: 'assets/face.png', x: 1690, y: 885, w: 130, anim: 'pop' },
    ],
  },
  explain: {
    label: '설명 (말풍선)',
    items: [
      { k: 'text', field: 'title', cls: 'title-m', x: 160, y: 114, w: 1600, h: 180, ph: '슬라이드 제목' },
      { k: 'bubble' },
      { k: 'text', field: 'bubble', cls: 'bubble', x: 235, y: 410, w: 850, h: 240, ph: '말풍선 내용', d: 0.5 },
      { k: 'img', src: 'assets/char-hands.png', x: 1318, y: 410, w: 467, anim: 'rise' },
    ],
  },
  chapterA: {
    label: '챕터 A (캐릭터)',
    items: [
      { k: 'text', field: 'num', cls: 'num', x: 165, y: 205, w: 500, h: 170, ph: '01' },
      { k: 'text', field: 'title', cls: 'title-l', x: 165, y: 478, w: 1200, h: 170, ph: '챕터 제목' },
      { k: 'text', field: 'sub', cls: 'body-m', x: 170, y: 652, w: 1100, h: 330, ph: '이번 장에서 다룰 주제' },
      { k: 'img', src: 'assets/char-hands.png', x: 1465, y: 665, w: 275, anim: 'rise' },
    ],
  },
  chapterB: {
    label: '챕터 B (소품 테두리)',
    items: [
      { k: 'text', field: 'num', cls: 'num', x: 165, y: 205, w: 500, h: 170, ph: '01' },
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

function defaultDeck() {
  return {
    bg: 'ivory', font: '', anim: true,
    slides: [
      { type: 'cover', title: '발표 제목을\n입력하세요', sub: '발표의 주제를 한 문장으로 적어주세요', name: '발표자 이름' },
      { type: 'body', title: '슬라이드 제목', body: '본문 내용을 입력하세요', sub: '필요한 설명이나 자료를 자유롭게 배치하세요' },
      { type: 'explain', title: '캐릭터와 함께하는 이야기', bubble: '여기에 하고 싶은\n이야기를 적어주세요' },
      { type: 'chapterA', num: '01', title: '챕터 제목을 입력하세요', sub: '이번 장에서 다룰 주제를 적어주세요' },
      { type: 'chapterB', num: '02', title: '챕터 제목을 입력하세요', sub: '이번 장에서 다룰 주제를 적어주세요' },
      { type: 'end', title: '감사합니다', sub: '궁금한 점을 함께 나눠요', name: '발표자 이름' },
    ].map(s => ({ stickers: [], ...s })),
  };
}

// 앱이 만들 수 있는 범위와 같아야 한다. 늘리면 addSlide/btnDup/addSticker의 검사도 같이 바뀐다.
const MAX_SLIDES = 300, MAX_STICKERS = 100;
const FIELDS = ['title', 'sub', 'name', 'body', 'bubble', 'num'];

// 스티커 이미지는 앱이 아는 파일만 허용한다 (외부 주소, 인코딩된 상위 경로 차단)
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
  const num = (v, min, max, dflt) => (Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : dflt);
  return {
    bg: Object.hasOwn(BG, d.bg) ? d.bg : 'ivory',
    font: typeof d.font === 'string' ? d.font.slice(0, 100) : '',
    anim: d.anim !== false,
    slides: d.slides.map(s => {
      if (!s || typeof s !== 'object' || !Object.hasOwn(TYPES, s.type)) throw new Error('알 수 없는 슬라이드 형태가 있습니다.');
      const out = { type: s.type, stickers: [] };
      for (const f of FIELDS) if (typeof s[f] === 'string') out[f] = s[f];
      const list = Array.isArray(s.stickers) ? s.stickers : [];
      if (list.length > MAX_STICKERS) throw new Error(`한 장의 스티커가 ${MAX_STICKERS}개를 넘습니다.`);
      for (const k of list) {
        if (!k || typeof k.src !== 'string' || !ok.has(k.src)) continue;
        const w = num(k.w, 40, W, 220);
        out.stickers.push({ src: k.src, w, x: num(k.x, -w / 2, W - w / 2, 0), y: num(k.y, -w / 2, H - w / 2, 0), float: k.float !== false });
      }
      return out;
    }),
  };
}

// Node에서 읽을 수 있게 내보낸다 (브라우저에서는 위 선언이 그대로 전역으로 쓰인다)
globalThis.DeckSpec = { W, H, BG, STICKERS, TYPES, FIELDS, MAX_SLIDES, MAX_STICKERS, defaultDeck, sanitize, allowedSrc };
