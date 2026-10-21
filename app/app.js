'use strict';

/* ===== 상수 ===== */
const STORE_KEY = 'any-slide-deck-v1';
// W, H, BG, STICKERS, PALETTE, TYPES, defaultDeck, sanitize, 서식 표기 함수는 deck-spec.js 에 있다

/* ===== 상태 ===== */
let deck;             // 맨 아래에서 loadDeck()로 채운다 (상수 선언 뒤에 실행해야 함)
let cur = 0;          // 현재 슬라이드
let sel = -1;         // 선택된 스티커 인덱스
let mode = 'edit';    // 'edit' | 'present'
let scale = 1;
let curEl = null;     // 지금 보이는 장 요소 (전환 중에는 나가는 장이 하나 더 있다)
let activeText = null;  // 편집 중인 글자 칸
let slotPick = false;   // 스티커 패널을 그림 칸 고르기로 열었는지

const $ = id => document.getElementById(id);
const host = $('slideHost'), box = $('stageBox'), wrap = $('stageWrap');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const HINT = '글자를 누르면 글자 도구, 스티커를 누르면 크기·회전·순서 도구가 위에 나와요 · 화살표로 스티커 이동, Delete로 삭제';
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
let saveTimer = 0, dirty = false, saveFailed = false;
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

/* ===== 서식 있는 글자: 표기 ↔ 화면 ===== */
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function runsToHTML(runs) {
  return runs.map(r => {
    let h = esc(r.text).replace(/\n/g, '<br>');
    if (r.c) h = `<span class="c-${r.c}">${h}</span>`;
    if (r.m) h = `<mark>${h}</mark>`;
    if (r.u) h = `<u>${h}</u>`;
    if (r.b) h = `<b>${h}</b>`;
    return h;
  }).join('');
}
// 글이 줄바꿈으로 끝나면 빈 줄이 보이도록 <br>을 하나 더 둔다 (아래 domItems의 "블록의 마지막 <br>은 자리 채움" 규칙과 짝).
// 판단은 표기 원문이 아니라 실제 글자로 한다: **A\n** 처럼 서식 안의 끝 줄바꿈도 같다.
function markupToHTML(s) {
  const runs = parseMarkup(String(s ?? ''));
  const text = runs.map(r => r.text).join('');
  return runsToHTML(runs) + (text.endsWith('\n') ? '<br>' : '');
}
function plainToHTML(s) {
  const str = String(s ?? '');
  return esc(str).replace(/\n/g, '<br>') + (str.endsWith('\n') ? '<br>' : '');
}

// 편집 중인 칸의 DOM을 글자 조각 목록으로 읽는다. 브라우저가 Enter로 만든 <div>, <br>도 줄바꿈으로 친다.
const BLOCK = /^(DIV|P|LI|H[1-6])$/;
function domItems(root) {
  const items = [];
  // 블록(<div> 등)이 끝난 뒤 글이 이어지면 그 사이도 줄바꿈이다. 다음 글자가 올 때 넣는다.
  let afterBlock = null;
  const push = it => {
    if (afterBlock && items.length) items.push({ node: afterBlock, text: '\n', st: it.st, block: it.block });
    afterBlock = null;
    items.push(it);
  };
  const walk = (node, st, block) => {
    for (const ch of node.childNodes) {
      if (ch.nodeType === 3) { if (ch.data) push({ node: ch, text: ch.data, st, block }); continue; }
      if (ch.nodeType !== 1) continue;
      if (ch.tagName === 'BR') { push({ node: ch, text: '\n', st, block, br: true }); continue; }
      let s2 = st;
      if (ch.tagName === 'B' || ch.tagName === 'STRONG') s2 = { ...s2, b: true };
      else if (ch.tagName === 'U') s2 = { ...s2, u: true };
      else if (ch.tagName === 'MARK') s2 = { ...s2, m: true };
      const cm = /(?:^|\s)c-([a-z]+)/.exec(ch.className || '');
      if (cm && Object.hasOwn(PALETTE, cm[1])) s2 = { ...s2, c: cm[1] };
      if (BLOCK.test(ch.tagName)) {
        if (items.length) items.push({ node: ch, text: '\n', st, block });   // 블록 앞은 줄바꿈
        afterBlock = null;
        walk(ch, s2, ch);
        afterBlock = ch;
      } else walk(ch, s2, block);
    }
  };
  walk(root, { b: false, u: false, m: false, c: null }, root);
  // 블록마다 마지막 <br>은 빈 줄을 보이게 하려는 자리 채움이라 글자로 치지 않는다
  const last = new Map();
  items.forEach((it, i) => last.set(it.block, i));
  const out = items.filter((it, i) => !(it.br && last.get(it.block) === i));
  let pos = 0;
  for (const it of out) { it.start = pos; pos += it.text.length; }
  out.total = pos;
  return out;
}
function itemsToRuns(items) {
  const runs = [];
  for (const it of items) {
    const prev = runs[runs.length - 1];
    if (prev && prev.b === it.st.b && prev.u === it.st.u && prev.m === it.st.m && prev.c === it.st.c) prev.text += it.text;
    else runs.push({ text: it.text, ...it.st });
  }
  return runs;
}
function elToMarkup(el) {
  return runsToMarkup(itemsToRuns(domItems(el)));
}

