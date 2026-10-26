'use strict';

/* ===== 상수 ===== */
// 발표 폴더(pack-deck.mjs로 만든 폴더)에서는 deck-data.js가 window.ANY_SLIDE_PACK = { key, deck }을 준다.
// 이때는 그 폴더 전용 저장 공간(key)을 쓰고, 처음 열면 함께 들어 있는 덱을 연다. 로컬 파일들은 저장 공간을 함께 쓰므로 폴더마다 이름을 다르게 한다.
const PACK = typeof window !== 'undefined' && window.ANY_SLIDE_PACK && typeof window.ANY_SLIDE_PACK === 'object' ? window.ANY_SLIDE_PACK : null;
const STORE_KEY = PACK && typeof PACK.key === 'string' ? PACK.key : 'any-slide-deck-v1';
const SAVED_AT_KEY = STORE_KEY + ':savedAt';   // 브라우저에 마지막으로 저장한 시각 (폴더의 덱과 어느 쪽이 최신인지 비교)
let packBroken = false;   // 발표 폴더의 덱을 읽지 못함: 예제 덱으로 폴더 저장 공간을 덮어쓰지 않는다
// 처음 상태: 발표 폴더면 그 덱, 아니면 기본 덱 (초기화도 이 상태로 돌아간다)
function initialDeck() {
  if (PACK) {
    try { return sanitize(PACK.deck); }
    catch (e) {
      packBroken = true;
      loadWarning = '⚠ 이 폴더의 덱을 읽지 못해 예제 덱을 열었어요. 폴더 안의 덱 JSON 파일을 [불러오기]로 여세요.';
    }
  }
  return defaultDeck();
}
// 발표 폴더 이름 (<날짜>_<제목>_v<버전>). name이 없는 예전 폴더는 <제목>_v<버전>
function packName() { return PACK ? (typeof PACK.name === 'string' && PACK.name ? PACK.name : `${PACK.title}_v${PACK.version}`) : ''; }
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

const HINT = '글자를 누르면 편집 · 테두리나 그림을 끌어 이동, 모서리 점으로 크기, 위쪽 손잡이로 회전 · 끄는 동안 ⌥(Alt)를 누르면 맞춤 끄기 · 화살표로 이동, Delete로 삭제';
let loadWarning = '', brokenRaw = null;

function loadDeck() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
    // 발표 폴더: 폴더의 덱이 브라우저에 저장된 것보다 나중에 고친 것이면(다른 컴퓨터에서 [폴더에 저장] 후 복사) 폴더 덱을 연다.
    // 브라우저 쪽 시각을 모르면(예전 저장) 고친 내용을 잃지 않도록 브라우저 쪽을 연다.
    if (raw && PACK && PACK.savedAt) {
      const local = localStorage.getItem(SAVED_AT_KEY);
      if (local && PACK.savedAt > local) {
        const d = initialDeck();
        if (!packBroken) {
          // 이 컴퓨터에서 고쳤던 덱은 백업하고, 브라우저 저장을 폴더 덱으로 맞춘다 (다음에 열 때 다시 묻지 않게)
          try {
            localStorage.setItem(STORE_KEY + '-backup-' + local.replace(/[^0-9]/g, '').slice(0, 14), raw);
            localStorage.setItem(STORE_KEY, JSON.stringify(d));
            localStorage.setItem(SAVED_AT_KEY, PACK.savedAt);
          } catch (e2) { /* 보관 실패는 무시 */ }
          loadWarning = 'ℹ 다른 컴퓨터에서 [폴더에 저장]한 최신 덱을 열었어요. 이 컴퓨터에서 고쳤던 내용은 브라우저에 백업해 두었어요.';
          return d;
        }
        packBroken = false; loadWarning = '';   // 폴더 덱이 깨졌으면 브라우저에 저장된 덱을 그대로 연다
      }
    }
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
  return initialDeck();
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
  if (!dirty || packBroken) return;   // 폴더 덱을 못 읽어 연 예제 덱은 폴더 저장 공간에 저장하지 않는다
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(deck));
    localStorage.setItem(SAVED_AT_KEY, new Date().toISOString());
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
  el.classList.toggle('warn', !!msg && msg.startsWith('⚠'));
  el.classList.toggle('info', !!msg && !msg.startsWith('⚠'));
  el.textContent = msg || (PACK ? PACK_HINT : HINT);
}
const PACK_HINT = '이 폴더의 덱이에요. 고친 내용은 이 컴퓨터 브라우저에 저장돼요 · 다른 컴퓨터로 폴더를 옮기기 전에 [폴더에 저장]을 누르세요';

/* ===== 폴더에 저장 (발표 폴더 전용) =====
   고친 덱을 발표 폴더 안의 deck-data.js와 덱 JSON에 직접 쓴다. 폴더를 다른 컴퓨터로 복사해도 고친 내용이 그대로 열린다.
   크롬·엣지의 파일 접근 기능을 쓰고, 처음 한 번 폴더를 고르면 이 창을 닫을 때까지 다시 묻지 않는다. */
