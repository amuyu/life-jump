# Life Jump 모바일 터치 조작 리서치·설계

작성일: 2026-08-16

## 1. 결론

Life Jump의 기본 모바일 조작은 **왼쪽 엄지의 2분할 방향 패드 + 오른쪽 엄지의 큰 점프 버튼**으로 한다.

- 왼쪽 패드의 왼쪽/오른쪽을 누르는 동안 각각 `left`/`right`가 켜진다.
- 누른 채 패드 안에서 손가락을 미끄러뜨리면 손을 떼지 않고 반대 방향으로 바뀐다.
- 오른쪽 점프 버튼의 `pointerdown`은 `jumpPressed + jumpHeld`, `pointerup`은 `jumpHeld=false`로 변환한다.
- 방향과 점프는 서로 다른 pointer를 추적해 동시에 입력할 수 있게 한다.
- 키보드 조작은 데스크톱·접근성·개발 테스트용으로 그대로 유지한다.

이 안은 기존 물리와 1:1로 대응한다. 특히 이 게임의 핵심 판단인 **짧게 눌러 낮게 점프 / 길게 눌러 높게 점프**를 보존하면서, 가로 이동 중 점프도 가능하다.

## 2. 현재 게임에서 보존해야 할 조작 의미

현재 입력 상태는 `left`, `right`, `jumpPressed`, `jumpHeld` 네 값이다.

| 키보드 | 게임 의미 | 터치 대응 |
|---|---|---|
| `←` / `A` keydown~keyup | 누르는 동안 왼쪽으로 등속 이동 | 왼쪽 패드의 왼쪽 영역을 누르는 동안 |
| `→` / `D` keydown~keyup | 누르는 동안 오른쪽으로 등속 이동 | 왼쪽 패드의 오른쪽 영역을 누르는 동안 |
| `↑` / `W` / `Space` keydown edge | 지상 점프 또는 더블 점프 1회 발동 | 점프 버튼을 새로 누른 순간 |
| 점프키 hold | 최대 높이까지 상승 | 점프 버튼을 계속 누름 |
| 점프키 keyup | 상승 속도를 잘라 낮은 점프 | 점프 버튼에서 손을 뗌 |

방향은 아날로그 세기가 필요 없다. 현재 물리는 `-1 / 0 / +1`만 사용해 항상 같은 속도로 움직인다. 따라서 원형 가상 조이스틱은 보이는 것보다 얻는 것이 없고, 대각선·데드존·손가락 중심 이탈이라는 새 실패 요인만 만든다. **두 개의 큰 디지털 영역**이 이 게임에는 더 정확하다.

## 3. 권장 레이아웃

세로 화면, 양손 플레이를 기본으로 한다.

```text
┌──────────────────────────┐
│                    ⋯  X  │  Toss navigation safe area
│  높이 / 에너지 / 재화     │
│                          │
│        게임 화면          │
│                          │
│                          │
│                          │
│ ┌────────────┐  ┌──────┐ │
│ │   ◀  │  ▶   │  │  ↑   │ │
│ └────────────┘  │ JUMP │ │
│                  └──────┘ │
└──────────────────────────┘
    왼쪽 엄지         오른쪽 엄지
```

### 크기와 위치

- 컨트롤은 `position: fixed`인 별도 DOM overlay로 둔다. Canvas 좌표로 버튼을 그리지 않는다.
- 방향 패드: 화면 왼쪽 아래, 너비 `clamp(144px, 42vw, 190px)`, 높이 88px.
- 점프 버튼: 화면 오른쪽 아래, 최소 88×88px. 원형으로 보이더라도 실제 hit area는 96×104px 이상의 사각형으로 넓힌다.
- 화면 좌우 여백 16px, 아래쪽은 `safeArea.bottom + 12px` 이상 띄운다.
- Toss의 `safeArea`가 알려 주는 프레임워크 X 버튼 영역과 HUD/일시정지 버튼이 겹치지 않게 한다.
- 컨트롤의 시각 불투명도는 평상시 0.42~0.55, 누르는 동안 0.75 정도로 올린다. hit area 자체는 투명 영역까지 포함한다.
- 캐릭터와 다음 착지 발판을 손가락이 가리지 않도록 컨트롤 중심은 화면 하단 22% 안에 둔다.

