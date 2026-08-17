# Life Jump — 터치 조작 설계

작성일: 2026-08-17
상위 문서: `2026-08-15-life-jump-design.md` (본 문서는 그 비목표 "모바일 터치 조작"을 해제한다)

## 1. 개요

앱인토스 출시를 위해 모바일 WebView에서 손가락만으로 플레이할 수 있어야 한다.
이 게임의 입력은 `left / right / jumpHeld / jumpPressed` 네 개의 불리언이며 물리는
방향 `-1/0/1` × 고정 속도로 움직인다 — 아날로그가 없다. 점프는 **누름 엣지**로 발동하고
**누르고 있는 동안** 높아지며(상승 중 떼면 `vy`를 컷오프), 더블점프는 공중에서 한 번 더
엣지다. 따라서 터치는 "세 개의 디지털 버튼(◀ ▶ ●)을 손가락으로 어떻게 대체하느냐"의
문제이고, 스와이프처럼 한 번 튕기는 제스처는 가변 점프·더블점프와 맞지 않는다.

### 핵심 결정

| 항목 | 결정 |
|---|---|
| 플레이 자세 | 양손 엄지. 왼쪽 절반 = 이동, 오른쪽 절반 = 점프 |
| 이동 판정 | 터치 시작점 기준 상대 조이스틱 (데드존 + 따라오는 중심) |
| 점프 판정 | 홀드 버튼 — down = 엣지 + held, up = held 해제 |
| 판정 영역 | 화면 절반 전체(캔버스 밖 여백 포함). 그림은 힌트일 뿐 |
| 가시성 | 왼쪽 하단 슬라이더 트랙 `◀ ─●─ ▶`, 오른쪽 하단 ● 글리프를 DOM 오버레이로 상시 표시(터치 기기). 버튼처럼 보이지 않게 — 판정이 "밀기"이므로 그림도 "밀기"여야 한다 |
| 입력 소스 | 키보드·터치 상시 병존, 소스별 상태를 OR. 모드 선택 없음 |
| `game/` 계층 | 변경 없음 — `InputState` 그대로 |

### 비목표

- 틸트(가속도계) 조작 — iOS 권한 프롬프트, WebView 지원 불명, 디지털 이동에 매핑이 나쁨
- 한 손 플레이 모드, 왼손 미러, 버튼 위치 커스텀
- 오버레이 표시/숨김 수동 토글
- 캔버스 배치 변경(정수 배율·중앙 정렬은 그대로), granite/토스 빌드 전환(별도 작업)
- Android 하드웨어 뒤로가기 처리

## 2. 아키텍처

`game/` 계층은 한 줄도 바뀌지 않는다. 바뀌는 것은 입력 *생산* 쪽(`core/input.ts`),
새 터치 컨트롤러, 오버레이 UI, `main.ts` 배선이다.

```
src/core/input.ts        InputState / Input 인터페이스 유지.
                         소스별 상태 + 액션 단위 API 추가: press(action, source) / release(action, source)
                           action = 'left' | 'right' | 'jump',  source = 'keyboard' | 'touch'
                         스냅샷은 두 소스의 OR. handleKeyDown/Up 은 키코드 → 액션 매핑 후
                         press/release(…, 'keyboard') 를 부르는 얇은 층.
                         jumpBlocked 는 키보드 소스에만 존재한다 (키 반복 keydown 문제는 키보드 고유).

src/core/touch.ts  (신규) 터치 컨트롤러. Pointer Events → 존/조이스틱 판정 → input.press/release(…, 'touch').
                         전달받은 element 하나에 attach → detach 함수를 돌려준다.
                         pointerId 별 상태를 들고 있다가 up/cancel 에서 자기 액션만 해제.
                         reset() 은 포인터를 suppressed 로 표시하고 액션을 해제한다 (모달용).
                         clear() 는 포인터 목록을 비우고 액션을 해제한다 (수명 종료용 — attach/detach 가 부른다).
                         DOM 의존은 전달받은 element 뿐 (document/window 직접 참조 없음).

src/ui/touchOverlay.ts (신규) 슬라이더 트랙 + ● 글리프 + 조이스틱 인디케이터 + 첫 판 안내. 순수 DOM.
                         touch.ts 가 발행하는 스냅샷을 받아 그리기만 한다. save 를 모른다 —
                         안내 완료는 onHintDone 콜백으로 알린다. { dismissHint, unmount } 를 돌려준다.

src/toss/sdk.ts    (신규) SDK 를 import 하는 유일한 지점 — 정적 리터럴 dynamic import (7.2).
src/toss/sdk-stub.ts / sdk-ambient.d.ts  미설치 환경용 빈 스텁(vite alias) 과 tsc 용 ambient 선언.
src/toss/screen.ts (신규) setIosSwipeGestureEnabled 래퍼. isSupported 가드, 호출 직렬화,
                         적용값 기준 중복 스킵, 실패는 삼킨다. 브라우저에서는 no-op.

src/main.ts              startRun: detachTouch = touch.attach(gameLayer), overlay 마운트, 스와이프백 off.
                         판 종료·로비 복귀: detachTouch(), overlay 제거, 스와이프백 on.
                         퀴즈 종료: input.reset() + touch.reset() (순서 무관 — 3절, 4.6절).
                         visibilitychange 복귀: input.reset() + touch.clear() (OS 가 터치를 가져갔다).
                         startRun 은 attach 가 clear 하므로 추가 호출 없음.
```

