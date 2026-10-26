#!/usr/bin/env node
// 덱 하나로 발표 폴더를 만든다. 폴더만 있으면 맥·윈도우 어디서나 Any-Slide.html을 열어 바로 발표할 수 있다.
//
// 사용법:
//   node .claude/skills/slide-deck/scripts/pack-deck.mjs <덱.json> --title "슬라이드 제목" [--dest 저장할곳] [--version N] [--media 그림폴더] [--zip]
//   node .claude/skills/slide-deck/scripts/pack-deck.mjs --zip-folder <발표 폴더>     (만들어 둔 폴더를 나중에 zip으로)
//
// - 저장할 곳 기본값: 바탕화면 (~/Desktop)
// - 폴더 이름: <제목>_v<버전>. 버전은 같은 제목으로 덱을 만든 횟수다 (decks/생성기록.json). --version N으로 직접 정할 수 있다.
// - 폴더 안: Any-Slide.html, 앱 파일(app.js, deck-spec.js, style.css), assets/, fonts/, 덱 JSON, deck-data.js(덱을 바로 여는 파일)
// - 덱 전용 그림(media/<파일>)은 <덱 이름>_그림/ 폴더(--media로 바꿀 수 있음)에서 폴더 안 media/로 복사한다
// - --zip: 폴더 안에 Any-Slide.zip을 만든다 (압축을 풀면 <제목>_v<버전> 폴더가 나온다)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mediaDirOf, mediaRefs, missingMedia } from './media.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const appDir = path.join(root, 'app');
const recordFile = path.join(root, 'decks', '생성기록.json');

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const fail = msg => { console.error(`✘ ${msg}`); process.exit(1); };

// 폴더를 zip으로 묶는다. 이름이 한글이어도 윈도우에서 깨지지 않도록 파이썬 zipfile(UTF-8 표시)을 쓴다.
function zipFolder(folder) {
  const zipPath = path.join(folder, 'Any-Slide.zip');
  const py = `
import os, sys, zipfile
folder, out = sys.argv[1], sys.argv[2]
base = os.path.basename(folder.rstrip('/'))
# 운영체제가 몰래 만드는 파일만 뺀다 (덱에 필요한 파일은 이름이 점으로 시작해도 넣는다)
junk = lambda n: n in ('.DS_Store', 'Thumbs.db', 'desktop.ini', '.git') or n.startswith('._')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for dp, dn, fn in os.walk(folder):
        dn[:] = sorted(d for d in dn if not junk(d))
        for f in sorted(fn):
            p = os.path.join(dp, f)
            if junk(f) or os.path.abspath(p) == os.path.abspath(out):
                continue
            z.write(p, os.path.join(base, os.path.relpath(p, folder)))
`;
  execFileSync('python3', ['-I', '-c', py, folder, zipPath], { stdio: 'inherit' });
  return zipPath;
}

if (args[0] === '--zip-folder') {
  const folder = path.resolve(args[1] || '');
  if (!fs.existsSync(path.join(folder, 'Any-Slide.html'))) fail(`발표 폴더가 아님: ${folder}`);
  const z = zipFolder(folder);
  console.log(`✔ zip: ${z} (${(fs.statSync(z).size / 1048576).toFixed(1)}MB)`);
  process.exit(0);
}

const deckFile = args[0];
const title = opt('--title');
const dest = path.resolve((opt('--dest') || path.join(os.homedir(), 'Desktop')).replace(/^~(?=$|\/)/, os.homedir()));
if (!deckFile || deckFile.startsWith('--')) fail('사용법: node pack-deck.mjs <덱.json> --title "슬라이드 제목" [--dest 저장할곳] [--version N] [--zip]');
if (!title) fail('--title "슬라이드 제목"을 주세요 (폴더 이름과 버전 기록에 씁니다)');
if (!fs.existsSync(dest)) fail(`저장할 곳이 없음: ${dest}`);

// 앱과 같은 검증을 거친다
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(appDir, 'deck-spec.js'), 'utf8'), ctx);
let deck;
try { deck = ctx.DeckSpec.sanitize(JSON.parse(fs.readFileSync(deckFile, 'utf8'))); }
catch (e) { fail(`앱이 열 수 없는 덱: ${e.message}`); }

// 덱 전용 그림이 모두 있어야 만든다 (빠진 그림은 발표 화면에서 빈칸이 된다)
const mediaDir = path.resolve(opt('--media') || mediaDirOf(deckFile));
const lost = missingMedia(deck, mediaDir);
if (lost.length) fail(`덱 그림이 없음 (${mediaDir}): ${lost.join(', ')}`);