// 선택 위치(DOM) ↔ 글자 위치(숫자)
function pointToOffset(items, node, offset) {
  if (node.nodeType === 3) {
    const it = items.find(x => x.node === node);
    if (it) return it.start + Math.min(offset, it.text.length);
  }
  let ref, after = false;
  if (node.nodeType === 3) { ref = node; after = offset > 0; }
  else if (offset < node.childNodes.length) ref = node.childNodes[offset];
  else { ref = node; after = true; }
  for (const it of items) {
    const pos = ref.compareDocumentPosition(it.node);
    const inside = ref === it.node || (pos & Node.DOCUMENT_POSITION_CONTAINED_BY);
    const following = pos & Node.DOCUMENT_POSITION_FOLLOWING;
    if (after ? (following && !inside) : (inside || following)) return it.start;
  }
  return items.total;
}
function offsetToPoint(items, root, off) {
  for (const it of items) {
    if (!it.br && it.node.nodeType === 3 && off >= it.start && off <= it.start + it.text.length) return [it.node, off - it.start];
  }
  for (const it of items) {
    if (it.start === off) {
      const p = it.node.parentNode;
      return [p, [...p.childNodes].indexOf(it.node)];
    }
  }
  return [root, root.childNodes.length];
}
function selectionOffsets(el, items) {
  const s = window.getSelection();
  if (!s.rangeCount) return null;
  const r = s.getRangeAt(0);
  if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return null;
  return [pointToOffset(items, r.startContainer, r.startOffset), pointToOffset(items, r.endContainer, r.endOffset)];
}
function restoreSelection(el, a, b) {
  const items = domItems(el);
  const r = document.createRange();
  r.setStart(...offsetToPoint(items, el, a));
  r.setEnd(...offsetToPoint(items, el, b));
  const s = window.getSelection();
  s.removeAllRanges(); s.addRange(r);
}

/* ===== 렌더링 ===== */
function fxClasses(animate) {
  const set = deck.settings;
  return {
    text: animate && set.textAnim !== 'none' ? (set.textAnim === 'fly' ? 'fx-fly' : 'fx-fade') : '',
    // 그림 등장(pop, rise …)과 둥실둥실(float)은 따로 켜고 끈다
    img: anim => {
      if (!animate) return '';
      const base = anim.replace('float', '').trim();
      return [set.imgAnim ? base : '', set.float && anim.includes('float') ? 'float' : ''].join(' ').trim();
    },
    pop: animate && set.imgAnim,
    float: animate && set.float,
  };
}

function slideHTML(slide, { editable, animate }) {
  const fx = fxClasses(animate);
  const styles = slide.styles || {};
  let n = 0;
  const nextD = () => 0.1 + (n++) * 0.15;
  const ceAttr = plain => (editable ? (plain ? ' contenteditable="plaintext-only"' : ' contenteditable="true"') + ' spellcheck="false"' : '');
  const boxStyle = (field, align) => {
    const st = styles[field] || {};
    return (st.scale ? `--k:${st.scale};` : '') + ((st.align || align) ? `text-align:${st.align || align};` : '') + (st.lh ? `line-height:${st.lh};` : '');
  };
  // 글자 칸 하나. pos가 있으면 절대 위치, 없으면 묶음 안에서 흐른다
  const text = (t, pos = '', fit = null) => {
    const plain = !!t.plain || PLAIN_FIELDS.has(t.field);
    const v = slide[t.field] ?? '';
    const attrs = (fit ? ` data-h="${fit.h}"` + (fit.grow ? ` data-grow="${fit.grow}"` : '') : '') + (plain ? ' data-plain="1"' : '')
      + (t.align ? ` data-align0="${t.align}"` : '');   // 형태의 기본 정렬 (도구 줄 표시와 되돌리기에 쓴다)
    return `<div class="t ${t.cls} ${fx.text}" data-field="${t.field}" data-ph="${esc(t.ph || '')}"${attrs}${ceAttr(plain)}`
      + ` style="${pos}--d:${nextD()}s;${boxStyle(t.field, t.align)}">${plain ? plainToHTML(v) : markupToHTML(v)}</div>`;
  };
  const at = it => `left:${it.x}px;top:${it.y}px;width:${it.w}px;`;
  const rect = it => `${at(it)}height:${it.h}px;`;

  const parts = [];
  for (const it of TYPES[slide.type].items) {
    if (it.k === 'text') parts.push(text(it, at(it), it));
    else if (it.k === 'stack') {
      const inner = it.items.map(t => text(t)).join('');
      parts.push(`<div class="stack${it.center ? ' center' : ''}" data-h="${it.h}"${it.grow ? ` data-grow="${it.grow}"` : ''}${it.center ? ' data-center="1"' : ''}`
        + ` style="${at(it)}gap:${it.gap}px;${it.center ? `height:${it.h}px;` : ''}">${inner}</div>`);
    }
    else if (it.k === 'img') {
      parts.push(`<img class="img ${fx.img(it.anim)}" src="${it.src}" alt="" style="${at(it)}--d:${0.35 + n * 0.1}s">`);
    }
    else if (it.k === 'bubble') {
      // 말풍선 도형 (꼬리가 오른쪽 캐릭터를 향함)
      parts.push(`<svg class="${fx.pop ? 'bubble-pop' : ''}" style="left:0;top:0;--d:0.25s" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <path d="M190 315H1100Q1140 315 1140 355V535L1290 633L1140 628V650Q1140 690 1100 690H190Q150 690 150 650V355Q150 315 190 315Z"
          fill="#fefcf7" stroke="#a39b92" stroke-width="2"/></svg>`);
    }
    else if (it.k === 'panel') parts.push(`<div class="panel${it.tone === 'dark' ? ' dark' : ''} ${fx.text ? 'fx-fade' : ''}" style="${rect(it)}--d:0s"></div>`);
    else if (it.k === 'deco') parts.push(`<div class="${it.cls}" style="left:${it.x}px;top:${it.y}px">${esc(it.text)}</div>`);
    else if (it.k === 'cards' || it.k === 'steps') {
      const steps = it.k === 'steps';
      const cells = groupLayout(it, countOf(slide));
      cells.forEach((c, i) => {
        parts.push(`<div class="panel ${fx.text ? 'fx-fade' : ''}" style="${rect(c.box)}--d:${0.05 + i * 0.12}s"></div>`);
        if (steps) {
          parts.push(`<div class="badge ${fx.pop ? 'pop' : ''}" style="left:${c.box.x + c.box.w / 2 - 48}px;top:${c.box.y + 36}px;--d:${0.2 + i * 0.15}s">${c.no}</div>`);
          if (i < cells.length - 1) parts.push(`<div class="arrow" style="left:${c.box.x + c.box.w + it.gap / 2 - 22}px;top:${c.box.y + c.box.h / 2 - 50}px">›</div>`);
        }
        parts.push(text({ field: c.head.field, cls: steps ? 'head' : 'head acc-blue', ph: `${c.no}번 제목`, align: steps ? 'center' : '' }, at(c.head), { h: c.head.h }));
        parts.push(text({ field: c.body.field, cls: 'card', ph: '내용', align: steps ? 'center' : '' }, at(c.body), { h: c.body.h, grow: 1.4 }));
      });
    }
    else if (it.k === 'table') {
      const rows = parseTable(slide.table ?? '');
      const cols = rows[0].length;
      const cellStyle = boxStyle('table');
      const cells = rows.flatMap((r, ri) => r.map((v, ci) => {
        const cls = ['t', 'cell', ri === 0 ? 'th' : '', ci === cols - 1 ? 'last-col' : '', ri === rows.length - 1 ? 'last-row' : ''].join(' ');
        return `<div class="${cls}" data-cell="${ri},${ci}" data-ph=""${ceAttr(false)} style="${cellStyle}">${markupToHTML(v)}</div>`;
      })).join('');
      parts.push(`<div class="table ${fx.text ? 'fx-fade' : ''}" data-field="table" data-h="${it.h}"${it.grow ? ` data-grow="${it.grow}"` : ''}`
        + ` style="${at(it)}grid-template-columns:repeat(${cols},minmax(0,1fr));--d:${nextD()}s">${cells}</div>`);
    }
    else if (it.k === 'slot') {
      const img = slide.img ? `<img class="${fx.pop ? 'pop' : ''}" src="${esc(slide.img)}" alt="" style="--d:0.3s">` : (editable ? '그림 고르기' : '');
      parts.push(`<div class="slot${slide.img ? '' : ' empty'}" data-slot="1" style="${rect(it)}">${img}</div>`);
    }
  }
  // 스티커: 바깥은 위치와 등장 효과, 안쪽은 회전, 그림은 뒤집기
  const stickers = (slide.stickers || []).map((s, i) => {
    const anim = [fx.pop ? 'pop' : '', fx.float && s.float !== false ? 'float' : ''].join(' ').trim();
    return `<div class="sticker ${anim}" data-i="${i}" style="left:${s.x}px;top:${s.y}px;width:${s.w}px;--d:${0.6 + i * 0.12}s">`
      + `<div class="rot" style="transform:rotate(${s.rot || 0}deg)"><img class="${s.flip ? 'flip' : ''}" src="${esc(s.src)}" alt="">`
      + `<i class="h nw"></i><i class="h ne"></i><i class="h sw"></i><i class="h se"></i><i class="h turn" title="돌리기 (Shift: 15도씩)"></i></div></div>`;
  });
  return parts.join('') + stickers.join('');
}