let folderHandle = null;
async function saveToFolder() {
  if (!PACK) return;
  if (!window.showDirectoryPicker) {
    alert('이 브라우저는 폴더에 직접 저장할 수 없어요 (크롬·엣지에서 돼요).\n[저장]으로 덱 파일을 내려받아 옮긴 뒤, 발표할 컴퓨터에서 [불러오기]로 여세요.');
    return;
  }
  try {
    if (!folderHandle) {
      const dir = await window.showDirectoryPicker({ id: 'any-slide-pack', mode: 'readwrite' });
      // 고른 폴더가 이 발표 폴더인지 확인 (deck-data.js가 있어야 한다)
      try { await dir.getFileHandle('deck-data.js'); }
      catch (e) { alert('발표 폴더가 아니에요. Any-Slide.html과 deck-data.js가 들어 있는 폴더를 고르세요.'); return; }
      folderHandle = dir;
    }
    flushSave();
    const savedAt = new Date().toISOString();
    const pack = { key: PACK.key, name: PACK.name, title: PACK.title, version: PACK.version, savedAt, deck };
    const write = async (name, text) => {
      const w = await (await folderHandle.getFileHandle(name, { create: true })).createWritable();
      await w.write(text); await w.close();
    };
    await write('deck-data.js', `// ${packName()} 덱. Any-Slide.html이 이 덱을 바로 연다.\nwindow.ANY_SLIDE_PACK = ${JSON.stringify(pack)};\n`);
    await write(`${packName()}.json`, JSON.stringify(deck, null, 2));
    // 방금 쓴 폴더 덱과 브라우저 저장의 시각을 맞춘다 (다음에 열 때 같은 내용으로 본다)
    try { localStorage.setItem(SAVED_AT_KEY, savedAt); } catch (e) { /* 무시 */ }
    PACK.savedAt = savedAt;
    setStatus('ℹ 폴더에 저장했어요. 이제 이 폴더를 다른 컴퓨터로 복사해도 고친 내용이 그대로 열려요.');
  } catch (e) {
    if (e && e.name === 'AbortError') return;   // 폴더 고르기를 취소함
    folderHandle = null;
    alert('폴더에 저장하지 못했어요: ' + (e && e.message ? e.message : e) + '\n[저장]으로 덱 파일을 내려받아 두세요.');
  }
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

// 개체마다 바깥 틀(.obj: 위치·크기·회전)을 두고 안에 내용을 그린다. 편집할 때는 테두리·손잡이도 함께 그린다.
const BOX_HANDLES = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
const UNI_HANDLES = ['nw', 'ne', 'sw', 'se'];   // 그림은 비율을 지켜 크기를 바꾼다
const TEXTY = new Set(['text', 'stack', 'bubble', 'card', 'codebox', 'table']);   // 안의 글자를 눌러 편집하는 개체: 테두리를 끌어 옮긴다
function frameHTML(o) {
  const hs = (o.k === 'img' ? UNI_HANDLES : BOX_HANDLES).map(h => `<i class="h ${h}"></i>`).join('');
  const edges = TEXTY.has(o.k) ? '<i class="eg n"></i><i class="eg s"></i><i class="eg e"></i><i class="eg w"></i>' : '';
  return `<i class="fr"></i>${edges}${hs}<i class="h turn" title="돌리기 (Shift: 15도씩)"></i>`;
}
function objBoxStyle(o) {
  return `left:${o.x}px;top:${o.y}px;width:${o.w}px;` + (o.k === 'img' ? '' : `height:${o.h}px;`) + (o.rot ? `transform:rotate(${o.rot}deg);` : '');
}

function slideRenderer(slide, { editable, animate }) {
  const fx = fxClasses(animate);
  const styles = slide.styles || {};
  const aligns = slideAligns(slide);   // 나란한 상자·표 열의 자동 정렬 (묶음마다 하나로)
  let n = 0;
  const nextD = () => 0.1 + (n++) * 0.15;
  const ceAttr = plain => (editable ? (plain ? ' contenteditable="plaintext-only"' : ' contenteditable="true"') + ' spellcheck="false"' : '');
  const boxStyle = (field, align) => {
    const st = styles[field] || {};
    return (st.scale ? `--k:${st.scale};` : '') + ((st.align || align) ? `text-align:${st.align || align};` : '') + (st.lh ? `line-height:${st.lh};` : '');
  };
  // 글자 칸 하나. pos가 있으면 개체 안의 절대 위치, 없으면 개체 안에서 흐른다.
  // align: 형태의 기본 정렬 / auto: 내용 길이로 정렬(짧으면 가운데, 길면 왼쪽). 사용자가 정한 정렬(styles)이 우선.
  const text = (t, pos = '', fit = null) => {
    const plain = !!t.plain || PLAIN_FIELDS.has(t.field);
    const v = slide[t.field] ?? '';
    const align0 = t.align || (t.auto ? (aligns.fields[t.field] || autoAlign(v)) : '');
    const attrs = (fit ? ` data-h="${fit.h}"` + (fit.grow ? ` data-grow="${fit.grow}"` : '') : '') + (plain ? ' data-plain="1"' : '')
      + (align0 ? ` data-align0="${align0}"` : '') + (t.auto ? ' data-auto="1"' : '');
    return `<div class="t ${t.cls}${pos ? ' abs' : ''} ${fx.text}" data-field="${t.field}" data-ph="${esc(t.ph || '')}"${attrs}${ceAttr(plain)}`
      + ` style="${pos}--d:${nextD()}s;${boxStyle(t.field, align0)}">${plain ? plainToHTML(v) : markupToHTML(v)}</div>`;
  };
  const rel = r => `left:${r.x}px;top:${r.y}px;width:${r.w}px;`;

  function inner(o) {
    switch (o.k) {
      case 'text': return text(o, '', o);
      case 'stack':
        return `<div class="stack${o.center ? ' center' : ''}" data-h="${o.h}"${o.grow ? ` data-grow="${o.grow}"` : ''}${o.center ? ' data-center="1"' : ''}`
          + ` style="gap:${o.gap}px">${o.items.map(t => text(t)).join('')}</div>`;
      case 'img': return `<img class="objimg ${fx.img(o.anim)}" src="${o.src}" alt="" style="--d:${0.35 + n * 0.1}s">`;
      case 'deco': return `<div class="${o.cls}">${esc(o.text)}</div>`;
      case 'bubble': {
        // 말풍선 도형: 개체 크기에 맞춰 늘어나고 선 굵기는 그대로
        const r = bubbleInner(o);
        return `<svg class="bubble-shape ${fx.pop ? 'bubble-pop' : ''}" style="--d:0.25s" viewBox="0 0 1140 375" preserveAspectRatio="none">`
          + '<path d="M40 0H950Q990 0 990 40V220L1140 318L990 313V335Q990 375 950 375H40Q0 375 0 335V40Q0 0 40 0Z" fill="#fefcf7" stroke="#a39b92" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>'
          + text({ field: o.field, cls: 'bubble', ph: o.ph }, rel(r), { h: r.h, grow: o.grow });
      }
      case 'codebox': {
        const r = codeInner(o);
        return `<div class="panel dark ${fx.text ? 'fx-fade' : ''}" style="--d:0s"></div>` + text({ field: o.field, cls: 'code', plain: true, ph: o.ph }, rel(r), { h: r.h });
      }
      case 'card': {
        const r = cardInner(o), no = o.no || 0;
        let h = `<div class="panel ${fx.text ? 'fx-fade' : ''}" style="--d:${0.05 + no * 0.12}s"></div>`;
        if (r.badge) h += `<div class="badge ${fx.pop ? 'pop' : ''}" style="left:${r.badge.x}px;top:${r.badge.y}px;--d:${0.2 + no * 0.15}s">${o.no}</div>`;
        h += text({ field: o.head, cls: 'head' + (o.accent ? ` acc-${o.accent}` : ''), ph: o.headPh, align: 'center' }, rel(r.head), { h: r.head.h });
        h += text({ field: o.body, cls: 'card', ph: o.bodyPh, auto: true }, rel(r.body), { h: r.body.h, grow: 1.4 });
        return h;
      }
      case 'table': {
        // 머리 줄은 가운데, 나머지 칸은 내용 길이로 자동 정렬
        const rows = parseTable(slide.table ?? '');
        const cols = rows[0].length;
        const cells = rows.flatMap((r, ri) => r.map((v, ci) => {
          const cls = ['t', 'cell', ri === 0 ? 'th' : '', ci === cols - 1 ? 'last-col' : '', ri === rows.length - 1 ? 'last-row' : ''].join(' ');
          const a0 = ri === 0 ? 'center' : (aligns.cols[ci] || autoAlign(v));
          return `<div class="${cls}" data-cell="${ri},${ci}" data-ph="" data-align0="${a0}"${ri ? ' data-auto="1"' : ''}${ceAttr(false)} style="${boxStyle('table', a0)}">${markupToHTML(v)}</div>`;
        })).join('');
        return `<div class="table ${fx.text ? 'fx-fade' : ''}" data-field="table" data-h="${o.h}"${o.grow ? ` data-grow="${o.grow}"` : ''}`
          + ` style="grid-template-columns:repeat(${cols},minmax(0,1fr));--d:${nextD()}s">${cells}</div>`;
      }
      case 'slot': {
        const img = slide.img ? `<img class="${fx.pop ? 'pop' : ''}" src="${esc(slide.img)}" alt="" style="--d:0.3s">` : (editable ? '그림 고르기 (두 번 누르기)' : '');
        return `<div class="slot${slide.img ? '' : ' empty'}" data-slot="1">${img}</div>`;
      }
    }
    return '';
  }
  const objHTML = o => `<div class="obj k-${o.k}" data-oid="${o.id}" style="${objBoxStyle(o)}">${inner(o)}${editable ? frameHTML(o) : ''}</div>`;
  return { objHTML };
}

function slideHTML(slide, opts) {
  const fx = fxClasses(opts.animate);
  const R = slideRenderer(slide, opts);
  const parts = placedObjects(slide).map(R.objHTML);
  // 스티커: 바깥은 위치와 등장 효과, 안쪽은 회전, 그림은 뒤집기
  const stickers = (slide.stickers || []).map((s, i) => {
    const anim = [fx.pop ? 'pop' : '', fx.float && s.float !== false ? 'float' : ''].join(' ').trim();
    return `<div class="sticker ${anim}" data-i="${i}" style="left:${s.x}px;top:${s.y}px;width:${s.w}px;--d:${0.6 + i * 0.12}s">`
      + `<div class="rot" style="transform:rotate(${s.rot || 0}deg)"><img class="${s.flip ? 'flip' : ''}" src="${esc(s.src)}" alt="">`
      + `<i class="h nw"></i><i class="h ne"></i><i class="h sw"></i><i class="h se"></i><i class="h turn" title="돌리기 (Shift: 15도씩)"></i></div></div>`;
  });
  return parts.join('') + stickers.join('');
}
// 개체 하나만 새로 그린다 (크기를 바꾸는 동안 안의 배치를 다시 맞출 때)
function makeObjNode(o) {
  const tmp = document.createElement('div');
  tmp.innerHTML = slideRenderer(deck.slides[cur], { editable: mode === 'edit', animate: false }).objHTML(o);
  return tmp.firstElementChild;
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
  finishDrag();
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
  if (!opts.keepSel) { sel = -1; selO = null; }
  activeText = null;
  markSelection();
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
  // 표·상자 내용은 길이에 따라 정렬을 다시 정한다. 한 상자가 길어지면 같은 묶음의 상자도 함께 바뀐다 (직접 정한 정렬은 그대로)
  if (el.dataset.auto) refreshAutoAligns();
  const boxEl = el.closest('[data-h]');
  if (boxEl) fitBox(boxEl);   // 입력 중인 칸만 다시 맞춘다 (커서는 그대로)
  save(); refreshThumb();
}
function refreshAutoAligns() {
  const slide = deck.slides[cur], al = slideAligns(slide), styles = slide.styles || {};
  curEl.querySelectorAll('[data-auto]').forEach(el => {
    const a0 = el.dataset.cell ? al.cols[+el.dataset.cell.split(',')[1]] : (al.fields[el.dataset.field] || autoAlign(slide[el.dataset.field]));
    el.dataset.align0 = a0;
    const st = styles[boxField(el)];
    if (!st || !st.align) el.style.textAlign = a0;
  });
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
  // 글자를 편집하면 그 글자가 든 개체를 선택한 것으로 보고 테두리와 손잡이를 보여 준다
  const ob = t.closest('.obj');
  sel = -1; selO = ob ? ob.dataset.oid : null;
  markSelection();
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

/* ===== 개체 선택 (형태의 개체와 스티커) ===== */
let selO = null;   // 선택된 형태 개체 id (스티커 선택 sel과 함께 쓰지 않는다)
function stickerEl(i) { return curEl && curEl.querySelector(`.sticker[data-i="${i}"]`); }
function objEl(id) { return curEl && [...curEl.querySelectorAll(':scope > .obj')].find(el => el.dataset.oid === id); }
function markSelection() {
  if (!curEl) return;
  curEl.querySelectorAll(':scope > .sticker').forEach(el => el.classList.toggle('sel', +el.dataset.i === sel));
  curEl.querySelectorAll(':scope > .obj').forEach(el => el.classList.toggle('sel', el.dataset.oid === selO));
}
function selectSticker(i, quiet) {
  sel = i;
  if (i >= 0) selO = null;
  markSelection();
  if (!quiet) renderCtx();
}
function selectObj(id, quiet) {
  selO = id;
  if (id) sel = -1;
  markSelection();
  if (!quiet) renderCtx();
}
function selectNone() { sel = -1; selO = null; markSelection(); renderCtx(); }
// 가로세로 절반 이상은 슬라이드 안에 남겨서 잃어버리지 않게 한다. 세로는 실제 그려진 높이를 쓴다.
function placeSticker(st, data) {
  const hh = st.offsetHeight || data.w;
  data.x = clamp(Math.round(data.x), -Math.round(data.w / 2), W - Math.round(data.w / 2));
  data.y = clamp(Math.round(data.y), -Math.round(hh / 2), H - Math.round(hh / 2));
  st.style.left = data.x + 'px'; st.style.top = data.y + 'px'; st.style.width = data.w + 'px';
}
// 개체의 현재 위치·크기 (형태 기본값 위에 이 장의 layout을 덮어쓴 값)
function objGeom(id) { return placedObjects(deck.slides[cur], true).find(o => o.id === id); }
function setLayout(id, patch, s = deck.slides[cur]) {
  s.layout ||= {};
  const v = { ...(s.layout[id] || {}), ...patch };
  for (const k of Object.keys(v)) if (v[k] === null) delete v[k];
  if (Object.keys(v).length) s.layout[id] = v; else delete s.layout[id];
  if (!Object.keys(s.layout).length) delete s.layout;
}

/* ===== 끌기: 이동·크기·회전과 보조선 맞춤 =====
   다른 개체의 왼쪽·가운데·오른쪽(위·가운데·아래)과 슬라이드의 가운데선·기본 여백선에 10px 안으로 다가가면 달라붙는다.
   ⌥(Alt)를 누른 채 끌면 맞춤 없이 움직인다. 회전한 개체는 회전한 바깥 테두리로 맞춘다. */
const SNAP = 10;
const GUIDE_X = [0, 160, W / 2, W - 160, W], GUIDE_Y = [0, 114, 300, H / 2, 960, H];
function bboxOf(g) {
  const a = (g.rot || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const ex = g.w / 2 * c + g.h / 2 * s, ey = g.w / 2 * s + g.h / 2 * c;
  const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
  return { l: cx - ex, r: cx + ex, t: cy - ey, b: cy + ey, cx, cy };
}
function snapTargets(exclude) {
  const xs = [...GUIDE_X], ys = [...GUIDE_Y];
  const r0 = host.getBoundingClientRect();
  curEl.querySelectorAll(':scope > .obj, :scope > .sticker').forEach(el => {
    if (el === exclude) return;
    const r = el.getBoundingClientRect();
    const l = (r.left - r0.left) / scale, t = (r.top - r0.top) / scale, rr = (r.right - r0.left) / scale, b = (r.bottom - r0.top) / scale;
    xs.push(l, (l + rr) / 2, rr); ys.push(t, (t + b) / 2, b);
  });
  return { xs, ys };
}
// 값들 중 기준선에 가장 가까운 것 (SNAP 안일 때만)
function nearest(vals, lines) {
  let best = null;
  for (const v of vals) for (const line of lines) {
    const d = line - v;
    if (Math.abs(d) <= SNAP && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, line };
  }
  return best;
}
function drawGuides(list) {
  if (!curEl) return;
  curEl.querySelectorAll(':scope > .guide').forEach(g => g.remove());
  for (const [dir, at] of list) {
    const g = document.createElement('div');
    g.className = 'guide ' + dir;
    g.style[dir === 'v' ? 'left' : 'top'] = at + 'px';
    curEl.appendChild(g);
  }
}
function showSnapHint(on) {
  if (!curEl) return;
  curEl.querySelectorAll(':scope > .snap-hint').forEach(x => x.remove());
  if (on) curEl.insertAdjacentHTML('beforeend', '<div class="snap-hint">⌥(Alt)를 누르면 맞춤 끄기</div>');
}

host.addEventListener('pointerdown', e => {
  if (mode !== 'edit' || !curEl || !curEl.contains(e.target) || e.button > 0) return;
  const st = e.target.closest('.sticker'), ob = e.target.closest('.obj');
  if (!st && !ob) { if (sel >= 0 || selO) selectNone(); return; }
  const hd = e.target.closest('.h'), edge = e.target.closest('.eg');
  // 개체 안의 글자를 누르면 글자 편집 (선택 표시는 focusin에서)
  if (ob && !hd && !edge && e.target.closest('.t[contenteditable]')) return;
  e.preventDefault();
  releaseFocus();
  let t;
  if (st) {
    const i = +st.dataset.i, s = deck.slides[cur].stickers[i];
    selectSticker(i);
    t = { el: st, kind: 'sticker', data: s, uniform: true, g: { x: s.x, y: s.y, w: s.w, h: st.offsetHeight || s.w, rot: s.rot || 0 } };
  } else {
    const id = ob.dataset.oid, o = objGeom(id);
    selectObj(id);
    t = { el: ob, kind: 'obj', id, o, uniform: o.k === 'img', g: { x: o.x, y: o.y, w: o.w, h: o.k === 'img' ? ob.offsetHeight : o.h, rot: o.rot || 0 } };
  }
  t.slide = deck.slides[cur];   // 끄는 동안 장이 바뀌어도 이 장에 저장한다
  startDrag(e, t, hd);
});

// 진행 중인 끌기는 하나뿐이다. 장을 넘기거나 다시 그리기 전에 먼저 마무리한다(renderStage에서 부른다).
let activeDrag = null;
function finishDrag() { if (activeDrag) activeDrag(); }

function startDrag(e, t, hd) {
  finishDrag();
  const pid = e.pointerId;   // 처음 누른 포인터만 따른다 (다른 손가락·펜 입력은 무시)
  const P = ev => { const r = host.getBoundingClientRect(); return { x: (ev.clientX - r.left) / scale, y: (ev.clientY - r.top) / scale }; };
  const p0 = P(e), g0 = { ...t.g }, ratio = g0.h / g0.w;
  const min = t.kind === 'sticker' ? { w: 40, h: 40 } : objMinSize(t.o);
  const maxW = t.kind === 'sticker' ? W : OBJ_MAX.w;
  const cx0 = g0.x + g0.w / 2, cy0 = g0.y + g0.h / 2;
  const d0 = Math.hypot(p0.x - cx0, p0.y - cy0) || 1;
  const op = !hd ? 'move' : hd.classList.contains('turn') ? 'turn' : 'size';
  const dir = hd ? ([...hd.classList].find(c => /^(nw|ne|sw|se|n|s|e|w)$/.test(c)) || '') : '';
  const sx = dir.includes('e') ? 1 : dir.includes('w') ? -1 : 0, sy = dir.includes('s') ? 1 : dir.includes('n') ? -1 : 0;
  const lines = snapTargets(t.el);
  t.el.classList.add('still');   // 끄는 동안 등장·둥실둥실 애니메이션을 멈춘다
  // 맞춤이 되는 조작(이동, 회전하지 않은 상자의 크기 조절)에서만 ⌥ 안내를 띄운다
  if (op === 'move' || (op === 'size' && !t.uniform && !g0.rot)) showSnapHint(true);

  const move = ev => {
    if (ev.pointerId !== pid) return;
    const p = P(ev), dx = p.x - p0.x, dy = p.y - p0.y, g = t.g, snapOn = !ev.altKey;
    let guides = [];
    if (op === 'move') {
      g.x = g0.x + dx; g.y = g0.y + dy;
      if (snapOn) {
        const b = bboxOf(g);
        const mx = nearest([b.l, b.cx, b.r], lines.xs), my = nearest([b.t, b.cy, b.b], lines.ys);
        if (mx) { g.x += mx.d; guides.push(['v', mx.line]); }
        if (my) { g.y += my.d; guides.push(['h', my.line]); }
      }
    } else if (op === 'turn') {
      let a = Math.atan2(p.y - cy0, p.x - cx0) * 180 / Math.PI + 90;
      if (ev.shiftKey) a = Math.round(a / 15) * 15;
      g.rot = ((Math.round(a) % 360) + 540) % 360 - 180;
    } else if (t.uniform) {
      // 그림·스티커: 가운데를 기준으로 비율을 지켜 크기를 바꾼다
      g.w = clamp(Math.round(g0.w * Math.hypot(p.x - cx0, p.y - cy0) / d0), min.w, maxW);
      g.h = g.w * ratio; g.x = cx0 - g.w / 2; g.y = cy0 - g.h / 2;
    } else {
      // 상자: 잡은 변·모서리만 움직이고 반대편은 그대로 둔다 (회전한 상태면 회전한 축 기준)
      const a = g0.rot * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
      const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos;
      // 크기는 개체 종류의 최소 크기(안의 칸이 들어가는 크기)와 최대 크기 사이로
      const w = sx ? clamp(g0.w + sx * lx, min.w, OBJ_MAX.w) : g0.w, h = sy ? clamp(g0.h + sy * ly, min.h, OBJ_MAX.h) : g0.h;
      const ox = sx * (w - g0.w) / 2, oy = sy * (h - g0.h) / 2;
      const cx = cx0 + ox * cos - oy * sin, cy = cy0 + ox * sin + oy * cos;
      g.w = w; g.h = h; g.x = cx - w / 2; g.y = cy - h / 2;
      if (snapOn && !g0.rot) {
        const before = { ...g };
        if (sx) {
          const m = nearest([sx > 0 ? g.x + g.w : g.x], lines.xs);
          if (m) { if (sx > 0) g.w += m.d; else { g.x += m.d; g.w -= m.d; } guides.push(['v', m.line]); }
        }
        if (sy) {
          const m = nearest([sy > 0 ? g.y + g.h : g.y], lines.ys);
          if (m) { if (sy > 0) g.h += m.d; else { g.y += m.d; g.h -= m.d; } guides.push(['h', m.line]); }
        }
        // 맞춤 때문에 최소 크기보다 작아지면 맞춤을 하지 않는다
        if (g.w < min.w || g.h < min.h) { Object.assign(g, before); guides = []; }
      }
    }
    // 가운데가 슬라이드 밖으로 나가지 않게 해서 잃어버리지 않게 한다. 이 제한으로 위치가 바뀌면 그 방향의 보조선은 지운다.
    const c = clampPos(g.x, g.y, g.w, g.h);
    if (c.x !== g.x) guides = guides.filter(([d]) => d !== 'v');
    if (c.y !== g.y) guides = guides.filter(([d]) => d !== 'h');
    g.x = c.x; g.y = c.y;
    applyGeom(t, op);
    drawGuides(guides);
  };
  // 손을 떼거나, 취소되거나, 창이 포커스를 잃거나, 장이 바뀌면 같은 방식으로 한 번만 마무리한다
  const end = ev => {
    if (ev && ev.pointerId !== undefined && ev.pointerId !== pid) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    window.removeEventListener('blur', end);
    activeDrag = null;
    drawGuides([]); showSnapHint(false);
    t.el.classList.remove('still');
    commitGeom(t, op);
    save(); refreshThumb(); renderCtx();
  };
  activeDrag = end;
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  window.addEventListener('blur', end);
}
// 끄는 동안 화면에 바로 적용한다. 상자 크기를 바꾸면 개체를 다시 그려 안의 배치와 글자 크기를 다시 맞춘다.
function applyGeom(t, op) {
  const g = t.g;
  if (t.kind === 'sticker') {
    t.el.style.left = g.x + 'px'; t.el.style.top = g.y + 'px'; t.el.style.width = g.w + 'px';
    t.el.querySelector('.rot').style.transform = `rotate(${g.rot}deg)`;
    return;
  }
  if (op === 'size' && !t.uniform) {
    const node = makeObjNode({ ...t.o, ...g });
    node.classList.add('sel', 'still');
    t.el.replaceWith(node);
    t.el = node;
    fitText(node);
    return;
  }
  t.el.style.left = g.x + 'px'; t.el.style.top = g.y + 'px'; t.el.style.width = g.w + 'px';
  t.el.style.transform = g.rot ? `rotate(${g.rot}deg)` : '';
}
function commitGeom(t, op) {
  const g = t.g, r = Math.round;
  if (t.kind === 'sticker') {
    Object.assign(t.data, { x: r(g.x), y: r(g.y), w: r(g.w), rot: g.rot });
    placeSticker(t.el, t.data);
    return;
  }
  const patch = { x: r(g.x), y: r(g.y), rot: g.rot || null };
  if (op === 'size') { patch.w = r(g.w); if (!t.uniform) patch.h = r(g.h); }
  setLayout(t.id, patch, t.slide);
}

/* ===== 스티커 ===== */
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

/* ===== 형태 개체 조작 ===== */
function objOp(kind, id = selO) {
  if (!id) return;
  if (kind === 'unrotate') setLayout(id, { rot: null });
  else if (kind === 'reset') { const s = deck.slides[cur]; if (s.layout) { delete s.layout[id]; if (!Object.keys(s.layout).length) delete s.layout; } }
  else if (kind === 'delete') { setLayout(id, { hidden: true }); selO = null; activeText = null; }
  save(); redraw(kind !== 'delete');
  if (kind !== 'delete') selectObj(id);
}
function nudgeObj(dx, dy) {
  const o = objGeom(selO), el = objEl(selO);
  if (!o || !el) return;
  const h = o.k === 'img' ? (el.offsetHeight || o.w) : o.h;   // 그림은 높이가 정해져 있지 않으므로 실제 그려진 높이
  const c = clampPos(o.x + dx, o.y + dy, o.w, h);
  const x = Math.round(c.x), y = Math.round(c.y);
  setLayout(selO, { x, y });
  el.style.left = x + 'px'; el.style.top = y + 'px';
  save(); refreshThumb();
}
// 이 장 전체: 원래 배치로(옮기고 숨긴 것 모두 되돌림) / 숨긴 개체만 다시 보이기
function slideLayoutOp(kind) {
  const s = deck.slides[cur];
  if (!s.layout) return;
  if (kind === 'reset') delete s.layout;
  else for (const id of Object.keys(s.layout)) setLayout(id, { hidden: null });
  selO = null;
  save(); redraw();
}
function hiddenCount(slide) {
  return Object.values(slide.layout || {}).filter(v => v.hidden).length;
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
    // 표·상자 내용처럼 글 길이로 자동 정렬되는 칸은 직접 고른 정렬을 항상 저장하고, [자동]으로 되돌린다.
    const auto = !!el.dataset.auto;
    const align0 = el.dataset.align0 || 'left';
    const alignNow = st.align || (auto ? '' : align0);
    const pick = a => () => setBoxStyle(el, 'align', !auto && a === align0 ? null : a);
    bar.append(
      ctxGroup('크기',
        ctxButton('A−', '글자 작게', step(-0.1)),
        ctxButton(`${Math.round((st.scale || 1) * 100)}%`, '기본 크기로', () => setBoxStyle(el, 'scale', null)),
        ctxButton('A+', '글자 크게', step(0.1))),
      ctxGroup('정렬',
        ...(auto ? [ctxButton('자동', '글 길이에 맞춰 자동 정렬 (짧으면 가운데, 길면 왼쪽)', () => setBoxStyle(el, 'align', null), st.align ? '' : 'on')] : []),
        ...[['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']].map(([a, l]) => ctxButton(l, `${l} 정렬`, pick(a), alignNow === a ? 'on' : ''))),
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
    const ob = el.closest('.obj');
    if (ob) bar.append(objGroup('상자', ob.dataset.oid, slide));
    return;
  }

  // 형태 개체를 골랐을 때 (그림, 장식, 그림 칸, 글자를 편집하지 않는 상자)
  if (selO) {
    if (slide.type === 'image' && selO === 'slot') bar.append(slotGroup(slide));
    bar.append(objGroup('개체', selO, slide));
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
  if (slide.type === 'image') bar.append(slotGroup(slide));
  if (slide.layout) {
    const hid = hiddenCount(slide);
    bar.append(ctxGroup('이 장',
      ...(hid ? [ctxButton(`숨긴 개체 보이기 (${hid})`, '삭제한 개체를 다시 보이기', () => slideLayoutOp('show'))] : []),
      ctxButton('원래 배치로', '이 장에서 옮기고 바꾸고 삭제한 개체를 모두 형태 기본으로 되돌리기', () => slideLayoutOp('reset'))));
  }
  const tip = document.createElement('span');
  tip.className = 'ctx-label';
  tip.textContent = '글자·그림·스티커를 누르면 그에 맞는 도구가 여기에 나와요';
  bar.append(tip);
}
// 형태 개체 하나의 도구: 회전 0°, 원래 위치로, 삭제
function objGroup(label, id, slide) {
  const o = objGeom(id), lay = (slide.layout || {})[id];
  const moved = lay && ['x', 'y', 'w', 'h', 'rot'].some(k => k in lay);
  return ctxGroup(label,
    ...(o && o.rot ? [ctxButton('↺ 회전 0°', `지금 ${o.rot}°`, () => objOp('unrotate', id))] : []),
    ...(moved ? [ctxButton('원래 위치로', '이 개체만 형태 기본 위치·크기로', () => objOp('reset', id))] : []),
    ctxButton('삭제', '이 개체 삭제 (Delete) · [원래 배치로]나 [숨긴 개체 보이기]로 되살릴 수 있어요', () => objOp('delete', id), 'danger'));
}
function slotGroup(slide) {
  return ctxGroup('그림', ctxButton('그림 고르기', '그림 칸에 넣을 그림 고르기 (그림 칸을 두 번 눌러도 돼요)', () => openStickerPanel(true)),
    ctxButton('그림 빼기', '그림 칸 비우기', () => { delete slide.img; save(); redraw(true); }));
}

/* ===== 떠 있는 패널 ===== */
let stickerTab = 'basic';
function openStickerPanel(forSlot) {
  slotPick = !!forSlot;
  $('stickerPanelTitle').textContent = slotPick ? '그림 칸에 넣을 그림' : '스티커';
  $('settingsPanel').hidden = true;
  $('aboutPop').hidden = true;
  $('stickerPanel').hidden = false;
  renderStickerGrid();
}
// [기본] 8개와 [추가](덱을 만들며 새로 생성한 그림)를 탭으로 나눠 보여 준다
function renderStickerGrid() {
  document.querySelectorAll('#stickerTabs button').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === stickerTab);
    b.setAttribute('aria-selected', b.dataset.tab === stickerTab ? 'true' : 'false');
  });
  const grid = $('stickerGrid');
  const list = STICKERS.filter(st => st.group === stickerTab);
  grid.replaceChildren(...list.map(st => {
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
    return b;
  }));
  $('stickerEmpty').hidden = list.length > 0;
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

/* ===== 인쇄 (PDF로 저장) =====
   [인쇄] → 모든 장을 등장 효과 없이 1920x1080 쪽으로 펼쳐 놓고 인쇄 창을 연다.
   PDF는 인쇄 창에서 대상을 'PDF로 저장'으로 고르고, 일부 장만은 인쇄 창의 '페이지'에서 고른다.
   쪽 크기·여백·배경 인쇄의 기본값은 style.css의 @media print가 정한다 (크롬 기준. 사파리는 쪽이 잘린다).
   글자 자동 맞춤은 보이는 상태에서만 잴 수 있어서, 화면에서는 #printHost를 화면 밖에 두고 잰다. */
// 늦게까지 불러오지 못한 것이 있으면 true를 돌려준다
async function buildPrintPages() {
  const ph = $('printHost');
  ph.replaceChildren(...deck.slides.map(s => {
    const page = document.createElement('div');
    page.className = 'print-page';
    page.appendChild(makeSlide(s, { editable: false, animate: false }));
    return page;
  }));
  // 글꼴·그림·배경을 불러온 뒤에 맞추고 인쇄한다. 빠지거나 늦는 그림 때문에 멈추지 않게 3초까지만 기다린다.
  const loaded = img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = img.onerror = r; });
  const bg = new Image();
  bg.src = BG[deck.bg];
  let late = false;
  await Promise.race([
    Promise.all([document.fonts.ready, loaded(bg), ...[...ph.querySelectorAll('img')].map(loaded)]),
    new Promise(r => setTimeout(() => { late = true; r(); }, 3000)),
  ]);
  fitText(ph);
  return late;
}