**멀티 소스** — 키보드와 터치(마우스 포함)는 각자 상태를 가지며 스냅샷에서 OR 된다.
키보드 ←를 누른 채 마우스로 이동 존을 눌렀다 떼도 ←는 살아 있다. 마우스도 Pointer Events 로
들어오므로 데스크탑에서 흔히 일어나는 조합이다. 좌우가 동시에 참이면 물리가 이미 방향을 0 으로 만든다.

**계층 경계** — `touch.ts`, `touchOverlay.ts`, `toss/screen.ts` 모두 `game/` 밖이다.
`tests/architecture.test.ts` 는 변경 없이 그대로 통과해야 한다.

## 3. `core/input.ts` 변경

```ts
export type InputAction = 'left' | 'right' | 'jump'
export type InputSource = 'keyboard' | 'touch'

export interface Input {
  snapshot(): InputState
  consume(): void
  reset(): void
  /** 소스별 액션 진입점 — 키보드는 'keyboard', 터치 컨트롤러는 'touch' 로 부른다 */
  press(action: InputAction, source: InputSource): void
  release(action: InputAction, source: InputSource): void
  /** 기존 저수준 진입점 — 키코드를 액션으로 바꿔 press/release(…, 'keyboard') 에 위임 */
  handleKeyDown(code: string): void
  handleKeyUp(code: string): void
  attach(target, shouldCapture?): () => void
}
```

내부 상태:

```ts
type SourceState = { left: boolean; right: boolean; jumpHeld: boolean }
const kb: SourceState, touch: SourceState
let jumpPressed = false
let kbJumpBlocked = false      // 키보드 전용 — 키 반복 keydown 이 새 누름과 구분되지 않기 때문
```

- `snapshot()`: `left = kb.left || touch.left`, `right = kb.right || touch.right`,
  `jumpHeld = kb.jumpHeld || touch.jumpHeld`, `jumpPressed` 는 그대로.
- `press('left'|'right', src)` → `src` 의 플래그 true. `release` → false. 다른 소스는 건드리지 않는다.
- `press('jump', src)`:
  - `src === 'keyboard' && kbJumpBlocked` 이면 무시.
  - 합산 `jumpHeld` 가 **false 였다가 true 가 되는 경우에만** `jumpPressed = true` (엣지).
    Space 를 누른 채 마우스로 점프 존을 클릭해도 새 엣지가 아니다.
  - `src.jumpHeld = true`.
- `release('jump', src)`: `src.jumpHeld = false`. `src === 'keyboard'` 이면 `kbJumpBlocked = false`.
- `reset()`:
  - `kbJumpBlocked = kb.jumpHeld` (기존 규약 — 눌려 있던 키는 실제 keyup 까지 죽은 키).
  - `kb`, `touch` 모두 전부 false. `jumpPressed = false`.
  - 터치에는 block 이 없다 — `pointerdown` 은 반복되지 않으므로 4.6 의 suppressed 규칙만으로 충분하다.
    이 덕에 `input.reset()` 과 `touch.reset()` 의 호출 순서는 결과에 영향을 주지 않는다:
    어느 쪽이 먼저든 touch 소스는 전부 false, `kbJumpBlocked` 는 키보드 상태만 본다.
- 키보드 코드 세트(`JUMP_CODES` 등)와 `attach` 의 preventDefault 게이트는 그대로.

## 4. 터치 컨트롤러 (`core/touch.ts`)

### 4.1 인터페이스

