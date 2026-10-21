'use strict';

/* ===== 상수 ===== */
const W = 1920, H = 1080;
const STORE_KEY = 'any-slide-deck-v1';
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
// text: field, cls, x, y, w / img: src, x, y, w, anim / bubble: 말풍선 도형
const TYPES = {
  cover: {
    label: '표지',
    items: [
      { k: 'text', field: 'title', cls: 'title-xl', x: 160, y: 235, w: 800, ph: '발표 제목' },
      { k: 'text', field: 'sub', cls: 'sub', x: 165, y: 540, w: 760, ph: '한 줄 소개' },
      { k: 'text', field: 'name', cls: 'name', x: 165, y: 905, w: 700, ph: '발표자 이름' },
      { k: 'img', src: 'assets/hero-props.png', x: 985, y: 195, w: 815, anim: 'pop float' },
    ],
  },
  body: {
    label: '본문',
    items: [
      { k: 'text', field: 'title', cls: 'title-m', x: 160, y: 114, w: 1600, ph: '슬라이드 제목' },
      { k: 'text', field: 'body', cls: 'body-l', x: 165, y: 318, w: 1500, ph: '본문 내용' },
      { k: 'text', field: 'sub', cls: 'body-m', x: 165, y: 452, w: 1500, ph: '보조 설명' },
      { k: 'img', src: 'assets/face.png', x: 1690, y: 885, w: 130, anim: 'pop' },
    ],
  },
  explain: {
    label: '설명 (말풍선)',
    items: [
      { k: 'text', field: 'title', cls: 'title-m', x: 160, y: 114, w: 1600, ph: '슬라이드 제목' },
      { k: 'bubble' },
      { k: 'text', field: 'bubble', cls: 'bubble', x: 235, y: 410, w: 850, ph: '말풍선 내용', d: 0.5 },
      { k: 'img', src: 'assets/char-hands.png', x: 1318, y: 410, w: 467, anim: 'rise' },
    ],
  },
  chapterA: {
    label: '챕터 A (캐릭터)',
    items: [
      { k: 'text', field: 'num', cls: 'num', x: 165, y: 205, w: 500, ph: '01' },
      { k: 'text', field: 'title', cls: 'title-l', x: 165, y: 478, w: 1200, ph: '챕터 제목' },
      { k: 'text', field: 'sub', cls: 'body-m', x: 170, y: 652, w: 1100, ph: '이번 장에서 다룰 주제' },
      { k: 'img', src: 'assets/char-hands.png', x: 1465, y: 665, w: 275, anim: 'rise' },
    ],
  },
  chapterB: {
    label: '챕터 B (소품 테두리)',
    items: [
      { k: 'text', field: 'num', cls: 'num', x: 165, y: 205, w: 500, ph: '01' },
      { k: 'text', field: 'title', cls: 'title-l', x: 165, y: 448, w: 1000, ph: '챕터 제목' },
      { k: 'text', field: 'sub', cls: 'body-m', x: 170, y: 622, w: 1000, ph: '이번 장에서 다룰 주제' },
      { k: 'img', src: 'assets/props-corner.png', x: 1180, y: 105, w: 640, anim: 'drop-in' },
    ],
  },
  end: {
    label: '종료',
    items: [
      { k: 'text', field: 'title', cls: 'title-xl', x: 160, y: 273, w: 800, ph: '감사합니다' },
      { k: 'text', field: 'sub', cls: 'sub', x: 165, y: 540, w: 760, ph: '마무리 한마디' },
      { k: 'text', field: 'name', cls: 'name', x: 165, y: 905, w: 700, ph: '발표자 이름' },
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

/* ===== 상태 ===== */
let deck;             // 맨 아래에서 loadDeck()로 채운다 (상수 선언 뒤에 실행해야 함)
let cur = 0;          // 현재 슬라이드
let sel = -1;         // 선택된 스티커 인덱스
let mode = 'edit';    // 'edit' | 'present'
let scale = 1;

const $ = id => document.getElementById(id);
const host = $('slideHost'), box = $('stageBox'), wrap = $('stageWrap');

const HINT = '텍스트를 클릭해서 바로 수정 · 스티커는 끌어서 이동, 모서리 점으로 크기 조절 · Delete로 삭제';
let loadWarning = '';

function loadDeck() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch (e) {
    // 저장된 내용이 깨졌다면 지우지 않고 복구용으로 따로 보관한다
    if (raw) {
      try { localStorage.setItem(STORE_KEY + '-broken', raw); } catch (e2) { /* 무시 */ }
      loadWarning = '⚠ 저장된 덱을 읽지 못해 새 덱으로 열었어요. 이전 내용은 브라우저에 복구용으로 남겨 두었어요.';
    }
  }
  return defaultDeck();
}
const MAX_SLIDES = 300, MAX_STICKERS = 100, MAX_TEXT = 5000;
const FIELDS = ['title', 'sub', 'name', 'body', 'bubble', 'num'];

// 허용한 필드만 새 객체로 복사한다. 잘못된 구조는 예외를 던져 호출한 쪽이 기존 덱을 지키게 한다.
function sanitize(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.slides) || !d.slides.length) {
    throw new Error('슬라이드가 없는 파일입니다.');
  }
  if (d.slides.length > MAX_SLIDES) throw new Error('슬라이드가 너무 많습니다.');
  const num = (v, min, max, dflt) => (Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : dflt);
  return {
    bg: Object.hasOwn(BG, d.bg) ? d.bg : 'ivory',
    font: typeof d.font === 'string' ? d.font.slice(0, 100) : '',
    anim: d.anim !== false,
    slides: d.slides.map(s => {
      if (!s || typeof s !== 'object' || !Object.hasOwn(TYPES, s.type)) throw new Error('알 수 없는 슬라이드 형태가 있습니다.');
      const out = { type: s.type, stickers: [] };
      for (const f of FIELDS) if (typeof s[f] === 'string') out[f] = s[f].slice(0, MAX_TEXT);
      for (const k of (Array.isArray(s.stickers) ? s.stickers : []).slice(0, MAX_STICKERS)) {
        // 이미지는 앱의 assets 폴더 안 파일만 허용한다 (외부 주소 차단)
        if (!k || typeof k.src !== 'string' || !/^assets\/[^"'<>\\:]+$/.test(k.src) || k.src.includes('..')) continue;
        const w = num(k.w, 40, W, 220);
        out.stickers.push({ src: k.src, w, x: num(k.x, -w / 2, W - w / 2, 0), y: num(k.y, -w / 2, H - w / 2, 0), float: k.float !== false });
      }
      return out;
    }),
  };
}

// 저장: 실패하면 화면에 알린다. 페이지를 닫기 전에는 즉시 저장한다.
let saveTimer = 0, dirty = false;
function save() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 200);
}
function flushSave() {
  clearTimeout(saveTimer);
  if (!dirty) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(deck));
    dirty = false;
    setStatus('');
  } catch (e) {
    setStatus('⚠ 자동 저장 실패: 브라우저 저장 공간을 쓸 수 없어요. [저장] 버튼으로 파일을 내려받아 두세요.');
  }
}
function setStatus(msg) {
  const el = $('hint');
  el.classList.toggle('warn', !!msg);
  el.textContent = msg || HINT;
}
window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });

/* ===== 렌더링 ===== */
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function slideHTML(slide, { editable, animate }) {
  const type = TYPES[slide.type];
  let n = 0;
  const parts = type.items.map(it => {
    const d = it.d ?? (0.1 + n * 0.15);
    if (it.k === 'text') {
      n++;
      const cls = animate ? 'fade-up' : '';
      const ce = editable ? ' contenteditable="plaintext-only" spellcheck="false"' : '';
      return `<div class="t ${it.cls} ${cls}" data-field="${it.field}" data-ph="${esc(it.ph)}"${ce}
        style="left:${it.x}px;top:${it.y}px;width:${it.w}px;--d:${d}s">${esc(slide[it.field])}</div>`;
    }
    if (it.k === 'img') {
      return `<img class="img ${animate ? it.anim : ''}" src="${it.src}" alt=""
        style="left:${it.x}px;top:${it.y}px;width:${it.w}px;--d:${0.35 + n * 0.1}s">`;
    }
    // 말풍선 도형 (꼬리가 오른쪽 캐릭터를 향함)
    return `<svg class="${animate ? 'bubble-pop' : ''}" style="left:0;top:0;--d:0.25s" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <path d="M190 315H1100Q1140 315 1140 355V535L1290 633L1140 628V650Q1140 690 1100 690H190Q150 690 150 650V355Q150 315 190 315Z"
        fill="#fefcf7" stroke="#a39b92" stroke-width="2"/></svg>`;
  });
  const stickers = (slide.stickers || []).map((s, i) => {
    const anim = animate ? (s.float === false ? 'pop' : 'pop float') : '';
    return `<div class="sticker ${anim}" data-i="${i}" style="left:${s.x}px;top:${s.y}px;width:${s.w}px;--d:${0.6 + i * 0.12}s">
      <img src="${esc(s.src)}" alt=""><i class="rs"></i></div>`;
  });
  return parts.join('') + stickers.join('');
}