/* 인쇄 작업은 한 번에 하나만. 준비하는 동안은 [인쇄]를 잠근다.
   펼쳐 둔 쪽과 파일 이름은 인쇄가 끝났다는 신호(afterprint)를 받은 뒤에 지운다
   (인쇄 창이 기다려 주지 않는 브라우저도 있어서). 신호가 오지 않으면 다음 인쇄를 시작할 때 지운다. */
let printJob = null;   // { title, printing, warned }
function endPrintJob() {
  if (!printJob) return;
  document.title = printJob.title;
  if (printJob.warned) setStatus('');
  printJob = null;
  window.removeEventListener('afterprint', endPrintJob);
  $('printHost').replaceChildren();
}
async function printDeck() {
  if (printJob && !printJob.printing) return;   // 준비 중에 또 누름
  endPrintJob();                                 // 지난 인쇄가 신호 없이 끝났으면 정리
  const job = printJob = { title: document.title, printing: false };
  $('btnPrint').disabled = true;
  try {
    releaseFocus();
    flushSave();
    const late = await buildPrintPages();
    if (printJob !== job) return;
    if (late) { job.warned = true; setStatus('⚠ 일부 그림·글꼴을 3초 안에 불러오지 못해, 불러온 만큼으로 인쇄해요.'); }
    document.title = packName() || 'Any-Slide';   // PDF 파일 이름의 기본값
    job.printing = true;
    window.addEventListener('afterprint', endPrintJob);
    window.print();
  } catch (e) {
    endPrintJob();
    setStatus(`⚠ 인쇄하지 못했어요: ${e.message}`);
  } finally {
    $('btnPrint').disabled = false;
  }
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
    if (!$('stickerPanel').hidden || !$('settingsPanel').hidden || !$('aboutPop').hidden) {
      $('stickerPanel').hidden = $('settingsPanel').hidden = $('aboutPop').hidden = true; return;
    }
    if (sel >= 0 || selO) { selectNone(); return; }
    if (mode === 'present') endPresent();
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  // 스티커나 개체를 고른 상태: 화살표로 옮기고 Delete/Backspace로 지운다
  if (mode === 'edit' && (sel >= 0 || selO)) {
    const step = e.shiftKey ? 50 : 10;
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (mv) { e.preventDefault(); sel >= 0 ? nudgeSticker(...mv) : nudgeObj(...mv); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); sel >= 0 ? stickerOp('delete') : objOp('delete'); return; }
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
    delete s.layout;   // 개체 배치는 형태마다 다르므로 형태를 바꾸면 기본 배치로
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
  document.querySelectorAll('#stickerTabs button').forEach(b => b.addEventListener('click', () => { stickerTab = b.dataset.tab; renderStickerGrid(); }));
  // 그림 칸은 두 번 누르면 그림 고르기 (한 번 누르면 개체 선택·이동)
  host.addEventListener('dblclick', e => {
    if (mode === 'edit' && e.target.closest('[data-slot]')) openStickerPanel(true);
  });
  // 정보 팝업
  $('aboutVersion').textContent = `Any-Slide v${APP_VERSION}`;
  $('btnAbout').addEventListener('click', e => {
    e.stopPropagation();
    $('aboutPop').hidden = !$('aboutPop').hidden;
  });
  document.addEventListener('pointerdown', e => {
    if (!$('aboutPop').hidden && !e.target.closest('#aboutPop, #btnAbout')) $('aboutPop').hidden = true;
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
  $('btnPrint').addEventListener('click', printDeck);
  if (PACK) { $('btnSaveFolder').hidden = false; $('btnSaveFolder').addEventListener('click', saveToFolder); }
  $('fileImport').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    // 후보 덱을 끝까지 검증하고 렌더링해 본 뒤에만 현재 덱을 바꾼다. 실패하면 기존 덱을 그대로 둔다.
    const prev = deck, prevCur = cur;
    try {
      const next = sanitize(JSON.parse(await f.text()));
      deck = next;
      next.slides.forEach(s => slideHTML(s, { editable: false, animate: false }));
      packBroken = false; setStatus('');
      cur = 0; save(); go(0, true);
    } catch (err) {
      deck = prev; cur = prevCur;
      alert('불러오지 못했어요. 올바른 덱 파일이 아니에요. (' + err.message + ')\n지금 편집 중인 덱은 그대로 두었어요.');
    }
  });
  $('btnReset').addEventListener('click', () => {
    if (!confirm(PACK ? '모든 편집 내용을 지우고 이 폴더의 원래 덱으로 되돌릴까요?' : '모든 편집 내용을 지우고 처음 상태로 되돌릴까요?')) return;
    deck = initialDeck(); cur = 0; save(); go(0, true);
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
// #print: 인쇄 창 없이 인쇄용 쪽만 펼쳐 둔다 (헤드리스 Chrome --print-to-pdf로 확인할 때)
const hash = new URLSearchParams(location.hash.slice(1));
go(Math.max(0, (parseInt(hash.get('s'), 10) || 1) - 1));
if (hash.has('view')) setMode('present');
if (hash.has('print')) buildPrintPages();