```ts
export interface TouchSnapshot {
  moveAnchor: { x: number; y: number } | null   // 이동 존 활성 시 중심 (CSS px)
  movePoint:  { x: number; y: number } | null   // 현재 손가락
  moveDir: -1 | 0 | 1
  jumpActive: boolean
  /** 마지막으로 처리한 포인터의 종류 ('touch' | 'mouse' | 'pen' | null). 오버레이 표시 판단용 */
  lastPointerType: string | null
}

export interface TouchController {
  /** DOM 배선. 반환된 함수가 detach — 호출자(main.ts)가 보관한다. attach·detach 모두 clear() 를 부른다 */
  attach(el: HTMLElement): () => void
  /** 모달용 — 손가락이 아직 화면에 있다. 포인터를 suppressed 로 보존하고 액션만 해제 (4.6) */
  reset(): void
  /** 수명 종료·OS 개입용 — 포인터 목록을 전부 삭제하고 액션 해제 (4.6). 이후 어떤 stale up 도 무시된다 */
  clear(): void
  subscribe(cb: (s: TouchSnapshot) => void): () => void
  /** 테스트용 저수준 진입점 — DOM 없이 가짜 이벤트를 넣는다 */
  handlePointer(e: PointerLike): void
}

export interface PointerLike {
  type: 'down' | 'move' | 'up' | 'cancel'
  pointerId: number
  clientX: number
  clientY: number
  pointerType?: string
}

export function createTouch(input: Input, layout: () => { width: number }): TouchController
```

- `layout()` 은 존 경계 계산용 폭을 돌려준다 — 실제로는 `el.clientWidth`. 테스트에서는 상수.
- `attach` 는 DOM 이벤트를 `PointerLike` 로 바꿔 `handlePointer` 에 넘긴다:
  `pointerdown→'down'`, `pointermove→'move'`, `pointerup→'up'`, `pointercancel→'cancel'`,
  `lostpointercapture→'cancel'`. 마지막 것은 up 뒤에도 한 번 더 오지만 그때는 이미 추적 목록에
  없는 포인터라 무시된다. `handlePointer` 의 타입 집합은 넷뿐이다 — 테스트는 `'cancel'` 로 검증한다.
- `attach` 는 같은 element 에 `touchmove` `{ passive: false }` + `preventDefault()` 도 건다
  (iOS 러버밴드 안전망, 7.1). detach 가 함께 뗀다.

### 4.2 존

- 경계 `W/2`. `clientX < W/2` → 이동 존, 그 외 → 점프 존.
- 존은 **down 시점에 결정**되고 손가락이 경계를 넘어가도 바뀌지 않는다.
- 한 존에 한 포인터. 이미 추적 중인 포인터(활성이든 4.6 의 suppressed 든)가 있는 존에 두 번째 down 이
  오면 무시(추적하지 않음). 그 포인터의 후속 move/up 도 무시된다.

### 4.3 이동 존 — 상대 조이스틱

상수(`touch.ts` 상단, 실기기 튜닝 대상 — 물리 상수와 섞지 않기 위해 `constants.ts` 에 두지 않는다):

```ts
const DEAD = 12     // CSS px. 이 안이면 정지
const FOLLOW = 24   // CSS px. 중심에서 이만큼 넘게 멀어지면 중심이 따라온다. 반드시 DEAD 보다 커야 한다
```

- `down`: `anchor = (clientX, clientY)`, `dir = 0`.
- `move`: `dx = clientX − anchor.x`.
  - `|dx| > FOLLOW` 이면 `anchor.x = clientX − sign(dx) · FOLLOW` (항상 `|dx| ≤ FOLLOW`).
  - `dx >= DEAD` → 1, `dx <= −DEAD` → −1, 아니면 0. (경계 포함 — 경계에 닿는 순간 반응해야
    반전 거리가 정확히 `FOLLOW + DEAD` 가 된다. 엄격 부등호면 36px 에서 중립, 37px 에서 반전.)
  - `dir` 이 바뀔 때만: 이전 dir 의 액션 `release`, 새 dir 의 액션 `press`. 매 move 마다 부르지 않는다.
- `up`/`cancel`: 현재 dir 액션 `release`, 포인터 상태 삭제, `dir = 0`.

**거리 성질** (테스트가 이 수치를 고정한다):
- 한 방향으로 계속 밀면 anchor 가 따라와 `dx = ±FOLLOW` 에 머문다. `FOLLOW > DEAD` 이므로 손가락을
  **멈춰도 방향이 유지**된다. `FOLLOW ≤ DEAD` 로 두면 멈추는 순간 정지해 버린다 — 그래서 하한 제약.
- 반전: anchor 가 `finger − FOLLOW` 에 있는 상태에서 왼쪽 판정(`dx <= −DEAD`)까지 손가락이 가야 하는
  거리는 `FOLLOW + DEAD = 36px`. (24/12 는 시작값. 실기기에서 둔하면 FOLLOW 를 줄인다 — 단 DEAD 초과 유지.)