function makeSlide(slide, opts) {
  const el = document.createElement('div');
  el.className = 'slide' + (opts.animate ? '' : ' no-anim');
  el.style.backgroundImage = `url("${BG[deck.bg]}")`;
  el.style.setProperty('--t0', (opts.t0 || 0) + 's');
  if (deck.font) el.style.setProperty('--deck-font', `${deck.font}, var(--font)`);
  el.innerHTML = slideHTML(slide, opts);
  return el;
}

/* ===== 글자 자동 맞춤 =====
   글자 칸(data-h)이 정해진 높이를 넘으면 글자 크기를 단계적으로 줄인다(최소 55%).
   data-grow가 있으면 남을 때 그 배율까지 키워 칸을 채운다. 그래도 넘치면 .over로 편집 화면에 알린다.
   높이는 offsetHeight로 잰다(등장 애니메이션의 transform 영향 없음). 보이는 상태에서만 잴 수 있다. */
const FIT_MIN = 0.55;
function contentHeight(boxEl) {
  if (!boxEl.hasAttribute('data-center')) return boxEl.offsetHeight;
  const kids = boxEl.children;
  if (!kids.length) return 0;
  const a = kids[0], b = kids[kids.length - 1];
  return b.offsetTop + b.offsetHeight - a.offsetTop;
}
function fitBox(boxEl) {
  if (!boxEl.offsetParent) return;   // 숨겨진 요소(발표 중 썸네일 등)는 잴 수 없으니 그대로 둔다
  const h = +boxEl.dataset.h, grow = +boxEl.dataset.grow || 1;
  const texts = boxEl.classList.contains('t') ? [boxEl] : [...boxEl.querySelectorAll('.t')];
  texts.forEach(t => { t.style.fontSize = ''; });
  const base = texts.map(t => parseFloat(getComputedStyle(t).fontSize));
  const setK = k => texts.forEach((t, i) => { t.style.fontSize = base[i] * k + 'px'; });
  let k = 1;
  if (contentHeight(boxEl) > h + 1) {
    while (contentHeight(boxEl) > h + 1 && k > FIT_MIN) { k = Math.max(FIT_MIN, k - 0.05); setK(k); }
  } else if (grow > 1 && texts.some(t => t.textContent.trim())) {
    while (k < grow) {
      const k2 = Math.min(grow, k + 0.05);
      setK(k2);
      if (contentHeight(boxEl) > h + 1) { setK(k); break; }
      k = k2;
    }
  }
  boxEl.classList.toggle('over', contentHeight(boxEl) > h + 1);
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
  host.style.setProperty('--stage-w', W * scale + 'px');
  host.style.setProperty('--stage-h', H * scale + 'px');
  host.querySelectorAll(':scope > .slide').forEach(el => { el.style.transform = `scale(${scale})`; });
}

/* ===== 무대와 장 전환 =====
   opts.tr: { kind, dur, back } 이면 새 장을 이전 장 위로 겹쳐 들이고 끝나면 이전 장을 지운다.
   opts.still: 편집 중 다시 그리기 — 등장 애니메이션 없이 그린다. */
