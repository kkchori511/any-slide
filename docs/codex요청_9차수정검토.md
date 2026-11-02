# Codex 요청: 9차 수정 검토 (v1.11.0)

검토 대상 작업 폴더: `/Users/kc/projects/any-slide` (브랜치 `table-resize`)
바뀐 부분: `git -C /Users/kc/projects/any-slide diff main table-resize`

## 이번에 바뀐 것 (사용자가 승인한 9차 수정)

1. **표 열 너비·행 높이 조절** (사용자가 고른 방식 A: 경계선 끌기)
   - `deck-spec.js`: 덱의 장에 `colW`(열 너비 비율), `rowH`(행 높이 비율). `sanitize`는 표가 있는 형태에서만 숫자 배열을 받아 0.2~20으로 자르고 소수 둘째 자리로(최대 50칸, 넘으면 예외). `tableTracks(slide)`는 칸 수에 맞춰 채우고(모자라면 1, 남으면 버림) 행은 가장 작은 값이 1이 되게 맞춤(높이가 정해지지 않은 격자에서 1보다 작은 fr 때문).
   - `app.js`: `tableGrid`/`tableGridStyle`로 `grid-template-columns: minmax(0,Nfr)…`, `grid-template-rows: Nfr…`. `colW`가 없으면 예전과 같은 `repeat(n,minmax(0,1fr))`.
   - 끌기: `tableEdgeAt`(칸 경계 화면 6px 안, 돌린 표 제외), `host` `pointermove`로 `data-rs` 손 모양, `pointerdown`에서 글자 편집보다 먼저 `startTableResize`. 열은 양옆 열이 너비를 주고받음(최소 60px), 행은 그 행만(그 행 칸들을 `align-self:start`로 잰 글 높이보다 작아지지 않음). 놓으면 `fitBox`, 저장.
   - `tableOp`: 줄·칸 더하기·빼기 때 비율 배열도 같은 자리에 더하고 뺌(새 것은 이웃 값), `resetSize`는 둘 다 지움. 표 칸을 고르면 [크기 같게] 버튼(바꾼 표에만). 형태를 표가 아닌 것으로 바꾸면 `colW`·`rowH` 지움.
2. **지침**: 스킬 문서 두 벌(같은 내용)에 「표 열 너비와 행 높이」(내용에 맞춰 `colW`, 4배 안쪽, 비슷하면 생략), AGENTS.md, `app/README.md`.
3. **`check-deck.mjs`**: 표 넘침 어림에 `colW` 반영(열마다 폭), `colW` 없이 열마다 가장 긴 줄 폭이 2배 이상 다르면 경고와 추천 비율(4배까지). 표가 아닌 장의 `colW`·`rowH`는 "알 수 없는 칸" 경고.

Claude가 확인한 것: Node에서 `sanitize`·`tableTracks`(잘못된 값, 칸 수보다 긴 배열, 표 아닌 장), `check-deck` 경고 나옴·`colW` 넣으면 사라짐, `preview-deck`으로 `colW [1,4]`·`rowH [1,2,1]` 캡처, 헤드리스 Chrome CDP 실제 마우스로 열 경계 끌기(손 모양 col-resize, 너비 바뀜, 저장), 행 경계 끌기, 행을 크게 줄여도 글 높이에서 멈춤, 칸 가운데 누르면 글자 편집, 줄·칸 더하기/빼기 때 비율 배열, [크기 같게], `sanitize` 왕복, 형태 바꾸면 지워짐, 썸네일 반영, 기본 덱 13장 캡처가 main과 같음.

## 지시 사항 (검토만 한다)

- **소스 파일을 고치지 않는다.** 의견과 수정 제안만 보고서에 적는다.
- **Chrome은 실행하지 않는다.** 코드 읽기와 Node 격리 실행으로만 확인한다.
- **텔레그램 등 밖으로 아무것도 보내지 않는다.**
- `decks/`의 파일과 바탕화면은 읽기만 한다.

중점적으로 볼 것:
- 끌기: 경계 판정(첫·끝 줄/칸, 한 칸짜리 표, 빈 칸, 확대 배율 `scale`), 끌기 중 장 넘기기·다시 그리기·창 포커스 잃기(`activeDrag`/`finishDrag`), 글자 편집 중 끌기 시작(`releaseFocus`), 돌린 표, 발표 모드
- 행 높이: fr 행이 높이가 정해지지 않은 격자에서 실제로 비율대로 나뉘는지, `fitBox`(grow 1.3·줄이기)와 함께 쓸 때 문제, 최소 높이 재기 방식
- 비율 배열과 표 내용이 어긋나는 경우(덱 직접 편집, [불러오기], `deck-data.js`, 복제, 줄·칸 더하기/빼기), 반올림이 쌓이는 문제
- `check-deck` 어림과 경고 기준이 적절한지
- 문서와 코드가 맞는지

## 보고서

`/Users/kc/projects/any-slide/docs/codex결과_9차수정검토.md`에 저장한다.

- **요약**: 3~5줄
- **문제 목록**: 심각도(높음/중간/낮음), 파일과 줄 번호, 증상, 근거([실행 확인 — 격리]/[정적 확인]/[추정]), 수정 제안
- **의견**: 우선순위 순서