### 4.4 점프 존 — 홀드 버튼

- `down` → `input.press('jump', 'touch')`. 공중에서 다시 down 이면 두 번째 엣지 → 더블점프. 별도 처리 없음.
- `up`/`cancel` → `input.release('jump', 'touch')`. 가변 점프 컷오프가 여기서 갈린다.

### 4.5 포인터 캡처·취소

- `down` 에서 `el.setPointerCapture(pointerId)` — 손가락이 요소 밖으로 나가도 up 을 받는다.
- `cancel` 은 `up` 과 동일 처리 (4.1 의 매핑으로 `pointercancel`/`lostpointercapture` 둘 다 여기로 온다).
- `pointerType` 을 가리지 않는다 — 마우스도 동작하며 데스크탑 개발 확인에 쓰인다.

### 4.6 reset() 과 clear()

두 함수는 수명이 다르다. **reset 은 손가락이 아직 화면에 있을 때**(퀴즈 모달 열고 닫기),
**clear 는 우리가 더 이상 그 손가락의 up 을 받을 수 없을 때**(판 종료로 detach, 페이지 숨김으로 OS 가
터치를 가져감, 새 판 attach) 부른다. reset 만 있으면 detach 뒤 up 을 영영 못 받는 포인터가 suppressed 로
남아 다음 판의 존을 영구 점유한다.

**clear()**
- 추적 목록을 전부 비우고, 잡고 있던 액션을 전부 `release(…, 'touch')`. `dir = 0`. 스냅샷 발행.
- `attach()` 시작 시와 detach 시 내부에서 호출된다. `visibilitychange` 복귀 시에도 main 이 이걸 부른다(8절).

**reset()**
- 추적 중인 모든 포인터를 **삭제하지 않고 `suppressed = true` 로 표시**하고, 잡고 있던 액션을 전부
  `release(…, 'touch')` 한다. `dir = 0`.
- suppressed 포인터는 존을 계속 점유한다 — 그 손가락이 떠 있는 동안 같은 존의 다른 down 은 4.2 규칙으로
  무시된다. suppressed 포인터의 `move` 는 무시, `up`/`cancel` 은 추적 목록에서 제거만 한다(액션 없음).
- 결과: 퀴즈 모달을 닫을 때 손가락이 아직 점프 존에 눌려 있어도 그 손가락은 죽은 손가락이 되고,
  실제 up 후 다음 down 이 진짜 엣지가 된다. 그동안 두 번째 손가락으로 점프 존을 눌러도 안 먹는다 —
  키보드의 `kbJumpBlocked` 와 같은 체감이지만 메커니즘은 존 점유다.
- `input.reset()` 과의 순서는 무관하다 (3절). 둘 다 터치 소스를 전부 false 로 만들 뿐이다.
- 추적 목록에 없는 pointerId 의 move/up 은 언제나 무시된다.

### 4.7 스냅샷 발행

- 상태가 바뀔 때마다(`down/move/up/cancel/reset/clear`) `subscribe` 콜백에 `TouchSnapshot` 을 준다.
- 매 move 마다 발행하지만 press/release 는 dir 변화 시에만 부른다는 점에 주의(4.3).

## 5. 오버레이 (`ui/touchOverlay.ts`)

### 5.1 구조

- gameLayer 안, 캔버스 위에 겹치는 `div.touch-overlay`. `position: absolute; inset: 0; pointer-events: none`.
  판정은 gameLayer 가 하고 오버레이는 그림만 그린다. z-index 는 캔버스 위, 퀴즈/결과 모달(30) 아래.
- 인터페이스:
  ```ts
  interface TouchOverlayOptions {
    showHint: boolean          // !save.controlsHintSeen
    onHintDone(): void         // 안내가 끝났을 때 딱 한 번 — main 이 save 갱신·저장
    isCoarse?: () => boolean   // 기본 matchMedia('(pointer: coarse)'). 테스트 주입용
  }
  interface MountedTouchOverlay {
    dismissHint(): void        // 멱등 — 여러 번 불려도 타이머·onHintDone 중복 없음
    unmount(): void            // 구독 해제 + DOM 제거 + 남은 타이머 정리. 안내가 진행 중이었으면 onHintDone 은 부르지 않는다
  }
  function mountTouchOverlay(gameLayer: HTMLElement, touch: TouchController, opts: TouchOverlayOptions): MountedTouchOverlay
  ```