function renderStage(opts = {}) {
  const tr = opts.tr && opts.tr.kind !== 'none' ? opts.tr : null;
  const el = makeSlide(deck.slides[cur], { editable: mode === 'edit', animate: !opts.still, t0: tr ? tr.dur / 2 : 0 });
  host.querySelectorAll(':scope > .slide.tr-out').forEach(x => x.remove());
  const prev = curEl && curEl.parentNode === host ? curEl : null;
  host.appendChild(el);
  curEl = el;
  if (prev) {
    if (tr) {
      prev.inert = true;
      prev.classList.remove('tr-in', 'tr-fade', 'tr-slide', 'tr-zoom', 'tr-rise', 'back');
      for (const x of [el, prev]) {
        x.style.setProperty('--tdur', tr.dur + 's');
        x.classList.add('tr-' + tr.kind);
        if (tr.back) x.classList.add('back');
      }
      el.classList.add('tr-in');
      prev.classList.add('tr-out');
      setTimeout(() => prev.remove(), tr.dur * 1000 + 80);
    } else prev.remove();
  }
  fit();
  fitText(el);
  if (!opts.keepSel) sel = -1;
  activeText = null;
  updateHud();
  renderCtx();
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
    t.innerHTML = `<span class="no">${i + 1}</span><div class="box"></div>`;
    t.querySelector('.box').appendChild(inner);
    t.addEventListener('click', () => go(i));
    return t;
  }));
  fitText(list);
}
let thumbTimer = 0;
function refreshThumb() {
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(() => {
    const t = $('thumbs').children[cur];
    if (!t) return;
    const inner = makeSlide(deck.slides[cur], { editable: false, animate: false });
    t.querySelector('.box').replaceChildren(inner);
    fitText(inner);
  }, 250);
}

function transitionFor(slide, back) {
  return { kind: slide.transition || deck.settings.transition, dur: deck.settings.duration, back };
}
function go(i, force) {
  const next = clamp(i, 0, deck.slides.length - 1);
  // 같은 장으로 이동하면 다시 그리지 않는다. 덱 내용이 바뀐 경우(삭제, 초기화 등)는 force로 부르고 전환 효과는 없다.
  if (next === cur && !force && curEl) return;
  const thumbFocused = document.activeElement && document.activeElement.classList.contains('thumb');
  const tr = !force && curEl ? transitionFor(deck.slides[next], next < cur) : null;
  cur = next;
  renderStage({ tr }); renderThumbs(); syncToolbar();
  const a = $('thumbs').children[cur];
  if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' });
  if (a && thumbFocused) a.focus();   // 썸네일 목록을 새로 만들어도 키보드 포커스를 이어 준다
}
// 편집으로 바뀐 현재 장을 애니메이션 없이 다시 그린다
function redraw(keepSel) {
  renderStage({ still: true, keepSel });
  renderThumbs();
  if (keepSel) selectSticker(sel);
}

/* ===== 글자 편집 ===== */
const isRich = el => !el.dataset.plain;
function readTable(tableEl) {
  const rows = [];
  tableEl.querySelectorAll('[data-cell]').forEach(c => {
    const [r, col] = c.dataset.cell.split(',').map(Number);
    (rows[r] ||= [])[col] = elToMarkup(c).replace(/\n/g, ' ');
  });
  return tableToString(rows);
}
// 편집한 칸의 값을 덱에 적는다
function commitText(el) {
  const slide = deck.slides[cur];
  if (el.dataset.cell) slide.table = readTable(el.closest('.table'));
  else if (el.dataset.plain) slide[el.dataset.field] = domItems(el).map(i => i.text).join('');   // 서식 칸과 같은 줄바꿈 규칙
  else slide[el.dataset.field] = elToMarkup(el);
  if (!el.textContent && el.innerHTML) el.innerHTML = '';   // 비우면 안내 문구가 다시 보이게
  const boxEl = el.closest('[data-h]');
  if (boxEl) fitBox(boxEl);   // 입력 중인 칸만 다시 맞춘다 (커서는 그대로)
  save(); refreshThumb();
}
host.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset && (el.dataset.field || el.dataset.cell)) commitText(el);
});
// 붙여넣기는 글자만 받는다 (다른 곳의 서식, 그림이 섞이지 않게)
host.addEventListener('paste', e => {
  if (!e.target.isContentEditable) return;
  e.preventDefault();
  let t = e.clipboardData.getData('text/plain');
  if (e.target.closest('[data-cell]')) t = t.replace(/\s*\n\s*/g, ' ');
  document.execCommand('insertText', false, t);
});
host.addEventListener('focusin', e => {
  const t = e.target.closest && e.target.closest('.t[contenteditable]');
  if (!t) return;
  if (t !== activeText) lastRange = null;
  activeText = t;
  if (sel >= 0) selectSticker(-1, true);
  renderCtx();
});
// 편집 칸에서 도구 줄로 포커스가 옮겨 가면(Tab 등) 편집 중인 칸을 그대로 둔다. 둘 다 벗어났을 때만 해제한다.
function leaveTextIfOutside() {
  setTimeout(() => {
    const a = document.activeElement;
    if (activeText && a !== activeText && !$('ctxbar').contains(a)) { activeText = null; lastRange = null; renderCtx(); }
  }, 0);
}
host.addEventListener('focusout', leaveTextIfOutside);
$('ctxbar').addEventListener('focusout', leaveTextIfOutside);
// 편집 칸에서 마지막으로 고른 범위. 도구 버튼에 포커스가 가서 선택이 풀려도 같은 글자에 서식을 적용한다.
let lastRange = null;
document.addEventListener('selectionchange', () => {
  if (!activeText) return;
  const r = selectionOffsets(activeText, domItems(activeText));
  if (r) lastRange = { el: activeText, r };
});
function savedRange(el) { return lastRange && lastRange.el === el ? lastRange.r : null; }

// 👨‍👩‍👧 처럼 여러 글자로 된 이모지가 중간에서 갈라지지 않게 선택 범위를 글자 경계로 넓힌다
function snapToGraphemes(text, s, e) {
  if (typeof Intl === 'undefined' || !Intl.Segmenter) return [s, e];
  let a = 0, b = text.length;
  for (const { index, segment } of new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(text)) {
    if (index <= s) a = index;
    if (index < e && index + segment.length >= e) { b = index + segment.length; break; }
  }
  return [a, Math.max(a, b)];
}