function makeSlide(slide, opts) {
  const el = document.createElement('div');
  el.className = 'slide' + (opts.animate ? '' : ' no-anim') + (opts.enter ? ' enter' : '');
  el.style.backgroundImage = `url("${BG[deck.bg]}")`;
  if (deck.font) el.style.setProperty('--deck-font', `${deck.font}, var(--font)`);
  el.innerHTML = slideHTML(slide, opts);
  return el;
}

function fit() {
  const r = wrap.getBoundingClientRect();
  const pad = mode === 'present' ? 0 : 36;
  scale = Math.max(0.05, Math.min((r.width - pad) / W, (r.height - pad) / H));
  box.style.width = W * scale + 'px';
  box.style.height = H * scale + 'px';
  const el = host.firstElementChild;
  if (el) el.style.transform = `scale(${scale})`;
}

function renderStage() {
  const el = makeSlide(deck.slides[cur], { editable: mode === 'edit', animate: deck.anim, enter: true });
  host.replaceChildren(el);
  el.style.transform = `scale(${scale})`;
  fit();
  sel = -1;
  $('hud').textContent = `${cur + 1} / ${deck.slides.length}`;
}

function renderThumbs() {
  const list = $('thumbs');
  list.replaceChildren(...deck.slides.map((s, i) => {
    const t = document.createElement('button');
    t.type = 'button';
    t.className = 'thumb' + (i === cur ? ' active' : '');
    t.setAttribute('aria-label', `${i + 1}번 슬라이드 (${TYPES[s.type].label})`);
    if (i === cur) t.setAttribute('aria-current', 'true');
    const inner = makeSlide(s, { editable: false, animate: false });
    inner.classList.remove('enter');
    t.innerHTML = `<span class="no">${i + 1}</span><div class="box"></div>`;
    t.querySelector('.box').appendChild(inner);
    t.addEventListener('click', () => go(i));
    return t;
  }));
}

function syncToolbar() {
  $('selType').value = deck.slides[cur].type;
  $('selBg').value = deck.bg;
  $('inFont').value = deck.font;
  $('chkAnim').checked = deck.anim;
}

function go(i, force) {
  const next = Math.max(0, Math.min(deck.slides.length - 1, i));
  if (next === cur && !force && host.firstElementChild) return;   // 같은 장이면 애니메이션을 다시 돌리지 않음
  cur = next;
  renderStage(); renderThumbs(); syncToolbar();
  const a = $('thumbs').children[cur];
  if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' });
}

/* ===== 편집 ===== */
host.addEventListener('input', e => {
  const f = e.target.dataset && e.target.dataset.field;
  if (!f) return;
  deck.slides[cur][f] = e.target.innerText.replace(/\n$/, '');
  save(); refreshThumb();
});
let thumbTimer = 0;
function refreshThumb() {
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(() => {
    const t = $('thumbs').children[cur];
    if (!t) return;
    const inner = makeSlide(deck.slides[cur], { editable: false, animate: false });
    inner.classList.remove('enter');
    t.querySelector('.box').replaceChildren(inner);
  }, 250);
}

function selectSticker(i) {
  sel = i;
  host.querySelectorAll('.sticker').forEach(el => el.classList.toggle('sel', +el.dataset.i === i));
  const s = deck.slides[cur].stickers[i];
  if (s) $('chkStickerMove').checked = s.float !== false;
}