- `touch.subscribe` 로 스냅샷을 받아 갱신. `save` 를 직접 읽거나 쓰지 않는다 — 오버레이는 순수 DOM.

### 5.2 상시 글리프

그림은 판정과 같은 동사를 말해야 한다. 이동은 "밀기"이므로 두 개의 버튼(◀ ▶)이 아니라
**하나의 슬라이더 트랙**으로 그린다 — 탭하면 움직일 것처럼 보이면 안 된다.

- 왼쪽 하단: 슬라이더 트랙 `◀ ─●─ ▶` — 가로 96px 트랙(양끝 화살표는 트랙의 일부, 별도 버튼 아님)
  + 가운데 노브 점. 오른쪽 하단: `●` 56px.
- 각 절반 폭의 가운데 정렬. 하단 여백 `max(24px, env(safe-area-inset-bottom) + 12px)`.
- 흰색 + 검은 외곽선(캔버스 색조와 충돌 방지). 색 토큰은 `tokens.css` 것을 쓴다.
- 기본 opacity 0.25. 활성 존은 0.6. 이동 존은 `moveDir` 에 따라 노브가 트랙 안에서 좌/중/우로 옮겨 그린다.

### 5.3 조이스틱 인디케이터

- 이동 존 터치 중에만: `moveAnchor` 위치에 **같은 모양의 슬라이더 트랙**(5.2 와 동일, 불투명도 0.6)을
  띄우고 `movePoint.x − moveAnchor.x` 를 노브 위치로 그린다(±FOLLOW 를 트랙 반폭에 매핑).
  anchor 가 따라오면 트랙도 따라온다. 손을 떼면 즉시 사라진다.
- 하단 상시 트랙과 손가락 위 트랙이 같은 그림이라 "저 그림이 손가락 밑에서 이렇게 움직이는 것"이
  한 번에 읽힌다.
- 구현 주의: "사라진다"는 `hidden` 속성이 아니라 `is-hidden` 클래스로 구현한다. `.touch-track`
  자체가 `display: flex` 작성자 규칙을 갖고 있어 UA 의 `[hidden] { display: none }` 을 specificity 로
  이기므로, `hidden` 속성만으로는 트랙이 안 사라진다.

### 5.4 표시 조건

- `matchMedia('(pointer: coarse)').matches` → 글리프 표시. 아니면 숨김.
- 숨긴 상태에서 `lastPointerType === 'touch'` 인 스냅샷이 오면 그 판 동안 표시(하이브리드 기기).
- 이 판단은 오버레이 안에서만 한다 — 판정(touch.ts)은 기기와 무관하게 항상 동작.
- "숨김"은 상시 글리프뿐 아니라 5.3 의 손가락 위(live) 인디케이터도 포함한다 — fine pointer 기기에서
  마우스로 이동 존을 드래그해도 뜨는 슬라이더가 없어야 한다.

### 5.5 첫 판 안내

- 조건: `save.controlsHintSeen === false`.
- 내용: 화면 중앙 상단 반투명 배지 한 줄.
  - 터치 기기(5.4 기준): "왼쪽 밀어서 이동 · 오른쪽 길게 눌러 점프"
  - 그 외: "← → 이동 · Space 길게 눌러 점프"
  ("탭"이 아니라 "길게"라야 가변 점프를 가르친다.)
- 노출: 판 시작 후 1.5초 표시 → 0.3초 페이드. **어떤 입력이든 들어오면 즉시 페이드.** 감지는 두 갈래:
  - 터치: 오버레이가 자기 구독에서 `moveAnchor !== null || jumpActive` 인 스냅샷을 보면 스스로 dismiss.
    이동 존 down 직후는 `dir = 0` 이라 `InputState` 에는 아무 것도 안 보인다 — 화면을 눌렀는데
    안내가 안 내려가는 구간이 생기므로 스냅샷을 직접 본다.
  - 키보드: main.ts 가 `input.snapshot()` 에서 어느 플래그든 참이 되는 첫 프레임에 `overlay.dismissHint()`.
  두 경로가 겹쳐도 `dismissHint` 가 멱등이라 무해하다.
- `dismissHint()` 규약: 첫 호출에서 1.5초 타이머를 취소하고 페이드를 시작, 페이드 끝에 `onHintDone()` 을
  **한 번** 부른다. 이미 페이드 중/완료면 아무 일도 안 한다. `showHint: false` 로 마운트됐으면 항상 no-op.