// 선택한 글자(없으면 칸 전체)에 서식을 켜고 끈다. op: 'b' | 'u' | 'm' | { color }
function applyFormat(el, op) {
  if (!el || !isRich(el)) return;
  const items = domItems(el);
  let [s, e] = selectionOffsets(el, items) || savedRange(el) || [0, 0];
  if (s === e) { s = 0; e = items.total; }
  if (s > e) [s, e] = [e, s];
  // 위치는 선택(DOM)과 같은 단위(UTF-16)로 센다. 이모지 하나가 2칸이어도 어긋나지 않는다.
  const chars = [];
  for (const it of items) for (let i = 0; i < it.text.length; i++) chars.push({ ch: it.text[i], ...it.st });
  [s, e] = snapToGraphemes(chars.map(c => c.ch).join(''), s, e);
  const range = chars.slice(s, e).filter(c => c.ch !== '\n');
  if (!range.length) return;
  if (typeof op === 'string') {
    const on = !range.every(c => c[op]);
    for (let i = s; i < e; i++) chars[i][op] = on;
  } else {
    for (let i = s; i < e; i++) chars[i].c = op.color;
  }
  const runs = [];
  for (const c of chars) {
    const p = runs[runs.length - 1];
    if (p && p.b === c.b && p.u === c.u && p.m === c.m && p.c === c.c) p.text += c.ch;
    else runs.push({ text: c.ch, b: c.b, u: c.u, m: c.m, c: c.c });
  }
  const markup = runsToMarkup(runs);
  el.innerHTML = markupToHTML(markup);
  restoreSelection(el, s, e);
  commitText(el);
}

// 칸 전체 서식: 글자 크기 배율, 정렬, 줄 간격. 다시 그리지 않고 바로 적용해서 편집 중인 커서를 지킨다.
function boxField(el) { return el.dataset.cell ? 'table' : el.dataset.field; }
function setBoxStyle(el, key, value) {
  const slide = deck.slides[cur], field = boxField(el);
  slide.styles ||= {};
  const st = slide.styles[field] ||= {};
  if (value === null) delete st[key]; else st[key] = value;
  if (!Object.keys(st).length) delete slide.styles[field];
  if (!Object.keys(slide.styles).length) delete slide.styles;
  const targets = el.dataset.cell ? [...el.closest('.table').querySelectorAll('[data-cell]')] : [el];
  for (const t of targets) {
    t.style.setProperty('--k', st.scale || 1);
    t.style.textAlign = st.align || t.dataset.align0 || '';   // 지우면 형태의 기본 정렬로
    t.style.lineHeight = st.lh || '';
  }
  const boxEl = el.closest('[data-h]');
  if (boxEl) fitBox(boxEl);
  save(); refreshThumb();
  renderCtx();   // 크기 %와 정렬·줄 간격 선택 표시를 바로 갱신
}
function boxStyleOf(el) {
  const s = deck.slides[cur].styles;
  return (s && s[boxField(el)]) || {};
}

/* ===== 스티커 ===== */
function selectSticker(i, quiet) {
  sel = i;
  host.querySelectorAll(':scope > .slide:not(.tr-out) .sticker').forEach(el => el.classList.toggle('sel', +el.dataset.i === i));
  if (!quiet) renderCtx();
}
function stickerEl(i) { return curEl && curEl.querySelector(`.sticker[data-i="${i}"]`); }
// 가로세로 절반 이상은 슬라이드 안에 남겨서 잃어버리지 않게 한다. 세로는 실제 그려진 높이를 쓴다.
function placeSticker(st, data) {
  const hh = st.offsetHeight || data.w;
  data.x = clamp(Math.round(data.x), -Math.round(data.w / 2), W - Math.round(data.w / 2));
  data.y = clamp(Math.round(data.y), -Math.round(hh / 2), H - Math.round(hh / 2));
  st.style.left = data.x + 'px'; st.style.top = data.y + 'px'; st.style.width = data.w + 'px';
}

host.addEventListener('pointerdown', e => {
  if (mode !== 'edit' || !curEl || !curEl.contains(e.target)) return;
  if (e.target.closest('[data-slot]')) { e.preventDefault(); openStickerPanel(true); return; }
  const st = e.target.closest('.sticker');
  if (!st) { if (sel >= 0) selectSticker(-1); return; }
  e.preventDefault();
  releaseFocus();
  const i = +st.dataset.i, data = deck.slides[cur].stickers[i];
  selectSticker(i);
  const h = e.target.closest('.h');
  const op = !h ? 'move' : h.classList.contains('turn') ? 'turn' : 'size';
  const P = ev => { const r = host.getBoundingClientRect(); return { x: (ev.clientX - r.left) / scale, y: (ev.clientY - r.top) / scale }; };
  const p0 = P(e), ox = data.x, oy = data.y, ow = data.w;
  const ratio = (st.offsetHeight || ow) / ow;
  const cx = ox + ow / 2, cy = oy + ow * ratio / 2;
  const d0 = Math.hypot(p0.x - cx, p0.y - cy) || 1;
  st.classList.remove('pop', 'float'); st.style.animation = 'none';
  st.setPointerCapture(e.pointerId);
  const move = ev => {
    const p = P(ev);
    if (op === 'move') { data.x = ox + p.x - p0.x; data.y = oy + p.y - p0.y; }
    else if (op === 'size') {
      // 가운데를 기준으로 모서리까지의 거리만큼 크기를 바꾼다 (회전해 있어도 같은 방식)
      data.w = clamp(Math.round(ow * Math.hypot(p.x - cx, p.y - cy) / d0), 40, W);
      data.x = cx - data.w / 2; data.y = cy - data.w * ratio / 2;
    } else {
      let a = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI + 90;
      if (ev.shiftKey) a = Math.round(a / 15) * 15;
      data.rot = ((Math.round(a) % 360) + 540) % 360 - 180;
      st.querySelector('.rot').style.transform = `rotate(${data.rot}deg)`;
    }
    placeSticker(st, data);
  };
  // 손을 떼거나 터치가 취소되거나 캡처를 잃어도 같은 방식으로 마무리한다
  const end = () => {
    for (const [t, f] of [['pointermove', move], ['pointerup', end], ['pointercancel', end], ['lostpointercapture', end]]) st.removeEventListener(t, f);
    save(); refreshThumb(); renderCtx();
  };
  st.addEventListener('pointermove', move);
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) st.addEventListener(t, end);
});