현재 180×320 Canvas를 정수 배율로 화면 중앙에 맞추는 방식은 짧은 모바일 화면에서 컨트롤 공간을 따로 확보하기 어렵다. 1차 구현에서는 게임 장면을 그대로 유지하고 컨트롤을 하단에 겹치되, **캐릭터가 위치하는 논리 화면 하단 80px에 컨트롤을 올리지 않도록** 좌우 바깥 레터박스 공간을 우선 사용한다. 실기기에서 가림이 크면 2차로 모바일 전용 카메라 safe viewport(하단 64~80 CSS px)를 도입한다. 픽셀아트 정수 배율을 깨는 임의 축소는 마지막 선택지다.

## 4. 상세 인터랙션 규칙

### 방향 패드

1. `pointerdown` 위치가 왼쪽 절반이면 `left=true`, 오른쪽 절반이면 `right=true`.
2. 같은 pointer가 패드 안에서 이동하면 현재 x 위치로 방향을 즉시 다시 판정한다.
3. 중앙 경계에는 총 16px의 중립 띠를 둔다. 중립 띠에서는 둘 다 false다.
4. 손가락이 위아래로 패드 밖을 24px까지 벗어나도 입력을 유지한다. 엄지의 자연스러운 호 이동을 허용하기 위해서다.
5. `setPointerCapture(pointerId)`를 사용해 패드 밖 이동과 release도 받는다.
6. `pointerup`, `pointercancel`, `lostpointercapture`, 화면 숨김, 퀴즈 열림 중 하나라도 발생하면 그 pointer의 방향을 해제한다.
7. 두 방향이 동시에 참이 되는 상태는 만들지 않는다. 키보드와 터치가 동시에 들어오면 마지막으로 활성화된 장치가 아니라 **소스별 상태를 OR한 뒤 반대 방향 동시 입력은 0**으로 해석한다.

### 점프 버튼

1. 새 `pointerdown`에서 그 틱에만 `jumpPressed=true`, 누르는 동안 `jumpHeld=true`.
2. `pointerup/cancel`에서 즉시 `jumpHeld=false`. 이것이 가변 점프 cutoff를 발동한다.
3. 버튼을 누른 채 밖으로 미끄러져도 hold는 유지한다. 손을 떼는 행위만 release로 본다.
4. 이미 잡고 있는 점프 pointer가 있으면 추가 pointerdown은 무시한다. 멀티터치 중복 점프를 막는다.
5. 퀴즈 모달이 뜨면 모든 게임 pointer를 reset한다. 모달을 닫을 때도 reset하여 보상 버튼을 누른 손가락이 점프로 이어지지 않게 한다.
6. 더블 점프가 활성화된 판에서는 두 번째로 **새로 누른** 동작만 더블 점프가 된다. 계속 누르고 있는 손가락으로 자동 발동하지 않는다.

### 브라우저 기본 동작 차단

- 게임 중인 overlay에만 `touch-action: none`, `user-select: none`, `-webkit-user-select: none`을 적용한다.
- 로비·상점·옷장·기록·퀴즈에는 전역 `preventDefault`를 적용하지 않는다. 이 화면들은 정상 세로 스크롤과 버튼 접근성이 필요하다.
- Pointer Events를 우선 사용한다. touch/mouse를 별도 구현하면 중복 synthetic click과 상태 불일치가 생기기 쉽다.
- `contextmenu`는 게임 컨트롤 영역에서만 막는다.

## 5. 피드백과 학습

첫 판 시작 전 2단계, 총 3초 이내의 인게임 코치마크를 보여 준다.

