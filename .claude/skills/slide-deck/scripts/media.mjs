// 덱 전용 그림(media/<파일>) 도우미. 그림은 덱 파일 옆 <덱 이름>_그림/ 폴더에 둔다 (decks/는 git에 올리지 않는다).
//   decks/2026-10-28_발표.json → decks/2026-10-28_발표_그림/
import fs from 'node:fs';
import path from 'node:path';

export const mediaDirOf = deckFile => deckFile.replace(/\.json$/i, '') + '_그림';

// 덱이 가리키는 media/ 그림 파일 이름 (그림 칸과 스티커). isMediaSrc는 앱과 같은 규칙(deck-spec.js)을 넘겨받는다.
export function mediaRefs(deck, isMediaSrc) {
  const names = new Set();
  for (const s of deck.slides) {
    for (const src of [s.img, ...(s.stickers || []).map(k => k.src)]) {
      if (isMediaSrc(src)) names.add(src.slice(6));
    }
  }
  return [...names];
}

// 읽을 수 있는 실제 파일인지 (같은 이름의 폴더나 읽기 권한 없는 파일은 빠진 것으로 본다)
function readableFile(p) {
  try { fs.accessSync(p, fs.constants.R_OK); return fs.statSync(p).isFile(); } catch (e) { return false; }
}

// 그림 폴더에 없거나 읽을 수 없는 파일 이름
export const missingMedia = (deck, dir, isMediaSrc) => mediaRefs(deck, isMediaSrc).filter(n => !readableFile(path.join(dir, n)));