// 스티커를 고르거나 추가하면 버튼·글자 칸에 남은 포커스를 풀어서 화살표·Delete가 스티커에 가게 한다
function releaseFocus() {
  const a = document.activeElement;
  if (a && a !== document.body) a.blur();
}
function addSticker(src, w) {
  releaseFocus();
  const slide = deck.slides[cur];
  if (slide.stickers.length >= MAX_STICKERS) { alert(`한 장에는 스티커를 ${MAX_STICKERS}개까지 넣을 수 있어요.`); return; }
  slide.stickers.push({ src, x: Math.round(W / 2 - w / 2), y: Math.round(H / 2 - w / 2), w, rot: 0, flip: false, float: true });
  sel = slide.stickers.length - 1;
  save(); redraw(true);
}
function stickerOp(kind) {
  const list = deck.slides[cur].stickers, s = list[sel];
  if (!s) return;
  if (kind === 'delete') { list.splice(sel, 1); sel = -1; }
  else if (kind === 'flip') s.flip = !s.flip;
  else if (kind === 'unrotate') s.rot = 0;
  else if (kind === 'float') s.float = s.float === false;
  else if (kind === 'forward' && sel < list.length - 1) { [list[sel], list[sel + 1]] = [list[sel + 1], list[sel]]; sel++; }
  else if (kind === 'backward' && sel > 0) { [list[sel], list[sel - 1]] = [list[sel - 1], list[sel]]; sel--; }
  else if (kind === 'dup') {
    if (list.length >= MAX_STICKERS) { alert(`한 장에는 스티커를 ${MAX_STICKERS}개까지 넣을 수 있어요.`); return; }
    list.push({ ...s, x: Math.min(s.x + 40, W - s.w / 2), y: Math.min(s.y + 40, H - s.w / 2) });
    sel = list.length - 1;
  }
  save(); redraw(true);
}
function nudgeSticker(dx, dy) {
  const s = deck.slides[cur].stickers[sel], st = stickerEl(sel);
  if (!s || !st) return;
  s.x += dx; s.y += dy;
  st.classList.remove('pop', 'float'); st.style.animation = 'none';
  placeSticker(st, s);
  save(); refreshThumb();
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
  const s = { type: t, stickers: [] };
  if (t === 'table') s.table = '항목 | 내용\n | ';
  deck.slides.splice(cur + 1, 0, s);
  save(); go(cur + 1);
}
function moveSlide(dir) {
  const j = cur + dir;
  if (j < 0 || j >= deck.slides.length) return;
  [deck.slides[cur], deck.slides[j]] = [deck.slides[j], deck.slides[cur]];
  cur = j; save(); renderThumbs(); syncToolbar();
}
// 표 줄·칸 더하기와 빼기. at이 없으면 끝에서.
function tableOp(kind, at) {
  const slide = deck.slides[cur];
  const rows = parseTable(slide.table ?? '');
  const cols = rows[0].length;
  const r = at ? at[0] : rows.length - 1, c = at ? at[1] : cols - 1;
  if (kind === 'addRow') rows.splice(r + 1, 0, Array(cols).fill(''));
  if (kind === 'delRow' && rows.length > 1) rows.splice(r, 1);
  if (kind === 'addCol') rows.forEach(row => row.splice(c + 1, 0, ''));
  if (kind === 'delCol' && cols > 1) rows.forEach(row => row.splice(c, 1));
  slide.table = tableToString(rows);
  save(); redraw();
}