// 스티커 이동 / 크기 조절
host.addEventListener('pointerdown', e => {
  if (mode !== 'edit') return;
  const st = e.target.closest('.sticker');
  if (!st) { selectSticker(-1); return; }
  e.preventDefault();
  const i = +st.dataset.i, data = deck.slides[cur].stickers[i];
  selectSticker(i);
  const resizing = e.target.classList.contains('rs');
  const sx = e.clientX, sy = e.clientY, ox = data.x, oy = data.y, ow = data.w;
  st.classList.remove('pop', 'float'); st.style.animation = 'none';
  st.setPointerCapture(e.pointerId);
  const move = ev => {
    const dx = (ev.clientX - sx) / scale, dy = (ev.clientY - sy) / scale;
    if (resizing) {
      data.w = Math.min(W, Math.max(40, Math.round(ow + dx)));
      st.style.width = data.w + 'px';
    } else {
      // 최소 절반은 슬라이드 안에 남도록 제한해서 화면 밖으로 잃어버리지 않게 함
      data.x = Math.min(W - data.w / 2, Math.max(-data.w / 2, Math.round(ox + dx)));
      data.y = Math.min(H - data.w / 2, Math.max(-data.w / 2, Math.round(oy + dy)));
      st.style.left = data.x + 'px'; st.style.top = data.y + 'px';
    }
  };
  // 손을 떼거나 터치가 취소되거나 캡처를 잃어도 같은 방식으로 마무리한다
  const end = () => {
    st.removeEventListener('pointermove', move);
    st.removeEventListener('pointerup', end);
    st.removeEventListener('pointercancel', end);
    st.removeEventListener('lostpointercapture', end);
    save(); refreshThumb();
  };
  st.addEventListener('pointermove', move);
  st.addEventListener('pointerup', end);
  st.addEventListener('pointercancel', end);
  st.addEventListener('lostpointercapture', end);
});

function addSticker(src, w) {
  const slide = deck.slides[cur];
  slide.stickers.push({ src, x: Math.round(W / 2 - w / 2), y: Math.round(H / 2 - w / 2), w, float: true });
  save(); renderStage(); renderThumbs();
  selectSticker(slide.stickers.length - 1);
}
function deleteSticker() {
  if (sel < 0) return;
  deck.slides[cur].stickers.splice(sel, 1);
  save(); renderStage(); renderThumbs();
}

/* ===== 슬라이드 조작 ===== */
function addSlide(type) {
  const t = type in TYPES ? type : 'body';
  const s = { type: t, stickers: [] };
  deck.slides.splice(cur + 1, 0, s);
  save(); go(cur + 1);
}
function moveSlide(dir) {
  const j = cur + dir;
  if (j < 0 || j >= deck.slides.length) return;
  [deck.slides[cur], deck.slides[j]] = [deck.slides[j], deck.slides[cur]];
  cur = j; save(); renderThumbs(); syncToolbar();
}

/* ===== 발표 모드 ===== */
let idleTimer = 0;
function setMode(m) {
  mode = m;
  document.body.classList.toggle('present', m === 'present');
  document.body.classList.toggle('edit', m === 'edit');
  document.body.classList.remove('idle');
  renderStage(); syncToolbar();
  if (m === 'present') kickIdle(); else clearTimeout(idleTimer);
}
function kickIdle() {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add('idle'), 2200);
}
async function startPresent() {
  setMode('present');
  try { await document.documentElement.requestFullscreen(); } catch (e) { /* 전체 화면 실패 시에도 발표 모드는 유지 */ }
}
function endPresent() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  setMode('edit');
}
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && mode === 'present') setMode('edit');
  fit();
});
document.addEventListener('mousemove', () => { if (mode === 'present') kickIdle(); });
wrap.addEventListener('click', e => {
  if (mode !== 'present') return;
  const x = e.clientX / window.innerWidth;
  go(cur + (x < 0.3 ? -1 : 1));
});

