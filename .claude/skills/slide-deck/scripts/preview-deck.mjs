#!/usr/bin/env node
// 덱 JSON을 앱으로 그려서 슬라이드마다 PNG로 저장한다 (macOS Chrome 헤드리스).
// 사용법: node .claude/skills/slide-deck/scripts/preview-deck.mjs decks/<파일>.json [출력폴더]
// 출력 폴더 기본값: 운영체제 임시 폴더 아래 any-slide-preview
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const file = process.argv[2];
const out = path.resolve(process.argv[3] || path.join(os.tmpdir(), 'any-slide-preview'));
if (!file) { console.error('사용법: node preview-deck.mjs <덱.json> [출력폴더]'); process.exit(1); }
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!fs.existsSync(CHROME)) { console.error(`Chrome을 찾지 못함: ${CHROME} (CHROME 환경 변수로 지정)`); process.exit(1); }

const appDir = path.join(root, 'app');
// 앱과 같은 검증(sanitize)을 먼저 거친다. 앱이 열 수 없는 덱이면 그리지 않는다.
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(appDir, 'deck-spec.js'), 'utf8'), ctx);
let deck;
try { deck = ctx.DeckSpec.sanitize(JSON.parse(fs.readFileSync(file, 'utf8'))); }
catch (e) { console.error(`✘ 앱이 열 수 없는 덱: ${e.message}`); process.exit(1); }
const html = fs.readFileSync(path.join(appDir, 'Any-Slide.html'), 'utf8');
// 앱이 시작하기 전에 덱을 브라우저 저장소에 넣는 임시 페이지 (앱과 같은 폴더여야 에셋 경로가 맞는다)
const tmp = path.join(appDir, `_preview-${process.pid}.html`);
// <script> 안에 넣는 문자열이므로 </script> 같은 글자가 스크립트를 끊지 않게 <, >, & 와 줄 구분 문자를 \u 표기로 바꾼다
const UNSAFE = new RegExp('[<>&' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');
const safe = JSON.stringify(JSON.stringify(deck)).replace(UNSAFE, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
// 쪽 번호 표시(#hud)는 슬라이드 내용이 아니므로 숨기고, 등장 애니메이션은 꺼서 다 나타난 최종 화면을 찍는다
// (애니메이션이 켜져 있으면 늦게 나오는 스티커가 캡처에서 빠질 때가 있다)
const inject = `<style>#hud{display:none!important}.slide,.slide *{animation:none!important}</style>`
  + `<script>try{localStorage.setItem('any-slide-deck-v1', ${safe})}catch(e){}</script>`;
fs.writeFileSync(tmp, html.replace('<script src="deck-spec.js">', inject + '<script src="deck-spec.js">'));
fs.mkdirSync(out, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'any-slide-chrome-'));

try {
  for (let i = 1; i <= deck.slides.length; i++) {
    const png = path.join(out, `slide-${String(i).padStart(2, '0')}.png`);
    execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${profile}`,
      '--window-size=1920,1080', '--virtual-time-budget=8000', `--screenshot=${png}`,
      `file://${tmp}#s=${i}&view`,
    ], { stdio: 'ignore' });
    console.log(png);
  }
} finally {
  fs.rmSync(tmp, { force: true });
  fs.rmSync(profile, { recursive: true, force: true });
}