- 1.5초가 먼저 지나도 같은 경로(내부에서 `dismissHint()` 호출)로 페이드·`onHintDone`.
- main 은 `onHintDone` 에서 `save.controlsHintSeen = true; persist()`.
- 게임은 안내 중에도 멈추지 않는다 — 첫 발판 위라 위험이 없다.
- 판이 안내 노출 창 도중에 끝나면(`leaveRun` → `unmount()`) `onHintDone` 없이 그냥 폐기된다 —
  `controlsHintSeen` 은 여전히 false 라 다음 판에서 안내가 다시 뜬다. 의도된 동작이다.

## 6. 저장 (`core/storage.ts`)

- `SaveData.controlsHintSeen: boolean` 추가. 기본값 `false`.
- `SAVE_VERSION` 2 → 3. `migrate()` 에 v2→v3 단계 추가 — 순수 추가 필드라 version 만 전진(기존
  v1→v2 와 같은 패턴). 3단계 병합에서 `typeof === 'boolean'` 이 아니면 `false`.

## 7. WebView / CSS / 토스 SDK

### 7.1 CSS (`styles.css`)

```css
body { touch-action: manipulation; }   /* 더블탭 줌 제거. 스크롤·핀치는 그대로 — 로비/상점은 일반 문서다 */
.game-layer {
  touch-action: none;                  /* 판 중: 스크롤·핀치·풀투리프레시 차단 */
  user-select: none; -webkit-user-select: none;
  -webkit-touch-callout: none;         /* 롱프레스 메뉴 */
}
```

- `overscroll-behavior` 는 body 에 두지 않는다 — 로비·상점의 스크롤 감각까지 바꾼다. 판 중에는
  `.game-layer` 가 `touch-action: none` 인 fixed 오버레이라 터치가 body 스크롤로 내려가지 않고,
  iOS 에서 그래도 새는 러버밴드는 4.1 의 `touchmove preventDefault` 가 막는다.
- 캔버스 배치는 변경 없음. 정수 배율로 남는 여백은 존의 일부이므로 오히려 도움이 된다.

### 7.2 iOS 스와이프백 (`toss/screen.ts`)

- `startRun` → `setSwipeBack(false)`, 판 종료·로비 복귀 → `setSwipeBack(true)`.
  왼쪽 엄지가 화면 왼쪽 가장자리에서 시작하는 것을 뒤로가기로 먹지 않게 한다.
- 래퍼 규약:
  - SDK import 는 `src/toss/sdk.ts` 한 곳에서 **정적 리터럴 문자열의 동적 import**로 한다
    (`import('@apps-in-toss/web-framework')`). 문자열을 변수에 두고 `@vite-ignore` 를 붙이면 번들에
    bare specifier 가 그대로 남아 브라우저/WebView 가 런타임에 해석하지 못하므로, 패키지를 설치해도
    영원히 no-op 이 된다. 리터럴이어야 Vite 가 빌드 시 번들링해 설치 후 실제로 살아난다.
  - 미설치 환경(일반 웹 빌드·테스트)에서는 `vite.config.ts` 가 `node_modules` 에 패키지가 없을 때만
    그 specifier 를 빈 스텁(`src/toss/sdk-stub.ts`)으로 alias 한다. 설치하면 alias 가 자동으로 꺼진다 —
    코드 수정 없음. tsc 는 `src/toss/sdk-ambient.d.ts` 의 `declare module` 로 통과시키며, 실제 패키지
    타입이 설치되면 그쪽이 우선한다.
  - `isSupported` 가드, 예외는 삼킨다. 브라우저에서는 no-op.
  - **호출 직렬화** — 내부 promise 체인에 이어 붙여 앞 호출이 끝난 뒤 다음을 보낸다. 네이티브에
    도달하는 순서를 보장해야 하므로 generation token(JS 쪽 상태만 맞춤)이 아니라 직렬화다.
  - 중복 스킵은 **마지막으로 적용된 값(또는 지금 큐에서 적용 중인 값)** 기준이다. 요청 시점에 기록하면
    판 시작의 `set(false)` 가 일시 실패했을 때 그 판 내내 재시도가 막혀 스와이프백이 켜진 채 남는다.
    실패·미지원으로 보내지 못한 값은 기록하지 않아 다음 호출이 다시 시도한다. 연달아 같은 값을 부르면
    큐의 pending 값과 비교해 하나만 보낸다.
- SDK 시그니처(문서 기준): `setIosSwipeGestureEnabled(options: { isEnabled: boolean }): Promise<void>`.
  export 경로는 7.4 선행 확인 항목.

### 7.3 granite (참고, 본 범위 밖)

- `webViewProps: { type: 'game' }`. iOS 에서 상단 내비바가 남으면 `navigationBar: { transparentBackground: true }`.
- SDK 3.x 에서 `webViewProps` → `webView` 로 바뀌고 `type` 이 삭제된다.