// 폴더 이름에 못 쓰는 글자를 빼고, 앞의 점(숨김 폴더가 됨)도 뺀다
const safeTitle = title.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').replace(/^[.\s_]+/, '');
if (!safeTitle) fail('제목에 폴더 이름으로 쓸 수 있는 글자가 없음');
// 생성 기록이 깨졌으면 덮어쓰지 않고 멈춘다 (지금까지의 버전 기록을 잃지 않게)
let records = [];
if (fs.existsSync(recordFile)) {
  try { records = JSON.parse(fs.readFileSync(recordFile, 'utf8')); } catch (e) { records = null; }
  if (!Array.isArray(records)) records = null;
}
// 버전: 같은 제목으로 만든 횟수 + 1 (--version N으로 직접 정할 수 있다)
const vOpt = opt('--version');
if (vOpt !== undefined && !/^[1-9]\d{0,3}$/.test(vOpt)) fail('--version은 1 이상의 정수');
if (!records && !vOpt) fail(`생성 기록 파일이 깨짐: ${recordFile}\n  파일을 고치거나 옮긴 뒤 다시 실행하세요. 기록 없이 버전을 직접 정하려면 --version N`);
const version = vOpt ? Number(vOpt) : records.filter(r => r && r.title === safeTitle).length + 1;
const name = `${safeTitle}_v${version}`;
const folder = path.join(dest, name);
if (fs.existsSync(folder)) fail(`같은 이름의 폴더가 이미 있음: ${folder} (지우거나 옮긴 뒤 다시 실행)`);

// 앱 파일 복사
fs.mkdirSync(folder);
for (const f of ['app.js', 'deck-spec.js', 'style.css']) fs.copyFileSync(path.join(appDir, f), path.join(folder, f));
for (const d of ['assets', 'fonts']) fs.cpSync(path.join(appDir, d), path.join(folder, d), { recursive: true, filter: s => !path.basename(s).startsWith('.') });
const media = mediaRefs(deck);
if (media.length) {
  fs.mkdirSync(path.join(folder, 'media'));
  for (const n of media) fs.copyFileSync(path.join(mediaDir, n), path.join(folder, 'media', n));
}
// 덱 JSON과 덱을 바로 여는 파일. 저장 공간 이름은 폴더마다 달라서 다른 발표 폴더와 섞이지 않는다.
fs.writeFileSync(path.join(folder, `${name}.json`), JSON.stringify(deck, null, 2));
// savedAt: 덱을 고친 시각. 앱은 브라우저에 저장된 것과 비교해 최신 쪽을 연다 ([폴더에 저장]이 갱신한다).
const pack = { key: `any-slide:${name}:${crypto.randomBytes(4).toString('hex')}`, title: safeTitle, version, savedAt: new Date().toISOString(), deck };
fs.writeFileSync(path.join(folder, 'deck-data.js'), `// ${name} 덱. Any-Slide.html이 이 덱을 바로 연다.\nwindow.ANY_SLIDE_PACK = ${JSON.stringify(pack)};\n`);
const html = fs.readFileSync(path.join(appDir, 'Any-Slide.html'), 'utf8');
if (!html.includes('<script src="deck-spec.js">')) fail('Any-Slide.html 구조가 예상과 다름');
fs.writeFileSync(path.join(folder, 'Any-Slide.html'), html.replace('<script src="deck-spec.js">', '<script src="deck-data.js"></script>\n<script src="deck-spec.js">'));

// 생성 기록 (decks/는 git에 올리지 않는다). 기록이 깨졌으면 손대지 않는다.
if (!records) console.log(`⚠ 생성 기록이 깨져 있어 이번 버전은 기록하지 않았어요: ${recordFile}`);
else {
  records.push({ title: safeTitle, version, folder, deck: path.resolve(deckFile), slides: deck.slides.length, date: new Date().toISOString().slice(0, 10) });
  fs.mkdirSync(path.dirname(recordFile), { recursive: true });
  // 중간에 끊겨도 기록이 반쯤 쓰이지 않게 임시 파일에 쓴 뒤 바꿔 넣는다
  const tmp = `${recordFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(records, null, 2));
  fs.renameSync(tmp, recordFile);
}

console.log(`✔ 발표 폴더: ${folder}`);
console.log(`  여는 파일: ${path.join(folder, 'Any-Slide.html')}`);
if (args.includes('--zip')) {
  const z = zipFolder(folder);
  console.log(`✔ zip: ${z} (${(fs.statSync(z).size / 1048576).toFixed(1)}MB)`);
}
