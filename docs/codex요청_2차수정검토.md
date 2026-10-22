# Codex 요청: 2차 수정 검토 (v1.2.0)

검토 대상 작업 폴더: `/Users/kc/projects/any-slide/.claude/worktrees/round2` (git worktree, 브랜치 `round2`)
바뀐 부분: `git -C /Users/kc/projects/any-slide/.claude/worktrees/round2 diff main round2`

## 이번에 바뀐 것 (사용자가 승인한 2차 수정 5건)

1. 스티커 패널 여백, [기본] 8개 / [추가] 탭 (`STICKERS`의 `group`)
2. 형태의 모든 그림·글상자를 개체로: `deck-spec.js`의 `TYPES[*].objects`, `expandObjects`, `placedObjects`, 장마다 `slide.layout[id] = { x, y, w, h, rot, hidden }`. 카드·단계·비교 상자·말풍선·코드 상자는 바탕과 글자를 한 개체로 묶음 (`cardInner`, `bubbleInner`, `codeInner`)
3. 표 머리 줄·상자 제목 가운데, 내용은 `autoAlign`으로 자동 정렬 (목록은 왼쪽)
4. 끌기·크기·회전(`startDrag`, `applyGeom`, `commitGeom`)과 보조선 맞춤(`snapTargets`, `nearest`), ⌥(Alt)로 끄기 안내
5. 메뉴 오른쪽 [Any-Slide] 버튼과 버전 팝업 (`APP_VERSION`)

## 지시 사항 (검토만 한다)

**소스 파일을 고치지 않는다.** 의견과 수정 제안만 보고서에 적는다.
**Chrome은 실행하지 않는다** (지난번에 이 환경에서 Chrome이 비정상 종료 알림을 반복했다). 코드 읽기와 Node 격리 실행으로만 확인한다.

중점적으로 볼 것:
- 개체 배치: 회전한 개체의 크기 조절 계산, 맞춤 계산, 화면 밖으로 사라짐, 묶음 개체를 크기 조절 중 다시 그릴 때(`makeObjNode`) 포인터 처리와 선택 상태
- `sanitize`의 `layout` 검증(허용 id, 범위), 예전 덱 호환, 형태를 바꾸거나 카드 개수를 바꿀 때 `layout`
- 글자 편집과 개체 끌기의 충돌: 글자를 누르면 편집, 테두리(`.eg`)·손잡이(`.h`)를 누르면 끌기. 표 칸, 카드 안 글자, 회전한 글상자 안에서의 편집
- 자동 정렬과 사용자가 정한 정렬의 우선순위, 입력 중 정렬이 바뀌는 경우
- 키보드: 개체 선택 중 화살표·Delete와 글자 편집·버튼 포커스의 충돌
- 검사 스크립트(`check-deck.mjs`)가 `layout`을 반영하는지

## 보고서

`/Users/kc/projects/any-slide/.claude/worktrees/round2/docs/codex결과_2차수정검토.md`에 저장한다.

- **요약**: 3~5줄
- **문제 목록**: 심각도(높음/중간/낮음), 파일과 줄 번호, 증상, 근거([실행 확인 — 격리]/[정적 확인]/[추정]), 수정 제안
- **의견**: 우선순위 순서
