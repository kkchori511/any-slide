# Codex 요청: 4차 수정 검토 (v1.4.0 ~ v1.6.0)

검토 대상 작업 폴더: `/Users/kc/projects/any-slide` (브랜치 `skill-ask-date`)
바뀐 부분: `git -C /Users/kc/projects/any-slide diff main skill-ask-date`

## 이번에 바뀐 것 (사용자가 승인한 4차 수정)

1. 덱 사전 조사에 발표 날짜 묻기 (스킬 문서, AGENTS.md)
2. **덱 전용 그림 (v1.4.0)**: 노션 그림 등을 덱에서 `media/<파일>`로 쓴다.
   - `deck-spec.js`: `MEDIA_RE`, `isMediaSrc`, `sanitize`가 그림 칸(`img`)과 스티커에 `media/` 경로를 허용
   - `style.css`: 그림 칸의 덱 전용 그림에 둥근 모서리·그림자
   - 스크립트 `.claude/skills/slide-deck/scripts/`: `media.mjs`(그림 폴더 `decks/<덱 이름>_그림/`), `check-deck.mjs`(빠진 그림 경고), `preview-deck.mjs`(`app/media`를 그림 폴더에 잠시 심볼릭 링크), `pack-deck.mjs`(`--media`, 발표 폴더 `media/`로 복사, 빠지면 멈춤)
   - 지침: 스킬 문서 「3-1. 노션 그림 넣기」, AGENTS.md, `app/README.md`
3. **PDF로 저장 (v1.5.0)**: `app.js`의 `buildPrintPages`, `printPdf`, `Any-Slide.html`의 `#printHost`, `style.css`의 `@media print`(쪽 1920x1080, 여백 0, `print-color-adjust: exact`, 인쇄 때 그림자 → 테두리). 글꼴·그림을 최대 3초 기다린 뒤 글자 맞춤. `#pdf` 해시는 인쇄 창 없이 쪽만 펼친다(헤드리스 확인용).
4. **PDF 쪽 고르기 (v1.6.0)**: `#pdfPanel`(전체/일부, `1-5, 8` 입력 또는 번호 버튼), `deck-spec.js`의 `parsePages`, `pagesToText`, `#pdf=4-9,22` 해시. 브라우저는 인쇄 창 없이 PDF를 만들 수 없어서 인쇄 창은 한 번 뜬다(사용자 승인).

## 지시 사항 (검토만 한다)

- **소스 파일을 고치지 않는다.** 의견과 수정 제안만 보고서에 적는다.
- **Chrome은 실행하지 않는다.** 코드 읽기와 Node 격리 실행으로만 확인한다. (Claude가 헤드리스 Chrome으로 PDF 33쪽·일부 7쪽, 기본 덱 13장 캡처가 수정 전과 같음을 확인했다.)
- **텔레그램 등 밖으로 아무것도 보내지 않는다.**
- `decks/`의 파일(사용자 발표 자료)은 읽기만 한다. `pack-deck.mjs`를 시험하려면 덱과 그림 폴더를 임시 폴더에 복사해 쓰고, `--dest`도 임시 폴더로 준다. 끝나면 만든 폴더와 `decks/생성기록.json` 변경을 되돌린다. 바탕화면에는 만들지 않는다.
- `preview-deck.mjs`는 Chrome을 실행하므로 돌리지 않는다. `app/media` 링크 처리는 코드로만 본다.

중점적으로 볼 것:
- `media/` 경로 검증: 상위 경로, 인코딩, 하위 폴더, 대소문자, 유니코드 파일 이름, `esc()`로 넣는 HTML 속성 안전성, 앱 안에서 그림 칸·스티커로 들어오는 다른 길
- 스크립트: 그림 폴더가 없을 때, 덱 이름에 특수 문자가 있을 때, `preview-deck`이 도중에 멈췄을 때 `app/media` 링크가 남는지, 이미 `app/media`가 있을 때
- 인쇄: `@media print`가 화면 표시(편집·발표·썸네일)에 영향이 없는지, `#printHost`를 화면 밖에 두는 방식, 기다리기(3초 제한)와 `afterprint` 없이 `window.print()` 뒤 바로 지우는 방식이 브라우저마다 안전한지(특히 사파리·파이어폭스에서 인쇄가 비동기일 때)
- 쪽 고르기: `parsePages` 경계값, 입력과 번호 버튼의 동기화, 장 수가 바뀐 뒤 다시 열 때, Esc·다른 패널과의 관계, 파일 이름에 쓰는 `document.title`
- 문서(README, 스킬 문서, AGENTS.md)와 코드가 맞는지

## 보고서

`/Users/kc/projects/any-slide/docs/codex결과_4차수정검토.md`에 저장한다.

- **요약**: 3~5줄
- **문제 목록**: 심각도(높음/중간/낮음), 파일과 줄 번호, 증상, 근거([실행 확인 — 격리]/[정적 확인]/[추정]), 수정 제안
- **의견**: 우선순위 순서