/* ===== 키보드 ===== */
document.addEventListener('keydown', e => {
  if (e.isComposing || e.keyCode === 229) return;   // 한글 조합 중에는 앱 단축키를 건드리지 않음
  if (mode === 'present') kickIdle();
  // 입력창·버튼·링크처럼 자기 키 동작이 있는 요소에서는 슬라이드 이동 단축키를 쓰지 않음
  const typing = e.target.isContentEditable || /^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(e.target.tagName);
  if (e.key === 'Escape') {
    if (typing) { e.target.blur(); return; }
    if (mode === 'present') endPresent();
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  switch (e.key) {
    case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter':
      e.preventDefault(); go(cur + 1); break;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
      e.preventDefault(); go(cur - 1); break;
    case 'Home': go(0); break;
    case 'End': go(deck.slides.length - 1); break;
    case 'f': case 'F': case 'p': case 'P':
      mode === 'present' ? endPresent() : startPresent(); break;
    case 'Delete':
      if (mode === 'edit') deleteSticker(); break;
  }
});

/* ===== 툴바 연결 ===== */
function buildToolbar() {
  const add = $('selAdd'), typeSel = $('selType');
  for (const [k, v] of Object.entries(TYPES)) {
    add.add(new Option(v.label, k));
    typeSel.add(new Option(v.label, k));
  }
  add.addEventListener('change', () => { if (add.value) addSlide(add.value); add.value = ''; });
  typeSel.addEventListener('change', () => { deck.slides[cur].type = typeSel.value; save(); renderStage(); renderThumbs(); });
  $('btnPresent').addEventListener('click', startPresent);
  $('btnDup').addEventListener('click', () => {
    deck.slides.splice(cur + 1, 0, JSON.parse(JSON.stringify(deck.slides[cur])));
    save(); go(cur + 1);
  });
  $('btnUp').addEventListener('click', () => moveSlide(-1));
  $('btnDown').addEventListener('click', () => moveSlide(1));
  $('btnDel').addEventListener('click', () => {
    if (deck.slides.length === 1) return;
    if (!confirm('이 슬라이드를 삭제할까요?')) return;
    deck.slides.splice(cur, 1); save(); go(Math.min(cur, deck.slides.length - 1));
  });
  $('selBg').addEventListener('change', e => { deck.bg = e.target.value; save(); renderStage(); renderThumbs(); });
  $('inFont').addEventListener('change', e => { deck.font = e.target.value.trim(); save(); renderStage(); renderThumbs(); });
  $('chkAnim').addEventListener('change', e => { deck.anim = e.target.checked; save(); renderStage(); });

  $('btnSticker').addEventListener('click', () => { $('stickerPanel').hidden = !$('stickerPanel').hidden; });
  $('btnPanelClose').addEventListener('click', () => { $('stickerPanel').hidden = true; });
  $('btnStickerDel').addEventListener('click', deleteSticker);
  $('chkStickerMove').addEventListener('change', e => {
    const keep = sel, s = deck.slides[cur].stickers[keep];
    if (!s) return;
    s.float = e.target.checked; save(); renderStage(); selectSticker(keep);   // renderStage가 선택을 지우므로 먼저 보관
  });
  const grid = $('stickerGrid');
  STICKERS.forEach(st => {
    const b = document.createElement('button');
    const img = new Image();
    img.src = st.src; img.alt = '';
    img.onerror = () => b.remove();   // 아직 생성되지 않은 스티커는 숨김
    const label = decodeURIComponent(st.src.split('/').pop()).replace(/\.png$/, '').replace(/^sticker_/, '');
    b.setAttribute('aria-label', `스티커 추가: ${label}`);
    b.title = label;
    b.appendChild(img);
    b.addEventListener('click', () => addSticker(st.src, st.w));
    grid.appendChild(b);
  });

  $('btnExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'any-slide-deck.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('btnImport').addEventListener('click', () => $('fileImport').click());
  $('fileImport').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    // 후보 덱을 끝까지 검증하고 렌더링해 본 뒤에만 현재 덱을 바꾼다. 실패하면 기존 덱을 그대로 둔다.
    const prev = deck, prevCur = cur;
    try {
      const next = sanitize(JSON.parse(await f.text()));
      next.slides.forEach(s => slideHTML(s, { editable: false, animate: false }));
      deck = next; cur = 0; save(); go(0, true);
    } catch (err) {
      deck = prev; cur = prevCur;
      alert('불러오지 못했어요. 올바른 덱 파일이 아니에요. (' + err.message + ')\n지금 편집 중인 덱은 그대로 두었어요.');
    }
  });
  $('btnReset').addEventListener('click', () => {
    if (!confirm('모든 편집 내용을 지우고 처음 상태로 되돌릴까요?')) return;
    deck = defaultDeck(); cur = 0; save(); go(0);
  });
}

window.addEventListener('resize', fit);
deck = loadDeck();
buildToolbar();
if (loadWarning) setStatus(loadWarning);
// 해시로 시작 위치 지정: #s=3 (슬라이드 번호), #s=3&view (전체 화면 없이 발표 화면으로 열기)
const hash = new URLSearchParams(location.hash.slice(1));
go(Math.max(0, (parseInt(hash.get('s'), 10) || 1) - 1));
if (hash.has('view')) setMode('present');