/* ===== 상황별 도구 줄 ===== */
function ctxButton(label, title, fn, cls = '') {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = label; b.title = title; if (cls) b.className = cls;
  b.dataset.key = title;   // 도구 줄을 다시 그린 뒤 키보드 포커스를 같은 버튼으로 되돌리는 데 쓴다
  b.addEventListener('pointerdown', e => e.preventDefault());   // 글자 칸의 선택과 포커스를 지킨다
  b.addEventListener('click', fn);
  return b;
}
function ctxGroup(label, ...nodes) {
  const g = document.createElement('div');
  g.className = 'group';
  if (label) { const l = document.createElement('span'); l.className = 'ctx-label'; l.textContent = label; g.appendChild(l); }
  g.append(...nodes);
  return g;
}
function renderCtx() {
  const bar = $('ctxbar');
  const focusKey = bar.contains(document.activeElement) ? document.activeElement.dataset.key : null;
  bar.replaceChildren();
  if (mode === 'edit') buildCtx(bar);
  if (focusKey) {
    const b = [...bar.querySelectorAll('button')].find(x => x.dataset.key === focusKey);
    if (b) b.focus();
  }
}
function buildCtx(bar) {
  const slide = deck.slides[cur];

  if (activeText && document.contains(activeText)) {
    const el = activeText, st = boxStyleOf(el);
    if (isRich(el)) {
      const swatches = Object.entries(PALETTE).map(([k, v]) => {
        const b = ctxButton('', `글자 색: ${v.label}`, () => applyFormat(el, { color: k }), 'swatch');
        b.style.background = v.color;
        return b;
      });
      bar.append(
        ctxGroup('글자',
          ctxButton('B', '굵게 (⌘B)', () => applyFormat(el, 'b'), 'fmt-b'),
          ctxButton('U', '밑줄 (⌘U)', () => applyFormat(el, 'u'), 'fmt-u'),
          ctxButton('형광펜', '형광펜', () => applyFormat(el, 'm'), 'fmt-m')),
        ctxGroup('색', ctxButton('', '기본 색', () => applyFormat(el, { color: null }), 'swatch none'), ...swatches),
      );
    }
    // 크기는 누를 때마다 현재 값을 읽는다 (연속으로 눌러도 한 단계씩)
    const step = d => () => {
      const k = (boxStyleOf(el).scale || 1) + d;
      setBoxStyle(el, 'scale', Math.min(2, Math.max(0.5, Math.round(k * 100) / 100)));
    };
    // 정렬: 형태의 기본 정렬과 같으면 기본으로(null), 다르면 그 값을 저장한다. 가운데가 기본인 칸의 왼쪽도 저장된다.
    const align0 = el.dataset.align0 || 'left';
    const alignNow = st.align || align0;
    bar.append(
      ctxGroup('크기',
        ctxButton('A−', '글자 작게', step(-0.1)),
        ctxButton(`${Math.round((st.scale || 1) * 100)}%`, '기본 크기로', () => setBoxStyle(el, 'scale', null)),
        ctxButton('A+', '글자 크게', step(0.1))),
      ctxGroup('정렬', ...[['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']].map(([a, l]) =>
        ctxButton(l, `${l} 정렬`, () => setBoxStyle(el, 'align', a === align0 ? null : a), alignNow === a ? 'on' : ''))),
      ctxGroup('줄 간격', ...[[1.2, '좁게'], [null, '보통'], [1.9, '넓게']].map(([v, l]) =>
        ctxButton(l, `줄 간격 ${l}`, () => setBoxStyle(el, 'lh', v), (st.lh || null) === v ? 'on' : ''))),
    );
    if (el.dataset.cell) {
      const at = el.dataset.cell.split(',').map(Number);
      bar.append(ctxGroup('표',
        ctxButton('줄 +', '아래에 줄 더하기', () => tableOp('addRow', at)),
        ctxButton('줄 −', '이 줄 빼기', () => tableOp('delRow', at)),
        ctxButton('칸 +', '오른쪽에 칸 더하기', () => tableOp('addCol', at)),
        ctxButton('칸 −', '이 칸 빼기', () => tableOp('delCol', at))));
    }
    // 렌더 후에도 서식 버튼 상태가 바뀌므로 선택이 바뀔 때마다 다시 그릴 필요는 없다
    return;
  }

  if (sel >= 0 && slide.stickers[sel]) {
    const s = slide.stickers[sel];
    bar.append(
      ctxGroup('스티커',
        ctxButton('↺ 회전 0°', `지금 ${s.rot || 0}° · 위쪽 둥근 손잡이로 돌리기`, () => stickerOp('unrotate')),
        ctxButton('↔ 뒤집기', '좌우 뒤집기', () => stickerOp('flip'), s.flip ? 'on' : ''),
        ctxButton('앞으로', '한 칸 앞으로 (다른 스티커 위로)', () => stickerOp('forward')),
        ctxButton('뒤로', '한 칸 뒤로', () => stickerOp('backward')),
        ctxButton('복제', '같은 스티커 하나 더', () => stickerOp('dup')),
        ctxButton('둥실둥실', '이 스티커 움직임 켜기/끄기', () => stickerOp('float'), s.float !== false ? 'on' : ''),
        ctxButton('삭제', '스티커 삭제 (Delete)', () => stickerOp('delete'), 'danger')),
    );
    return;
  }

  // 아무것도 고르지 않았을 때: 이 장의 옵션
  const g = groupItem(slide.type);
  if (g) {
    const n = countOf(slide);
    const nums = [];
    for (let i = g.min; i <= g.max; i++) nums.push(ctxButton(`${i}개`, `${i}개로`, () => { slide.count = i; save(); redraw(); }, i === n ? 'on' : ''));
    bar.append(ctxGroup(slide.type === 'steps' ? '단계 수' : '카드 수', ...nums));
  }
  if (slide.type === 'table') {
    bar.append(ctxGroup('표', ctxButton('줄 +', '끝에 줄 더하기', () => tableOp('addRow')), ctxButton('줄 −', '마지막 줄 빼기', () => tableOp('delRow')),
      ctxButton('칸 +', '끝에 칸 더하기', () => tableOp('addCol')), ctxButton('칸 −', '마지막 칸 빼기', () => tableOp('delCol'))));
  }
  if (slide.type === 'image') {
    bar.append(ctxGroup('그림', ctxButton('그림 고르기', '그림 칸에 넣을 그림 고르기', () => openStickerPanel(true)),
      ctxButton('그림 빼기', '그림 칸 비우기', () => { delete slide.img; save(); redraw(); })));
  }
  const tip = document.createElement('span');
  tip.className = 'ctx-label';
  tip.textContent = '글자를 누르면 글자 도구, 스티커를 누르면 스티커 도구가 여기에 나와요';
  bar.append(tip);
}

/* ===== 떠 있는 패널 ===== */
function openStickerPanel(forSlot) {
  slotPick = !!forSlot;
  $('stickerPanelTitle').textContent = slotPick ? '그림 칸에 넣을 그림' : '스티커';
  $('settingsPanel').hidden = true;
  $('stickerPanel').hidden = false;
}
function syncSettings() {
  const s = deck.settings;
  $('selBg').value = deck.bg;
  $('inFont').value = deck.font;
  $('selTransition').value = s.transition;
  $('rngDuration').value = s.duration;
  $('lblDuration').textContent = `${s.duration.toFixed(1)}초`;
  $('selSlideTransition').value = deck.slides[cur].transition || '';
  $('selTextAnim').value = s.textAnim;
  $('chkImgAnim').checked = s.imgAnim;
  $('chkFloat').checked = s.float;
}
function syncToolbar() {
  $('selType').value = deck.slides[cur].type;
  syncSettings();
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
  const editing = e.target.isContentEditable;
  // 글자 서식 단축키
  if (editing && (e.metaKey || e.ctrlKey) && !e.altKey && isRich(e.target)) {
    const k = e.key.toLowerCase();
    if (k === 'b' || k === 'u') { e.preventDefault(); applyFormat(e.target, k); return; }
  }
  if (editing && e.key === 'Enter' && e.target.dataset.cell) { e.preventDefault(); return; }   // 표 칸 안에서는 줄바꿈 없음
  // 입력창·버튼·링크처럼 자기 키 동작이 있는 요소에서는 슬라이드 이동 단축키를 쓰지 않음
  const typing = editing || /^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(e.target.tagName);
  if (e.key === 'Escape') {
    if (typing) { e.target.blur(); return; }
    if (!$('stickerPanel').hidden || !$('settingsPanel').hidden) { $('stickerPanel').hidden = $('settingsPanel').hidden = true; return; }
    if (sel >= 0) { selectSticker(-1); return; }
    if (mode === 'present') endPresent();
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  // 스티커를 고른 상태: 화살표로 옮기고 Delete/Backspace로 지운다
  if (mode === 'edit' && sel >= 0) {
    const step = e.shiftKey ? 50 : 10;
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (mv) { e.preventDefault(); nudgeSticker(...mv); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); stickerOp('delete'); return; }
  }
  switch (e.key) {
    case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter':
      e.preventDefault(); go(cur + 1); break;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
      e.preventDefault(); go(cur - 1); break;
    case 'Home': go(0); break;
    case 'End': go(deck.slides.length - 1); break;
    case 'f': case 'F': case 'p': case 'P':
      mode === 'present' ? endPresent() : startPresent(); break;
  }
});

