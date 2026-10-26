// 덱 전용 그림(media/<파일>) 도우미. 그림은 덱 파일 옆 <덱 이름>_그림/ 폴더에 둔다 (decks/는 git에 올리지 않는다).
//   decks/2026-10-28_발표.json → decks/2026-10-28_발표_그림/
import fs from 'node:fs';
import path from 'node:path';

export const mediaDirOf = deckFile => deckFile.replace(/\.json$/i, '') + '_그림';

// 덱이 가리키는 media/ 그림 파일 이름 (그림 칸과 스티커)
export function mediaRefs(deck) {
  const names = new Set();
  for (const s of deck.slides) {
    for (const src of [s.img, ...(s.stickers || []).map(k => k.src)]) {
      if (typeof src === 'string' && src.startsWith('media/')) names.add(src.slice(6));
    }
  }
  return [...names];
}

// 그림 폴더에 없는 파일 이름
export const missingMedia = (deck, dir) => mediaRefs(deck).filter(n => !fs.existsSync(path.join(dir, n)));
