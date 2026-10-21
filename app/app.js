'use strict';

/* ===== 상수 ===== */
const STORE_KEY = 'any-slide-deck-v1';
// W, H, BG, STICKERS, TYPES, defaultDeck, sanitize 는 deck-spec.js 에 있다

/* ===== 상태 ===== */
let deck;             // 맨 아래에서 loadDeck()로 채운다 (상수 선언 뒤에 실행해야 함)
let cur = 0;          // 현재 슬라이드
let sel = -1;         // 선택된 스티커 인덱스
let mode = 'edit';    // 'edit' | 'present'
let scale = 1;

const $ = id => document.getElementById(id);
const host = $('slideHost'), box = $('stageBox'), wrap = $('stageWrap');

const HINT = '텍스트를 클릭해서 바로 수정 · 스티커는 끌어서 이동, 모서리 점으로 크기 조절 · Delete로 삭제';
let loadWarning = '', brokenRaw = null;

function loadDeck() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch (e) {
    if (raw) {
      // 깨진 저장값은 지우지 않고 복구용으로 따로 보관한다. 보관에 실패하면 시작할 때 파일로 내려받게 한다.
      try {
        localStorage.setItem(STORE_KEY + '-broken', raw);
        loadWarning = '⚠ 저장된 덱을 읽지 못해 새 덱으로 열었어요. 이전 내용은 브라우저에 복구용으로 남겨 두었어요.';
      } catch (e2) {
        brokenRaw = raw;
        loadWarning = '⚠ 저장된 덱을 읽지 못해 새 덱으로 열었어요. 복구용 보관에 실패했어요.';
      }
    } else {
      loadWarning = '⚠ 브라우저 저장 공간을 읽지 못해 새 덱으로 열었어요.';
    }
  }
  return defaultDeck();
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
    if (saveFailed) { saveFailed = false; setStatus(''); updateHud(); }   // 불러오기 경고는 저장 성공으로 지우지 않음
  } catch (e) {
    saveFailed = true;
    setStatus('⚠ 자동 저장 실패: 브라우저 저장 공간을 쓸 수 없어요. [저장] 버튼으로 파일을 내려받아 두세요.');
    updateHud();
  }
}
let saveFailed = false;
function setStatus(msg) {
  const el = $('hint');
  el.classList.toggle('warn', !!msg);
  el.textContent = msg || HINT;
}
// 발표 중에는 안내줄이 숨으므로 저장 실패를 쪽 번호 옆에 함께 보여 준다
function updateHud() {
  $('hud').textContent = `${cur + 1} / ${deck.slides.length}` + (saveFailed ? ' · ⚠ 저장 안 됨' : '');
}
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
  const ce = editable ? ' contenteditable="plaintext-only" spellcheck="false"' : '';
  const anim = animate ? 'fade-up' : '';
  const text = (t, d, pos = '', attrs = '') => `<div class="t ${t.cls} ${anim}" data-field="${t.field}" data-ph="${esc(t.ph)}"${attrs}${ce}
    style="${pos}--d:${d}s">${esc(slide[t.field])}</div>`;
  const parts = type.items.map(it => {
    const d = it.d ?? (0.1 + n * 0.15);
    if (it.k === 'text') {
      n++;
      return text(it, d, `left:${it.x}px;top:${it.y}px;width:${it.w}px;`, ` data-h="${it.h}"`);
    }
    if (it.k === 'stack') {
      const inner = it.items.map(t => text(t, 0.1 + (n++) * 0.15)).join('');
      return `<div class="stack" data-h="${it.h}" style="left:${it.x}px;top:${it.y}px;width:${it.w}px;gap:${it.gap}px">${inner}</div>`;
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

// 글자 칸(data-h)이 정해진 높이를 넘으면 글자 크기를 단계적으로 줄인다(최소 55%).
// 그래도 넘치면 .over를 붙여 편집 화면에서 알린다. 문서에 붙어 보이는 상태에서 불러야 높이를 잴 수 있다.
// 높이는 offsetHeight로 잰다: 등장 애니메이션의 transform 영향을 받지 않는다.
const FIT_MIN = 0.55;
function fitBox(boxEl) {
  if (!boxEl.offsetParent) return;   // 숨겨진 요소(발표 중 썸네일 등)는 잴 수 없으니 그대로 둔다
  const h = +boxEl.dataset.h;
  const texts = boxEl.classList.contains('t') ? [boxEl] : [...boxEl.querySelectorAll('.t')];
  texts.forEach(t => { t.style.fontSize = ''; });
  const base = texts.map(t => parseFloat(getComputedStyle(t).fontSize));
  let k = 1;
  while (boxEl.offsetHeight > h + 1 && k > FIT_MIN) {
    k = Math.max(FIT_MIN, k - 0.05);
    texts.forEach((t, i) => { t.style.fontSize = base[i] * k + 'px'; });
  }
  boxEl.classList.toggle('over', boxEl.offsetHeight > h + 1);
}
function fitText(root) {
  root.querySelectorAll('[data-h]').forEach(fitBox);
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
  fitText(el);
  fit();
  sel = -1;
  updateHud();
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
  fitText(list);
}

function syncToolbar() {
  $('selType').value = deck.slides[cur].type;
  $('selBg').value = deck.bg;
  $('inFont').value = deck.font;
  $('chkAnim').checked = deck.anim;
}

function go(i, force) {
  const next = Math.max(0, Math.min(deck.slides.length - 1, i));
  // 같은 장으로 이동하면 애니메이션을 다시 돌리지 않는다. 덱 내용이 바뀐 경우(삭제, 초기화 등)는 force로 부른다.
  if (next === cur && !force && host.firstElementChild) return;
  const thumbFocused = document.activeElement && document.activeElement.classList.contains('thumb');
  cur = next;
  renderStage(); renderThumbs(); syncToolbar();
  const a = $('thumbs').children[cur];
  if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' });
  if (a && thumbFocused) a.focus();   // 썸네일 목록을 새로 만들어도 키보드 포커스를 이어 준다
}

/* ===== 편집 ===== */
host.addEventListener('input', e => {
  const f = e.target.dataset && e.target.dataset.field;
  if (!f) return;
  deck.slides[cur][f] = e.target.innerText.replace(/\n$/, '');
  const boxEl = e.target.closest('[data-h]');
  if (boxEl) fitBox(boxEl);   // 입력 중인 칸만 다시 맞춘다 (커서는 그대로)
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
    fitText(inner);
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
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const move = ev => {
    const dx = (ev.clientX - sx) / scale, dy = (ev.clientY - sy) / scale;
    if (resizing) {
      data.w = clamp(Math.round(ow + dx), 40, W);
      st.style.width = data.w + 'px';
    } else {
      data.x = Math.round(ox + dx); data.y = Math.round(oy + dy);
    }
    // 이동이든 크기 조절이든 가로세로 절반 이상은 슬라이드 안에 남겨서 잃어버리지 않게 한다.
    // 세로는 실제 그려진 높이(이미지 비율 반영)를 쓴다.
    const hh = st.offsetHeight || data.w;
    data.x = clamp(data.x, -Math.round(data.w / 2), W - Math.round(data.w / 2));
    data.y = clamp(data.y, -Math.round(hh / 2), H - Math.round(hh / 2));
    st.style.left = data.x + 'px'; st.style.top = data.y + 'px';
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
  if (slide.stickers.length >= MAX_STICKERS) { alert(`한 장에는 스티커를 ${MAX_STICKERS}개까지 넣을 수 있어요.`); return; }
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
function canAddSlide() {
  if (deck.slides.length < MAX_SLIDES) return true;
  alert(`슬라이드는 ${MAX_SLIDES}장까지 만들 수 있어요.`);
  return false;
}
function addSlide(type) {
  if (!canAddSlide()) return;
  const t = Object.hasOwn(TYPES, type) ? type : 'body';
  deck.slides.splice(cur + 1, 0, { type: t, stickers: [] });
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
  if (m === 'present') kickIdle();
  else { clearTimeout(idleTimer); fitText($('thumbs')); }   // 발표 중 숨어 있던 썸네일은 보일 때 다시 맞춘다
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
    if (!canAddSlide()) return;
    deck.slides.splice(cur + 1, 0, JSON.parse(JSON.stringify(deck.slides[cur])));
    save(); go(cur + 1);
  });
  $('btnUp').addEventListener('click', () => moveSlide(-1));
  $('btnDown').addEventListener('click', () => moveSlide(1));
  $('btnDel').addEventListener('click', () => {
    if (deck.slides.length === 1) return;
    if (!confirm('이 슬라이드를 삭제할까요?')) return;
    deck.slides.splice(cur, 1); save(); go(Math.min(cur, deck.slides.length - 1), true);
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
    download('any-slide-deck.json', JSON.stringify(deck, null, 2));
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
    deck = defaultDeck(); cur = 0; save(); go(0, true);
  });
}

window.addEventListener('resize', fit);
// 글꼴이 늦게 로드되면 글자 높이가 바뀌므로 다시 맞춘다
if (document.fonts) document.fonts.addEventListener('loadingdone', () => { fitText(host); fitText($('thumbs')); });
deck = loadDeck();
buildToolbar();
if (loadWarning) setStatus(loadWarning);
// 깨진 저장값을 브라우저에 따로 보관하지 못했다면, 덮어쓰기 전에 파일로 받을 기회를 준다
if (brokenRaw && confirm('저장된 덱을 읽지 못했고 복구용 보관에도 실패했어요.\n편집을 시작하면 덮어써지니, 원본을 파일로 내려받을까요?')) {
  download('any-slide-broken-backup.json', brokenRaw);
}
// 해시로 시작 위치 지정: #s=3 (슬라이드 번호), #s=3&view (전체 화면 없이 발표 화면으로 열기)
const hash = new URLSearchParams(location.hash.slice(1));
go(Math.max(0, (parseInt(hash.get('s'), 10) || 1) - 1));
if (hash.has('view')) setMode('present');