/* ===== 툴바 연결 ===== */
function fillSelect(el, entries) {
  for (const [v, l] of entries) el.add(new Option(l, v));
}
function buildToolbar() {
  const add = $('selAdd'), typeSel = $('selType');
  for (const [k, v] of Object.entries(TYPES)) {
    add.add(new Option(v.label, k));
    typeSel.add(new Option(v.label, k));
  }
  add.addEventListener('change', () => { if (add.value) addSlide(add.value); add.value = ''; });
  typeSel.addEventListener('change', () => {
    const s = deck.slides[cur];
    s.type = typeSel.value;
    if (s.type === 'table' && !s.table) s.table = '항목 | 내용\n | ';
    save(); redraw();
  });
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

  // 스티커 패널
  $('btnSticker').addEventListener('click', () => {
    if ($('stickerPanel').hidden || slotPick) openStickerPanel(false);
    else $('stickerPanel').hidden = true;
  });
  $('btnStickerClose').addEventListener('click', () => { $('stickerPanel').hidden = true; });
  const grid = $('stickerGrid');
  STICKERS.forEach(st => {
    const b = document.createElement('button');
    b.type = 'button';
    const img = new Image();
    img.src = st.src; img.alt = '';
    img.onerror = () => b.remove();   // 아직 생성되지 않은 스티커는 숨김
    const label = document.createElement('span');
    label.textContent = st.name;
    b.setAttribute('aria-label', st.name);
    b.title = st.name;
    b.append(img, label);
    b.addEventListener('click', () => {
      if (slotPick) {
        deck.slides[cur].img = st.src;
        $('stickerPanel').hidden = true;
        save(); redraw();
      } else addSticker(st.src, st.w);
    });
    grid.appendChild(b);
  });

  // 설정 패널
  fillSelect($('selBg'), Object.entries(BG_LABELS));
  fillSelect($('selTransition'), Object.entries(TRANSITIONS));
  fillSelect($('selSlideTransition'), [['', '덱 설정 따름'], ...Object.entries(TRANSITIONS)]);
  fillSelect($('selTextAnim'), Object.entries(TEXT_ANIMS));
  $('btnSettings').addEventListener('click', () => {
    const p = $('settingsPanel');
    p.hidden = !p.hidden;
    if (!p.hidden) { $('stickerPanel').hidden = true; syncSettings(); }
  });
  $('btnSettingsClose').addEventListener('click', () => { $('settingsPanel').hidden = true; });
  const setAndShow = (fn, still) => { fn(); save(); syncSettings(); still ? redraw() : renderStage(); };
  $('selBg').addEventListener('change', e => setAndShow(() => { deck.bg = e.target.value; }, true));
  $('inFont').addEventListener('change', e => setAndShow(() => { deck.font = e.target.value.trim(); }, true));
  $('selTransition').addEventListener('change', e => { deck.settings.transition = e.target.value; save(); });
  $('rngDuration').addEventListener('input', e => { deck.settings.duration = Math.round(+e.target.value * 10) / 10; save(); syncSettings(); });
  $('selSlideTransition').addEventListener('change', e => {
    const s = deck.slides[cur];
    if (e.target.value) s.transition = e.target.value; else delete s.transition;
    save();
  });
  // 등장 효과를 바꾸면 현재 장을 다시 재생해서 바로 확인할 수 있게 한다
  $('selTextAnim').addEventListener('change', e => setAndShow(() => { deck.settings.textAnim = e.target.value; }));
  $('chkImgAnim').addEventListener('change', e => setAndShow(() => { deck.settings.imgAnim = e.target.checked; }));
  $('chkFloat').addEventListener('change', e => setAndShow(() => { deck.settings.float = e.target.checked; }));

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
      deck = next;
      next.slides.forEach(s => slideHTML(s, { editable: false, animate: false }));
      cur = 0; save(); go(0, true);
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
if (document.fonts) document.fonts.addEventListener('loadingdone', () => { if (curEl) fitText(curEl); fitText($('thumbs')); });
deck = loadDeck();
buildToolbar();
setStatus(loadWarning);
// 깨진 저장값을 브라우저에 따로 보관하지 못했다면, 덮어쓰기 전에 파일로 받을 기회를 준다
if (brokenRaw && confirm('저장된 덱을 읽지 못했고 복구용 보관에도 실패했어요.\n편집을 시작하면 덮어써지니, 원본을 파일로 내려받을까요?')) {
  download('any-slide-broken-backup.json', brokenRaw);
}
// 해시로 시작 위치 지정: #s=3 (슬라이드 번호), #s=3&view (전체 화면 없이 발표 화면으로 열기)
const hash = new URLSearchParams(location.hash.slice(1));
go(Math.max(0, (parseInt(hash.get('s'), 10) || 1) - 1));
if (hash.has('view')) setMode('present');