1. 방향 패드를 맥동시키며 “왼쪽 엄지로 움직여요”. 사용자가 어느 방향이든 누르면 즉시 다음 단계.
2. 점프 버튼을 맥동시키며 “짧게 톡, 길게 꾹”. 실제 점프가 발생하면 안내 종료.

로비 문구는 모바일에서 `왼쪽 버튼으로 이동 · 점프는 짧게 톡, 높이 가려면 길게 꾹`으로 바꾼다. 키보드가 감지된 환경에서는 기존 키 안내를 보여 준다.

시각 피드백:

- 누른 방향 영역을 채우고 화살표를 2px 이동시킨다.
- 점프 버튼 hold 중 바깥 고리가 0.35초에 걸쳐 차오르게 해 “길게 누르면 높다”를 설명한다. 실제 물리 수치를 바꾸지는 않는다.
- 가능하면 짧은 햅틱은 **점프가 실제 발동한 순간**과 **퀴즈 정답**에만 사용한다. 매 방향 입력마다 진동시키지 않는다. SDK/기기 지원이 없으면 조용히 생략한다.

## 6. 검토한 대안

| 안 | 장점 | 이 게임에서의 문제 | 결정 |
|---|---|---|---|
| 화면 왼쪽/오른쪽 절반 탭 | UI가 거의 안 보임 | 점프를 별도 표현할 수 없고 이동+점프 동시 입력이 어려움 | 제외 |
| 스와이프 위로 점프 | 익숙하고 화면이 깨끗함 | hold 길이를 안정적으로 보존하기 어렵고 연속 점프 시 피로함 | 제외 |
| 기울여 좌우 + 탭 점프 | 한 손 가능 | 자세·환경 영향, 정밀 착지와 접근성이 나쁨, 권한/센서 편차 | 기본값 제외 |
| 원형 가상 조이스틱 + 점프 | 장르 관습과 친숙함 | 이 게임은 수평 digital input뿐이라 불필요한 자유도와 데드존이 생김 | 제외 |
| 좌/우 버튼 + 점프 버튼 | 기존 물리와 정확히 대응, 발견성 높음 | 화면 일부를 차지하고 양손이 가장 편함 | **채택** |
| 자동 점프 + 좌/우만 | 한 손으로 쉬움 | 수동 점프와 가변 높이라는 현재 핵심 게임성이 사라짐 | 접근성 옵션 후보 |

## 7. Toss 출시 관점의 필수 대응

앱인토스 공식 가이드 기준으로 게임 미니앱은 풀스크린이어야 하며, 시스템 UI에 가리지 않도록 Safe Area를 반영해야 한다. 특히 프레임워크 X 버튼과 게임 버튼이 겹치면 검수에서 반려될 수 있다.

현재 코드에서 모바일 조작과 별도로 필요한 항목:

- `body`와 게임 레이어에 `100dvh`를 사용하고 배경까지 화면 전체를 채운다.
- `window.innerHeight`만 믿지 말고 Apps in Toss safe-area 값을 CSS 변수로 전달한다.
- Canvas만 가운데 떠 있는 현재 화면도 배경이 화면 전체를 채우므로 형식상 full-screen은 가능하지만, 실제 검수 전 여러 화면비에서 콘텐츠가 지나치게 작지 않은지 확인한다.
- 토스 내비게이션 `⋯ / X` 아래에는 HUD 버튼을 배치하지 않는다.
- 최초 화면은 10초 안에 표시되어야 한다. 터치 컨트롤은 외부 이미지나 추가 로딩 없이 CSS/DOM으로 만든다.

참고 자료:

- [앱인토스 게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-game.html)
- [앱인토스 해상도 가이드](https://developers-apps-in-toss.toss.im/design/resolution.html)
- [앱인토스 Safe Area](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/safe-area.html)
- [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action)
- [Apple Human Interface Guidelines — Game controls](https://developer.apple.com/design/human-interface-guidelines/game-controls)
- [Touch key size/location 연구](https://doi.org/10.1016/j.cie.2014.11.017): 작은 화면에서는 버튼 수를 줄이고 충분한 터치 크기·간격을 두어야 하며 flick와 multi-touch가 유효하다고 보고한다.

## 8. 구현 구조

키보드 이벤트를 가짜로 발생시키지 말고 입력 소스를 분리한 뒤 하나의 snapshot으로 합친다.

```ts
interface InputSourceState {
  left: boolean
  right: boolean
  jumpHeld: boolean
  jumpPressed: boolean
}

keyboardState + touchState -> merged InputState -> stepGame()
```

권장 파일 책임:

- `src/core/input.ts`: 키보드/터치 소스 상태 병합, reset, edge consume 규약
- `src/ui/touchControls.ts`: DOM 생성, pointer capture, hit testing, teardown
- `src/ui/styles.css`: safe area와 컨트롤 배치, active 상태
- `src/main.ts`: run 시작 시 mount, 퀴즈/결과/로비 진입 시 reset 또는 unmount

`jumpPressed`는 어떤 소스에서든 한 번 발생하면 다음 physics step까지 유지하고 `consume()`에서 모든 소스의 edge를 함께 지운다. 입력 이벤트와 60Hz physics step 사이에 아주 짧은 탭이 down/up 모두 끝나도 점프 edge가 유실되지 않아야 한다.

## 9. 테스트와 합격 기준

### 자동 테스트

- 방향 패드 왼쪽 down → `left=true`; 중앙으로 move → 둘 다 false; 오른쪽 move → `right=true`.
- 방향 pointer를 유지한 채 jump pointer down → 방향+`jumpPressed`+`jumpHeld` 동시 참.
- jump down/up이 physics step 사이에 모두 발생해도 `jumpPressed`가 한 번 소비됨.
- jump hold 후 release → `jumpHeld=false`이고 기존 최소 점프 높이 범위가 유지됨.
- `pointercancel`, visibility change, 퀴즈 open/close 후 모든 held 상태가 false.
- 컨트롤 DOM을 여러 판 mount/unmount해도 listener가 중복되지 않음.
- 터치와 키보드가 동시에 반대 방향이면 수평 속도 0.

### 실기기 플레이 테스트

최소 iPhone 소형/대형 각 1종, Android 소형/대형 각 1종에서 10분씩 확인한다.

- 30초 안에 설명 없이 이동과 높낮이 점프를 수행한다.
- 이동 중 점프 20회에서 입력 누락 0회.
- 왼쪽↔오른쪽 슬라이드 전환 20회에서 의도 반대 이동 1회 이하.
- 짧은 점프와 긴 점프를 각 10회 시도해 높이 차이를 사용자가 분명히 재현한다.
- 퀴즈를 연 직후와 닫은 직후 유령 점프 0회.
- 시스템 X, 홈 인디케이터, 노치와 컨트롤/HUD 겹침 0건.
- 컨트롤 때문에 캐릭터 또는 다음 목표 발판을 1초 이상 완전히 가리는 상황 0건.

### 계측 권장

개인정보 없이 판 단위로 `touch_direction_changes`, `jump_press_duration` 구간(0~120/121~300/301ms+), `pointer_cancel_count`, 첫 30초 낙하 수를 집계한다. 첫 3판에서 짧은 점프가 거의 없거나 cancel 비율이 높다면 버튼 설명과 hit area를 먼저 조정하고 물리 난이도는 나중에 조정한다.

## 10. 구현 우선순위

1. Pointer Events 기반 3영역 컨트롤과 멀티터치 입력 병합
2. reset/cancel/퀴즈 전환 안정성 테스트
3. Safe Area 및 `100dvh` 풀스크린 배치
4. 모바일 코치마크와 동적 로비 안내
5. 4종 실기기 플레이테스트 후 hit area·중립 띠 조정
6. 필요할 때만 햅틱 및 한 손용 자동 점프 옵션 검토

