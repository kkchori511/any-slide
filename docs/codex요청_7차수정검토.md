# Codex 요청: 7차 수정 검토 (v1.9.0)

검토 대상 작업 폴더: `/Users/kc/projects/any-slide` (브랜치 `text-color`)
바뀐 부분: `git -C /Users/kc/projects/any-slide diff main text-color`

## 이번에 바뀐 것 (사용자가 승인한 7차 수정)

1. **글자 색 검정**: `deck-spec.js`의 `PALETTE`에 `black`(`#1a1a1a`), `style.css`에 `.c-black`. 덱 표기는 `{{black:글자}}`. 기본 글자 색(`#3a3633`)보다 진한 검정.
2. **스펙트럼에서 고르는 [다른 색]**: 덱 표기 `{{#rrggbb:글자}}`(16진수 6자리, 소문자로 맞춤).
   - `deck-spec.js`: `HEX_COLOR`, `textColor()`(목록 이름 또는 #rrggbb, 아니면 null), `parseMarkup`이 두 가지를 받음. `runsToMarkup`은 그대로(`{{${c}:`).
   - `app.js`: `runsToHTML`은 다른 색을 `<span class="cx" data-c="#.." style="color:#..">`로 그림(값은 `textColor`로 검증된 것만). `domItems`는 `.cx`의 `data-c`를 다시 읽음. 도구 줄 [색]에 `<input type="color">`(`colorPicker`), 창을 닫을 때(`change`) 한 번만 `applyFormat`. 칸 안의 선택은 `lastRange`로 지킴.
   - `style.css`: 무지개 동그라미 모양의 `input.swatch.pick`.
3. 문서: 스킬 문서 두 벌(같은 내용), `app/README.md`, AGENTS.md 버전 목록.

Claude가 확인한 것: Node에서 표기 왕복(`{{black:..}}`, `{{#1A73E8:..}}` → 소문자, 잘못된 `{{#12345:..}}`·`{{purple:..}}`는 글자 그대로, 겹친 색), 헤드리스 Chrome에서 색 시험 장 캡처, 편집기에서 글자를 골라 [다른 색] `change`와 [검정] 버튼으로 칠한 뒤 저장된 표기가 `{{#8a4fc8:가나다}}라{{black:마바}}사`, 도구 줄 캡처, 기본 덱 13장 캡처가 수정 전과 같음.

## 지시 사항 (검토만 한다)

- **소스 파일을 고치지 않는다.** 의견과 수정 제안만 보고서에 적는다.
- **Chrome은 실행하지 않는다.** 코드 읽기와 Node 격리 실행으로만 확인한다.
- **텔레그램 등 밖으로 아무것도 보내지 않는다.**
- `decks/`의 파일과 바탕화면은 읽기만 한다.

중점적으로 볼 것:
- `{{#..:` 표기와 HTML 속성(`style`, `data-c`)의 안전성: 검증을 거치지 않고 들어오는 길이 있는지(붙여넣기, contenteditable이 만든 span, 불러오기, 발표 폴더 `deck-data.js`)
- 표기 왕복: 다른 색과 굵게·밑줄·형광펜이 겹칠 때, 다른 색 안의 목록 색, 이스케이프(`\{`)
- 색 고르기 창: 포커스가 창으로 갔을 때 선택 보존, 도구 줄을 다시 그릴 때, 키보드 접근, 사파리·파이어폭스의 `<input type="color">` 차이
- 글자 맞춤(fitText), 인쇄, 썸네일, `check-deck`·`preview-deck` 등 표기를 읽는 다른 곳에 빠진 처리가 있는지
- 문서와 코드가 맞는지

## 보고서

`/Users/kc/projects/any-slide/docs/codex결과_7차수정검토.md`에 저장한다.

- **요약**: 3~5줄
- **문제 목록**: 심각도(높음/중간/낮음), 파일과 줄 번호, 증상, 근거([실행 확인 — 격리]/[정적 확인]/[추정]), 수정 제안
- **의견**: 우선순위 순서