### 7.4 선행 확인 작업 (구현 전에 답을 내야 하는 것)

구현 명세가 아니라 **조사 태스크**다. 답이 나오기 전까지 `toss/screen.ts` 는 인터페이스만 두고
본문은 no-op 으로 둘 수 있다 — 나머지 설계는 여기에 의존하지 않는다.

| 항목 | 확인 방법 | 답이 다르면 |
|---|---|---|
| `setIosSwipeGestureEnabled` 가 `@apps-in-toss/web-framework` 에서 export 되는가, 이름·시그니처가 같은가 | 패키지 설치 후 `node_modules/@apps-in-toss/web-framework` 의 d.ts 검색 | 이름만 다르면 래퍼 안에서 매핑. 없으면 7.2 전체를 보류하고 실기기에서 스와이프백 충돌 빈도를 먼저 잰다 |
| 판 중 Android 뒤로가기 버튼의 기본 동작 | 앱인토스 QR 로 실기기 확인 | 미니앱이 바로 닫히면 별도 스펙(비목표 유지, 메모만) |
| Toss WebView 에서 Pointer Events 멀티터치·`setPointerCapture` 가 정상인가 | 실기기 체크리스트(9절) 첫 항목 | 깨지면 `touchstart/move/end` 로 attach 층만 교체 — `handlePointer` 이하 로직은 그대로 |

## 8. `main.ts` 배선

```
모듈 스코프: let detachTouch: (() => void) | null = null, overlay: MountedTouchOverlay | null = null

startRun:
  detachTouch = touch.attach(gameLayer)   (내부에서 clear(); touchmove preventDefault 포함)
  overlay = mountTouchOverlay(gameLayer, touch, {
    showHint: !save.controlsHintSeen,
    onHintDone() { save.controlsHintSeen = true; persist() },
  })
  setSwipeBack(false)
  (기존) loop.reset(); input.reset();   — attach 가 이미 clear 했으므로 touch.reset() 은 불필요

openQuiz 종료 콜백:
  (기존) loop.reset(); input.reset(); → touch.reset() 추가 (순서 무관 — 손가락은 아직 화면에 있다)

visibilitychange (복귀):
  (기존) loop.reset(); input.reset(); → touch.clear() 추가
  reset 이 아니라 clear 인 이유: 페이지가 숨겨진 동안 OS 가 터치를 가져갔다. 추적 중이던 포인터는
  전부 stale 이고 up 이 안 올 수 있다. 늦게 오더라도 목록에 없어 무시된다.

finishRun / goToLobby / enterLoadout:
  detachTouch?.(); detachTouch = null;   (detach 가 내부에서 clear — 눌린 채 끝난 손가락이 다음 판 존을 점유하지 않는다)
  overlay?.unmount(); overlay = null; setSwipeBack(true)
  (결과 모달은 gameLayer 위 z-30 이라 터치가 게임에 닿지 않지만, detach 로 리스너 자체를 뗀다)
  goToLobby/enterLoadout 은 판 중이 아닐 때도 불리므로 null 가드로 멱등하게 둔다.

frame:
  overlay !== null 이고 input.snapshot() 에 참 플래그가 하나라도 있으면 overlay.dismissHint()
  (멱등이라 매 프레임 불러도 무해하지만, 한 번 부른 뒤에는 로컬 플래그로 건너뛴다)
```

## 9. 테스트

### `tests/core/touch.test.ts` — DOM 없이 `handlePointer` 로

- 존: `W/2` 기준 down 시점 고정. 이동 존에서 시작한 손가락이 경계를 넘어도 점프가 안 된다.
- 조이스틱: 데드존 안 정지, `DEAD` 초과 시 방향, 한 방향으로 계속 밀어 anchor 가 따라온 뒤
  **손가락을 멈춰도 방향 유지**, 그 상태에서 반대로 `FOLLOW+DEAD` (36px) 되돌리면 반전 —
  `FOLLOW+DEAD−1` (35px) 에서는 아직 정지(0), 정확히 `FOLLOW+DEAD` (36px) 에서 −1 (경계 포함 부등호 검증).
