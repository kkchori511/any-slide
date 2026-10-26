#!/usr/bin/env node
// 텔레그램 다다비서봇으로 사용자에게 파일을 보낸다. 반드시 사용자가 허락한 뒤에만 실행한다.
//
// 사용법:
//   node .claude/skills/slide-deck/scripts/send-telegram.mjs --whoami          봇 이름만 확인 (파일은 보내지 않음)
//   node .claude/skills/slide-deck/scripts/send-telegram.mjs <파일> [--caption "설명"]
//
// 봇 설정은 ~/projects/hwp-telegram-assistant/.env 의 BOT_TOKEN, ALLOWED_CHAT_ID를 읽는다 (TELEGRAM_ENV로 다른 파일 지정).
// 토큰은 화면이나 기록에 출력하지 않는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const envFile = process.env.TELEGRAM_ENV || path.join(os.homedir(), 'projects/hwp-telegram-assistant/.env');
const fail = msg => { console.error(`✘ ${msg}`); process.exit(1); };
if (!fs.existsSync(envFile)) fail(`봇 설정 파일이 없음: ${envFile}`);
const env = Object.fromEntries(fs.readFileSync(envFile, 'utf8').split('\n')
  .map(l => /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const token = env.BOT_TOKEN, chat = env.ALLOWED_CHAT_ID;
if (!token || !chat) fail('BOT_TOKEN 또는 ALLOWED_CHAT_ID가 설정 파일에 없음');
const api = method => `https://api.telegram.org/bot${token}/${method}`;
const hide = s => String(s).split(token).join('…');   // 오류 메시지에 토큰이 섞이지 않게

const args = process.argv.slice(2);
try {
  if (args[0] === '--whoami') {
    const r = await (await fetch(api('getMe'))).json();
    if (!r.ok) fail(`봇 확인 실패: ${hide(r.description)}`);
    console.log(`✔ 봇: ${r.result.first_name} (@${r.result.username})`);
    process.exit(0);
  }
  const file = args[0];
  if (!file || !fs.existsSync(file)) fail('보낼 파일을 주세요');
  const size = fs.statSync(file).size;
  if (size > 50 * 1048576) fail(`파일이 50MB를 넘어 봇으로 보낼 수 없음 (${(size / 1048576).toFixed(1)}MB)`);
  const ci = args.indexOf('--caption');
  const form = new FormData();
  form.append('chat_id', chat);
  if (ci >= 0 && args[ci + 1]) form.append('caption', args[ci + 1]);
  // 받는 쪽 파일 이름은 NFC로 (맥의 NFD 이름은 윈도우에서 자소가 풀려 보인다)
  const fileName = path.basename(file).normalize('NFC');
  form.append('document', new Blob([fs.readFileSync(file)]), fileName);
  const r = await (await fetch(api('sendDocument'), { method: 'POST', body: form })).json();
  if (!r.ok) fail(`보내기 실패: ${hide(r.description)}`);
  console.log(`✔ 보냄: ${fileName} (${(size / 1048576).toFixed(1)}MB)`);
} catch (e) {
  fail(`텔레그램 연결 실패: ${hide(e.message)}`);
}
