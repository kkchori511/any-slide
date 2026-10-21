# Codex 요청: 1차 수정 검토

검토 대상 작업 폴더: `/Users/kc/projects/any-slide/.claude/worktrees/round1` (git worktree, 브랜치 `round1`)
바뀐 부분: `git -C /Users/kc/projects/any-slide/.claude/worktrees/round1 diff main round1`

## 이번에 바뀐 것 (사용자가 승인한 1차 수정 7건)

1. 스티커 패널 잘림 수정, 이름 표시
2. 스티커 네 모서리 크기 조절, 회전(Shift 15도), 뒤집기, 앞뒤 순서, 복제, 화살표 이동
3. 글자 서식: 선택한 글자 굵게·밑줄·형광펜·색, 칸 전체 크기·정렬·줄 간격. 덱에는 `**`, `__`, `==`, `{{색:}}` 표기로 저장 (`deck-spec.js`의 parseMarkup/runsToMarkup, `app.js`의 domItems/applyFormat)
4. 새 형태 7종(2단 비교, 카드, 단계, 큰 한 문장, 코드, 표, 그림+설명), 글이 적으면 키우는 자동 맞춤(fitBox의 grow), 검사 스크립트의 빈 공간 경고
5. 장 전환: 새 장이 이전 장 위로 겹쳐 들어오기(깜박임 제거), 전환 5종과 속도, 장별 전환
6. 글자 등장·그림 등장·둥실둥실 따로 설정, 설정 패널
7. 덱 제작 지침: 사전 조사, 그림 제안 후 수락한 것만 생성 (`.claude/skills/slide-deck/SKILL.md`, `AGENTS.md`)

## 지시 사항 (검토만 한다)

**소스 파일을 고치지 않는다.** 의견과 수정 제안만 보고서에 적는다.

1. `app/deck-spec.js`, `app/app.js`, `app/style.css`, `app/index.html`, 스킬 문서와 스크립트를 읽는다.
2. 아래를 중점적으로 본다. 실제 재현한 것과 코드만 보고 추정한 것을 구분한다.
   - 서식 있는 글자 편집: contenteditable DOM ↔ 표기 왕복, 선택 위치 복원, 한글 조합 입력, 붙여넣기, 표 칸의 `|` 처리, XSS 가능성
   - 덱 검증(sanitize): 새 필드(settings, styles, count, img, rot, flip)의 범위 검사, 예전 덱 호환, 앱이 만든 덱을 다시 열 수 있는지
   - 장 전환: 빠르게 연달아 넘길 때, 전환 중 편집, 발표 모드, 크기 배율(transform)과 겹침
   - 스티커 변형: 회전된 상태의 크기 조절·이동, 화면 밖으로 사라짐, 순서 바꾼 뒤 선택
   - 자동 맞춤: 키우기와 줄이기의 반복, 썸네일, 글꼴 로드 뒤
   - 상황별 도구 줄: 포커스와 선택이 버튼을 눌러도 유지되는지
3. 가능하면 macOS Chrome 헤드리스로 확인한다. 실행이 안 되면 이유를 적는다.

## 보고서

`/Users/kc/projects/any-slide/.claude/worktrees/round1/docs/codex결과_1차수정검토.md`에 저장한다.

- **요약**: 3~5줄
- **문제 목록**: 심각도(높음/중간/낮음), 파일과 줄 번호, 증상, 근거([실행 확인]/[정적 확인]/[추정]), 수정 제안
- **의견**: 다음에 하면 좋을 것, 우선순위 순서
