# 특강 덱용 그림 생성 결과

작업일: 2026-10-21

`docs/codex요청_특강그림.md`와 `docs/핵심브리프_스티커에셋.md`를 끝까지 읽고, 브리프 4번 프롬프트 블록을 맨 앞에 사용했습니다. 내장 이미지 생성 기능(image_gen)으로 그림을 각각 생성했으며 SVG나 코드로 그림을 그리지 않았습니다. 각 최초 생성에 지정 참고 이미지 2개(소품 7종 일렬 이미지, 기존 별 스티커)를 첨부했습니다.

## 저장 파일

- [sticker_API점원.png](../app/assets/generated/sticker_API점원.png) — **1254×1254px**, PNG **RGBA**, **투명 배경**(알파 0–255). 여백(왼쪽/위/오른쪽/아래): 239 / 127 / 239 / 127px.
  - 기존 로봇의 회백색 얼굴·남색 화면·노란 눈·주황 미소·분홍 귀·주황 안테나를 유지한 점원. 양손으로 쟁반을 내밀며, 둥근 접시 위에 파랑·노랑/주황·초록의 데이터 블록 3개가 있습니다. 약간 비스듬한 정면이며 피사체 폭 776px·높이 1000px의 세로로 긴 구도입니다.
- [sticker_여행.png](../app/assets/generated/sticker_여행.png) — **1254×1254px**, PNG **RGBA**, **투명 배경**(알파 0–255). 여백(왼쪽/위/오른쪽/아래): 127 / 210 / 127 / 211px.
  - 파란 접이식 점토 지도 위에 빨간 위치 핀 1개, 옆에 주황색 둥근 가방 1개를 한 묶음으로 배치했습니다.

## 브리프 7번 체크리스트

- [x] 두 그림 모두 둥글고 통통한 점토 형태와 손자국 질감을 유지합니다. 기존 소품·별 스티커와 함께 보았을 때 어울리는 색과 재질입니다.
- [x] 바닥 그림자·드롭 섀도 없이 객체 자체의 입체 음영만 있습니다.
- [x] 실제 알파 채널이 있는 투명 PNG이며 흰 다이컷 테두리를 보존했습니다. 색 배경 합성으로 가장자리를 직접 검수했습니다.
- [x] 최종 저장본에 글자·숫자·로고·워터마크가 보이지 않습니다.
- [x] API 점원은 참고 로봇의 얼굴과 색상 특징을 확인했습니다. 사람 캐릭터의 머리·볼·체크 셔츠 일치 항목은 두 그림 모두 해당 없음입니다.
- [x] 전부 1254×1254이고 피사체가 잘리지 않았으며 중앙 배치와 사방 여백이 있습니다.

## 보정 및 어긋난 점

최초 생성본은 이미 1254×1254 RGBA였지만 투명 배경 경계에 흰 잔여 픽셀이 있고 일부 여백이 좁았습니다. 브리프에 따라 가장자리·여백만 수정하도록 이미지 생성 기능에 추가 요청했습니다. 추가 결과에도 잔여 픽셀이 남아 최종본으로 채택하지 않았습니다.

구성이 정확한 최초 생성본을 선택해 요청서가 허용한 Pillow 배경 정리를 적용했습니다. 알파 경계의 작은 잔여물을 제거하고 가장자리를 부드럽게 정리했으며, 흰 테두리는 보존했습니다. 피사체는 비율을 유지해 투명 캔버스 중앙에 배치했습니다. 그림 내용이나 소품을 코드로 새로 그리지는 않았습니다.

최종본에서 남은 명확한 체크리스트 위반은 발견하지 못했습니다. 생성 이미지이므로 참고 소품과 점토 손자국의 세부 패턴까지 동일하지는 않습니다. 기존 파일은 덮어쓰지 않았고 앱 소스·덱·허용 에셋 목록은 수정하지 않았습니다.

## 최종 채택본의 생성 프롬프트

### sticker_API점원.png

```text
Create a sticker-style asset in handmade claymorphism (plasticine / modeling clay) 3D style.
Subject: the exact friendly clay robot from the attached horizontal prop lineup acting as a waiter: off-white rounded square head, navy screen with two yellow eyes and an orange smile, pink side ears, orange-tipped antennas; a simple matching off-white clay torso and two chunky arms, holding out a food serving tray with BOTH hands. On the tray is one rounded clay plate and a small data package represented by a few colored chunky blocks. Front view at a slight three-quarter angle, compact slightly taller-than-wide composition, centered in a square canvas with comfortable margin, suitable for a 760x640 slide image slot

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
References: image 1 is the ROBOT IDENTITY and prop palette reference; image 2 is the clay material and clean white die-cut border reference. Generate only this robot waiter and held tray, not the other reference props, no human character. Keep both hands clearly supporting the tray. Absolutely no text, including no API or AI labels. Thin clean continuous white sticker rim, no stray speckles outside the silhouette, no cast shadow.
```

### sticker_여행.png

```text
Create a sticker-style asset in handmade claymorphism (plasticine / modeling clay) 3D style.
Subject: a single travel-themed clay sticker cluster: a blue clay folded map with ONE red location pin on it, and ONE orange rounded clay suitcase beside the map. The three elements form one cohesive compact cluster, shown at a gentle three-quarter angle, centered in a square with comfortable margins. The map has simple raised pale blue route shapes but absolutely no lettering, numbers or labels. The suitcase has a chunky rounded handle and softly rounded corners, with no logo

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
References: image 1 is the prop set palette and modeling-clay reference; image 2 is the clay texture and clean white die-cut border reference. Only the blue map, one red pin and orange suitcase; no robot, no human, no star, no extra objects. Matte clay with subtle fingerprints. A thin clean white die-cut rim around the cluster, no stray background pixels, no floor shadow or drop shadow.
```