- press/release 는 dir 변화 시에만 호출된다 (스파이 호출 횟수). 모두 `source === 'touch'`.
- 점프: down = 엣지 + held, up = held 해제. 활성 포인터가 있는 동안 두 번째 포인터 down = 무시.
- 공중 재down(같은 포인터 up 후 down) = 두 번째 엣지.
- 존별 두 번째 포인터 무시 — 후속 move/up 도 무시.
- `cancel` = up (액션 해제 + 추적 제거).
- reset: 액션 전부 release. 그 뒤 **suppressed 포인터의 move 는 무시, up 은 제거만**;
  suppressed 포인터가 떠 있는 동안 같은 존의 새 down 은 무시(첫 손가락 누른 채 두 번째 손가락 jump 안 됨);
  suppressed 포인터가 up 된 뒤의 새 down 은 정상 엣지.
- clear: 액션 전부 release + 목록 삭제. **down 상태에서 clear → 같은 pointerId 의 up 은 무시,
  같은 존의 새 down 은 정상 동작** (detach→재attach 시나리오). suppressed 포인터도 clear 로 사라진다.
- 추적 목록에 없는 pointerId 의 move/up 은 무해.
- 스냅샷: 상태 변화마다 발행, 내용 정확 (`lastPointerType` 포함).

### `tests/ui/touchOverlay.test.ts` — jsdom (기존 `tests/ui/*` 와 같은 방식)

- `dismissHint()` 멱등: 두 번 불러도 `onHintDone` 은 한 번, 타이머는 취소됨(fake timers).
- 1.5초 경과 시 자동으로 같은 경로 → `onHintDone` 한 번. 그 뒤 `dismissHint()` 는 no-op.
- `showHint: false` 면 안내 DOM 이 없고 `dismissHint()` 는 no-op, `onHintDone` 은 영원히 안 불린다.
- `unmount()` 는 진행 중 타이머를 정리하고 `onHintDone` 을 부르지 않는다.
- `isCoarse` 주입: false 면 글리프 숨김, 이후 `lastPointerType: 'touch'` 스냅샷이 오면 표시.
- 스냅샷 `moveDir`/`moveAnchor`/`jumpActive` 에 따라 트랙·노브·● 의 클래스/위치가 바뀐다.

### `tests/core/input.test.ts`

- 기존 키보드 테스트 전부 통과.
- 소스 분리: `handleKeyDown('ArrowLeft')` + `press('left','touch')` + `release('left','touch')` → `left` 여전히 true.
  반대(터치 held 중 키 up)도 대칭으로.
- 점프 엣지는 합산 held 의 false→true 에서만: 키보드 held 중 `press('jump','touch')` 는 `jumpPressed` 를 세우지 않는다.
- `kbJumpBlocked` 는 키보드만: reset 시 kb held 였으면 다음 `press('jump','keyboard')` 무시, 하지만
  같은 시점의 `press('jump','touch')` 는 엣지가 된다(터치는 4.6 의 존 점유로 따로 막힌다).
- `input.reset()` / `touch.reset()` 순서 두 가지 모두에서 최종 스냅샷이 같다 (touch 컨트롤러와 함께 도는 통합 케이스).

### `tests/core/storage.test.ts`

- v2 → v3: `controlsHintSeen` 기본 false, 기존 필드 보존, 이상값(문자열 등)은 false.

### `tests/architecture.test.ts`

- 변경 없음. `game/` 미접촉의 회귀 방지.

### 실기기 수동 체크리스트 (앱인토스 QR / 브라우저)

- 양손 동시 입력: 왼손 이동 중 오른손 점프·더블점프.
- 왼쪽 가장자리에서 시작한 이동에 iOS 스와이프백이 뜨지 않는다. 로비 복귀 후에는 다시 뜬다.
- 알림바를 내렸다 올린 뒤(=pointercancel) 잡고 있던 방향·점프가 풀려 있다.
- 홈으로 나갔다 돌아온 뒤(visibilitychange) 이동·점프 존이 모두 정상 반응한다 (stale 포인터 점유 없음).
- 손가락을 누른 채 판이 끝난 뒤(낙사) 다음 판에서 같은 존이 정상 반응한다.
- 퀴즈 모달을 닫은 직후 첫 점프가 먹는다(손을 뗐다 다시 눌렀을 때). 누른 채였다면 안 먹는다.
- 롱프레스에 메뉴/돋보기가 안 뜬다. 핀치·더블탭 줌이 안 된다. 페이지가 안 튕긴다.
- 데스크탑: 오버레이가 숨겨져 있고 키보드가 그대로 동작하며, 마우스로 존을 눌러도 동작한다.

## 10. 상위 스펙 갱신

- `2026-08-15-life-jump-design.md` 1절 비목표에서 "모바일 터치 조작 (키보드 전용)" 을 제거하고
  본 문서 링크를 남긴다.
- 13절 아키텍처 표에 `core/touch.ts`, `ui/touchOverlay.ts`, `toss/screen.ts` 추가.
