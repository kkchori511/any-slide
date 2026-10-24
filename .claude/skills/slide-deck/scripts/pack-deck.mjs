#!/usr/bin/env node
// 덱 하나로 발표 폴더를 만든다. 폴더만 있으면 맥·윈도우 어디서나 Any-Slide.html을 열어 바로 발표할 수 있다.
//
// 사용법:
//   node .claude/skills/slide-deck/scripts/pack-deck.mjs <덱.json> --title "슬라이드 제목" [--dest 저장할곳] [--zip]
//   node .claude/skills/slide-deck/scripts/pack-deck.mjs --zip-folder <발표 폴더>     (만들어 둔 폴더를 나중에 zip으로)
//
// - 저장할 곳 기본값: 바탕화면 (~/Desktop)
// - 폴더 이름: <제목>_v<버전>. 버전은 같은 제목으로 덱을 만든 횟수다 (decks/생성기록.json).
// - 폴더 안: Any-Slide.html, 앱 파일(app.js, deck-spec.js, style.css), assets/, fonts/, 덱 JSON, deck-data.js(덱을 바로 여는 파일)
// - --zip: 폴더 안에 Any-Slide.zip을 만든다 (압축을 풀면 <제목>_v<버전> 폴더가 나온다)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for dp, dn, fn in os.walk(folder):
        dn[:] = sorted(d for d in dn if not d.startswith('.'))
        for f in sorted(fn):
            p = os.path.join(dp, f)
            if f.startswith('.') or os.path.abspath(p) == os.path.abspath(out):
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
if (!deckFile || deckFile.startsWith('--')) fail('사용법: node pack-deck.mjs <덱.json> --title "슬라이드 제목" [--dest 저장할곳] [--zip]');
if (!title) fail('--title "슬라이드 제목"을 주세요 (폴더 이름과 버전 기록에 씁니다)');
if (!fs.existsSync(dest)) fail(`저장할 곳이 없음: ${dest}`);

// 앱과 같은 검증을 거친다
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(appDir, 'deck-spec.js'), 'utf8'), ctx);
let deck;
try { deck = ctx.DeckSpec.sanitize(JSON.parse(fs.readFileSync(deckFile, 'utf8'))); }
catch (e) { fail(`앱이 열 수 없는 덱: ${e.message}`); }

// 버전: 같은 제목으로 만든 횟수 + 1
const safeTitle = title.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
const records = fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile, 'utf8')) : [];
const version = records.filter(r => r.title === safeTitle).length + 1;
const name = `${safeTitle}_v${version}`;
const folder = path.join(dest, name);
if (fs.existsSync(folder)) fail(`같은 이름의 폴더가 이미 있음: ${folder} (지우거나 옮긴 뒤 다시 실행)`);

// 앱 파일 복사
fs.mkdirSync(folder);
for (const f of ['app.js', 'deck-spec.js', 'style.css']) fs.copyFileSync(path.join(appDir, f), path.join(folder, f));
for (const d of ['assets', 'fonts']) fs.cpSync(path.join(appDir, d), path.join(folder, d), { recursive: true, filter: s => !path.basename(s).startsWith('.') });
// 덱 JSON과 덱을 바로 여는 파일. 저장 공간 이름은 폴더마다 달라서 다른 발표 폴더와 섞이지 않는다.
fs.writeFileSync(path.join(folder, `${name}.json`), JSON.stringify(deck, null, 2));
const pack = { key: `any-slide:${name}:${crypto.randomBytes(4).toString('hex')}`, title: safeTitle, version, deck };
fs.writeFileSync(path.join(folder, 'deck-data.js'), `// ${name} 덱. Any-Slide.html이 이 덱을 바로 연다.\nwindow.ANY_SLIDE_PACK = ${JSON.stringify(pack)};\n`);
const html = fs.readFileSync(path.join(appDir, 'Any-Slide.html'), 'utf8');
if (!html.includes('<script src="deck-spec.js">')) fail('Any-Slide.html 구조가 예상과 다름');
fs.writeFileSync(path.join(folder, 'Any-Slide.html'), html.replace('<script src="deck-spec.js">', '<script src="deck-data.js"></script>\n<script src="deck-spec.js">'));

// 생성 기록 (decks/는 git에 올리지 않는다)
records.push({ title: safeTitle, version, folder, deck: path.resolve(deckFile), slides: deck.slides.length, date: new Date().toISOString().slice(0, 10) });
fs.mkdirSync(path.dirname(recordFile), { recursive: true });
fs.writeFileSync(recordFile, JSON.stringify(records, null, 2));

console.log(`✔ 발표 폴더: ${folder}`);
console.log(`  여는 파일: ${path.join(folder, 'Any-Slide.html')}`);
if (args.includes('--zip')) {
  const z = zipFolder(folder);
  console.log(`✔ zip: ${z} (${(fs.statSync(z).size / 1048576).toFixed(1)}MB)`);
}
