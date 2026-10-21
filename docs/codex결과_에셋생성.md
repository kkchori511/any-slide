# 스티커 에셋 생성 결과

작업일: 2026-10-21

요청서 `docs/codex요청_에셋생성.md`와 `docs/핵심브리프_스티커에셋.md`를 끝까지 읽고 수행했습니다. 내장 이미지 생성 기능(image_gen)을 사용했으며, 각 생성 호출에 지정된 참고 이미지 2개를 첨부했습니다. SVG나 코드로 소품을 그리지 않았습니다.

## 생성 파일

저장 폴더: `app/assets/generated/`

- `sticker_반짝이.png` — 1254×1254 px, PNG RGBA, 투명 배경(알파 0–255).
- `sticker_별.png` — 1254×1254 px, PNG RGBA, 투명 배경(알파 0–255).
- `sticker_체크.png` — 1254×1254 px, PNG RGBA, 투명 배경(알파 0–255).
- `sticker_화살표.png` — 1254×1254 px, PNG RGBA, 투명 배경(알파 0–255).
- `sticker_하트.png` — 1254×1254 px, PNG RGBA, 투명 배경(알파 0–255).
- `sticker_말풍선.png` — 1254×1254 px, PNG RGBA, 투명 배경(알파 0–255).

## 품질 확인

- [x] 참고 이미지와 어울리는 둥글고 통통한 점토 형태, 무광 표면과 손자국 질감 확인.
- [x] 바닥 그림자·드롭 섀도 없음. 객체 자체의 입체 음영만 유지.
- [x] 투명 배경과 흰 다이컷 테두리 확인. 색 배경에 합성하여 가장자리도 확인.
- [x] 의도하지 않은 글자·숫자·로고·워터마크 없음.
- [x] 캐릭터 없음. 캐릭터의 머리·눈·볼·셔츠 일치 항목은 해당 없음.
- [x] 전부 1254×1254이며 피사체 잘림 없음. 중앙 배치와 사방 여백 확보.
- [x] 반짝이는 큰 4갈래 1개와 작은 4갈래 1개, 별은 얼굴 없는 노란 별, 체크는 초록색, 화살표는 파란색 오른쪽 방향, 하트는 분홍빛 빨강, 말풍선은 글자 없이 왼쪽 아래 꼬리.

## 수정 내역과 한계

첫 별 결과에는 요청하지 않은 얼굴이 생겨 얼굴 없는 별로 재생성했고, 최종 파일에는 얼굴이 없습니다. 생성 PNG는 처음부터 1254×1254 RGBA였으나 흰 테두리 밖에 잔여 픽셀이 있어, 요청서에서 허용한 Pillow 후처리로 알파 가장자리를 정리했습니다. 흰 테두리를 보존하고 피사체를 비율 유지 축소·중앙 배치했습니다. 최종 알파 경계 기준 최소 여백은 모든 파일에서 127 px 이상입니다. 기존 에셋 파일은 덮어쓰지 않았습니다.

최종 검수에서 남은 명확한 체크리스트 위반은 발견하지 못했습니다. 점토 손자국의 강도는 참고 소품보다 일부 더 뚜렷하며, 생성 이미지 특성상 표면 질감이 완전히 동일하지는 않습니다.

## 사용한 최종 프롬프트

아래 공통 블록을 각 요청 맨 앞에 그대로 사용하고, `[대상]`을 표의 Subject로 교체했습니다.

```text
Create a sticker-style asset in handmade claymorphism (plasticine / modeling clay) 3D style.
Subject: [대상]

Style rules:
- Soft rounded chunky shapes, no sharp edges, visible subtle fingerprint texture on the clay.
- Soft studio lighting, gentle highlights, no metallic or glossy reflections.
- NO drop shadow, NO floor shadow.
- Thin white die-cut sticker outline around the subject. No black outlines.
- Transparent background (PNG with alpha). Do not add any paper texture or background color.
- NO text, NO letters, NO numbers, NO logos, NO watermarks
  (only symbolic marks that are part of the object, e.g. pi, sigma).
- Pastel-leaning but vivid colors that match the reference palette.
- Output size 1254x1254, subject centered with comfortable margin.

Reference images: use the attached character and prop images for style and proportions.
```

| 파일 | Subject |
| --- | --- |
| `sticker_반짝이.png` | one yellow four-point sparkle and one smaller yellow sparkle beside it, forming a single centered sticker composition |
| `sticker_별.png` | one plump chunky yellow five-point star with soft rounded tips |
| `sticker_체크.png` | one thick green check mark, chunky and rounded |
| `sticker_화살표.png` | one blue rounded chunky arrow pointing to the RIGHT |
| `sticker_하트.png` | one plump pinkish-red heart |
| `sticker_말풍선.png` | one empty white clay speech bubble, with its tail pointing toward the lower LEFT, no writing or marks inside |

각 파일별 공통 블록 뒤에 붙인 추가 지시(최종 생성 기준):

### sticker_반짝이.png

```text
Use both input images ONLY as style reference. Generate ONLY the requested prop(s), NO character, NO other reference objects. Front-facing, tactile matte clay; thin white rim clearly visible against transparency.
```

### sticker_별.png

```text
Use the two inputs only for CLAY MATERIAL reference. ONLY a plain five-point yellow star, NO FACE, NO eyes, NO mouth, NO cheeks, NO character features, no added objects. Front view. Keep clay texture subtle. The thin white die-cut rim must be SMOOTH and CLEAN with NO ragged white pixels or speckles outside it. Generous margin.
```

### sticker_체크.png

```text
Use both input images ONLY as style reference. Generate ONLY the requested prop, NO character, NO other reference objects. Front-facing tactile matte clay with thin white rim.
```

### sticker_화살표.png

```text
Use both input images ONLY as style reference. Generate ONLY the requested prop, NO character, NO other reference objects. Front-facing tactile matte clay with thin white rim.
```

### sticker_하트.png

```text
Use both input images ONLY as style reference. Generate ONLY the requested prop, NO character, NO other reference objects. Front-facing tactile matte clay with thin white rim.
```

### sticker_말풍선.png

```text
Use both input images ONLY as style reference. Generate ONLY the requested prop, NO character, NO other reference objects. Front-facing tactile matte white clay with thin white rim. Bubble must be completely blank, NOT three dots; tail points lower LEFT.
```
