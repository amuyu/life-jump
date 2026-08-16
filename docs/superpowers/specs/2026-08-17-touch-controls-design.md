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
| 가시성 | 왼쪽 하단 ◀ ▶, 오른쪽 하단 ● 글리프를 DOM 오버레이로 상시 표시(터치 기기) |
| 입력 소스 | 키보드·터치 상시 병존. 모드 선택 없음 |
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
                         액션 단위 API 추가: press(action) / release(action)
                           action = 'left' | 'right' | 'jump'
                         handleKeyDown/Up 은 키코드 → 액션 매핑 후 press/release 를 부르는 얇은 층.
                         jumpBlocked·엣지 로직은 press('jump') 안으로 이동 —
                         키보드와 터치가 같은 규칙을 탄다.

src/core/touch.ts  (신규) 터치 컨트롤러. Pointer Events → 존/조이스틱 판정 → input.press/release.
                         전달받은 element 하나에 attach. pointerId 별 상태를 들고 있다가
                         up/cancel 에서 자기 액션만 해제. reset() 으로 전부 해제.
                         DOM 의존은 전달받은 element 뿐 (document/window 직접 참조 없음).

src/ui/touchOverlay.ts (신규) ◀ ▶ ● 글리프 + 조이스틱 인디케이터 + 첫 판 안내. 순수 DOM.
                         touch.ts 가 발행하는 스냅샷을 받아 그리기만 한다 — 자체 상태 없음.

src/toss/screen.ts (신규) setIosSwipeGestureEnabled 래퍼. 동적 import + isSupported 가드,
                         실패는 삼킨다. 브라우저에서는 no-op.

src/main.ts              startRun: touch.attach(gameLayer), overlay 마운트, 스와이프백 off.
                         판 종료·로비 복귀: touch.detach, overlay 제거, 스와이프백 on.
                         input.reset() 을 부르는 모든 지점(퀴즈 종료, visibilitychange, startRun)에서
                         touch.reset() 도 함께 부른다.
```

**멀티 소스 충돌** — 키보드 ←를 누른 채 터치 ◀를 떼는 경우는 마지막 호출이 이긴다.
폰에 외장 키보드를 붙인 경우뿐이라 참조 카운트는 두지 않는다.

**계층 경계** — `touch.ts`, `touchOverlay.ts`, `toss/screen.ts` 모두 `game/` 밖이다.
`tests/architecture.test.ts` 는 변경 없이 그대로 통과해야 한다.

## 3. `core/input.ts` 변경

```ts
export type InputAction = 'left' | 'right' | 'jump'

export interface Input {
  snapshot(): InputState
  consume(): void
  reset(): void
  /** 소스 무관 액션 진입점 — 키보드·터치 모두 이것을 부른다 */
  press(action: InputAction): void
  release(action: InputAction): void
  /** 기존 저수준 진입점 — 키코드를 액션으로 바꿔 press/release 에 위임 */
  handleKeyDown(code: string): void
  handleKeyUp(code: string): void
  attach(target, shouldCapture?): () => void
}
```

- `press('left'|'right')` → 해당 플래그 true. `release` → false.
- `press('jump')`: `jumpBlocked` 이면 무시. `!jumpHeld` 이면 `jumpPressed = true` (엣지).
  `jumpHeld = true`. — 기존 `handleKeyDown` 의 로직을 그대로 옮긴 것.
- `release('jump')`: `jumpHeld = false`, `jumpBlocked = false`.
- `reset()`: 기존과 동일 (`jumpBlocked = jumpHeld` 후 전부 해제).
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
  attach(el: HTMLElement): () => void
  reset(): void
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

`layout()` 은 존 경계 계산용 폭을 돌려준다 — 실제로는 `el.clientWidth`. 테스트에서는 상수.

### 4.2 존

- 경계 `W/2`. `clientX < W/2` → 이동 존, 그 외 → 점프 존.
- 존은 **down 시점에 결정**되고 손가락이 경계를 넘어가도 바뀌지 않는다.
- 한 존에 한 포인터. 이미 활성 포인터가 있는 존에 두 번째 down 이 오면 무시(추적하지 않음).
  그 포인터의 후속 move/up 도 무시된다.

### 4.3 이동 존 — 상대 조이스틱

상수(`touch.ts` 상단, 실기기 튜닝 대상 — 물리 상수와 섞지 않기 위해 `constants.ts` 에 두지 않는다):

```ts
const DEAD = 12     // CSS px. 이 안이면 정지
const FOLLOW = 36   // CSS px. 중심에서 이만큼 넘게 멀어지면 중심이 따라온다
```

- `down`: `anchor = (clientX, clientY)`, `dir = 0`.
- `move`: `dx = clientX − anchor.x`.
  - `|dx| > FOLLOW` 이면 `anchor.x = clientX − sign(dx) · FOLLOW` (항상 `|dx| ≤ FOLLOW`).
    → 반대 방향으로 `FOLLOW − DEAD = 24px` 만 되돌리면 즉시 반전.
  - `dx > DEAD` → 1, `dx < −DEAD` → −1, 아니면 0.
  - `dir` 이 바뀔 때만: 이전 dir 의 액션 `release`, 새 dir 의 액션 `press`. 매 move 마다 부르지 않는다.
- `up`/`cancel`: 현재 dir 액션 `release`, 포인터 상태 삭제, `dir = 0`.

### 4.4 점프 존 — 홀드 버튼

- `down` → `input.press('jump')`. 공중에서 다시 down 이면 두 번째 엣지 → 더블점프. 별도 처리 없음.
- `up`/`cancel` → `input.release('jump')`. 가변 점프 컷오프가 여기서 갈린다.

### 4.5 포인터 캡처·취소

- `down` 에서 `el.setPointerCapture(pointerId)` — 손가락이 요소 밖으로 나가도 up 을 받는다.
- `pointercancel`, `lostpointercapture` 는 `up` 과 동일 처리.
- `pointerType` 을 가리지 않는다 — 마우스도 동작하며 데스크탑 개발 확인에 쓰인다.

### 4.6 reset()

- 추적 중인 모든 포인터 삭제 + 잡고 있던 액션 전부 `release`.
- `input.reset()` 이 `jumpBlocked = jumpHeld` 를 걸어두므로, 퀴즈 모달을 닫을 때 손가락이
  아직 점프 존에 눌려 있어도 그 손가락은 죽은 키가 되고, 실제 up 후 다음 down 이 진짜 엣지가
  된다 — 키보드와 동일 규약.
- reset 이후 stale pointerId 의 up/move 는 무시된다(추적 목록에 없음).

### 4.7 스냅샷 발행

- 상태가 바뀔 때마다(`down/move/up/cancel/reset`) `subscribe` 콜백에 `TouchSnapshot` 을 준다.
- 매 move 마다 발행하지만 press/release 는 dir 변화 시에만 부른다는 점에 주의(4.3).

## 5. 오버레이 (`ui/touchOverlay.ts`)

### 5.1 구조

- gameLayer 안, 캔버스 위에 겹치는 `div.touch-overlay`. `position: absolute; inset: 0; pointer-events: none`.
  판정은 gameLayer 가 하고 오버레이는 그림만 그린다. z-index 는 캔버스 위, 퀴즈/결과 모달(30) 아래.
- `mountTouchOverlay(gameLayer, touch, opts)` → `{ unmount }`. `touch.subscribe` 로 스냅샷을 받아 갱신.

### 5.2 상시 글리프

- 왼쪽 하단 `◀ ▶`, 오른쪽 하단 `●`. 각 절반 폭의 가운데 정렬.
- 하단 여백 `max(24px, env(safe-area-inset-bottom) + 12px)`.
- 크기 56px. 흰색 + 검은 외곽선(캔버스 색조와 충돌 방지). 색 토큰은 `tokens.css` 것을 쓴다.
- 기본 opacity 0.25. 활성 존은 0.6. 이동 존은 활성 방향(◀ 또는 ▶)만 밝아진다.

### 5.3 조이스틱 인디케이터

- 이동 존 터치 중에만: `moveAnchor` 에 테두리 원 20px, `movePoint` 에 채운 점 10px.
  anchor 가 따라오면 원도 따라온다. 손을 떼면 즉시 사라진다.

### 5.4 표시 조건

- `matchMedia('(pointer: coarse)').matches` → 글리프 표시. 아니면 숨김.
- 숨긴 상태에서 `lastPointerType === 'touch'` 인 스냅샷이 오면 그 판 동안 표시(하이브리드 기기).
- 이 판단은 오버레이 안에서만 한다 — 판정(touch.ts)은 기기와 무관하게 항상 동작.

### 5.5 첫 판 안내

- 조건: `save.controlsHintSeen === false`.
- 내용: 화면 중앙 상단 반투명 배지 한 줄.
  - 터치 기기(5.4 기준): "왼쪽 밀어서 이동 · 오른쪽 탭 점프"
  - 그 외: "← → 이동 · Space 점프"
- 노출: 판 시작 후 1.5초 표시 → 0.3초 페이드. **어떤 입력이든 들어오면 즉시 페이드**
  (touch 스냅샷 변화 또는 키보드 — main.ts 가 `input.snapshot()` 에서 어느 플래그든 참이 되는 첫
  프레임에 `hint.dismiss()` 를 부른다).
- 표시가 끝난 시점에 `save.controlsHintSeen = true` 저장.
- 게임은 안내 중에도 멈추지 않는다 — 첫 발판 위라 위험이 없다.

## 6. 저장 (`core/storage.ts`)

- `SaveData.controlsHintSeen: boolean` 추가. 기본값 `false`.
- `SAVE_VERSION` 2 → 3. `migrate()` 에 v2→v3 단계 추가 — 순수 추가 필드라 version 만 전진(기존
  v1→v2 와 같은 패턴). 3단계 병합에서 `typeof === 'boolean'` 이 아니면 `false`.

## 7. WebView / CSS / 토스 SDK

### 7.1 CSS (`styles.css`)

```css
body { overscroll-behavior: none; touch-action: manipulation; }   /* 더블탭 줌 제거 */
.game-layer {
  touch-action: none;                  /* 스크롤·핀치·풀투리프레시 차단 */
  user-select: none; -webkit-user-select: none;
  -webkit-touch-callout: none;         /* 롱프레스 메뉴 */
}
```

- iOS 러버밴드 안전망: 판 중 gameLayer 에 `touchmove` `{ passive: false }` + `preventDefault()`.
  attach/detach 와 수명을 같이 한다.
- 캔버스 배치는 변경 없음. 정수 배율로 남는 여백은 존의 일부이므로 오히려 도움이 된다.

### 7.2 iOS 스와이프백 (`toss/screen.ts`)

- `startRun` → `setIosSwipeGestureEnabled({ isEnabled: false })`,
  판 종료·로비 복귀 → `{ isEnabled: true }`. 왼쪽 엄지가 화면 왼쪽 가장자리에서 시작하는 것을
  뒤로가기로 먹지 않게 한다.
- 동적 import + `isSupported` 가드, 예외는 삼킨다. 브라우저에서는 no-op.
- 확인 항목: web-framework 패키지에서의 정확한 export 경로(문서는 `@apps-in-toss/framework` 기준
  `setIosSwipeGestureEnabled(options: { isEnabled: boolean }): Promise<void>`).

### 7.3 granite (참고, 본 범위 밖)

- `webViewProps: { type: 'game' }`. iOS 에서 상단 내비바가 남으면 `navigationBar: { transparentBackground: true }`.
- SDK 3.x 에서 `webViewProps` → `webView` 로 바뀌고 `type` 이 삭제된다.

## 8. `main.ts` 배선

```
startRun:
  touch.attach(gameLayer)  (touchmove preventDefault 포함)
  overlay = mountTouchOverlay(gameLayer, touch, { showHint: !save.controlsHintSeen, ... })
  swipeBack(false)
  (기존) loop.reset(); input.reset(); → touch.reset() 추가

openQuiz 종료 콜백:
  (기존) loop.reset(); input.reset(); → touch.reset() 추가

visibilitychange (복귀):
  (기존) loop.reset(); input.reset(); → touch.reset() 추가

finishRun / goToLobby / enterLoadout:
  touch.detach(); overlay.unmount(); swipeBack(true)
  (결과 모달은 gameLayer 위 z-30 이라 터치가 게임에 닿지 않지만, detach 로 리스너 자체를 뗀다)

frame:
  안내 표시 중이면 input.snapshot() 에 참 플래그가 하나라도 있을 때 hint.dismiss()
```

## 9. 테스트

### `tests/core/touch.test.ts` — DOM 없이 `handlePointer` 로

- 존: `W/2` 기준 down 시점 고정. 이동 존에서 시작한 손가락이 경계를 넘어도 점프가 안 된다.
- 조이스틱: 데드존 안 정지, `DEAD` 초과 시 방향, `FOLLOW` 초과 시 anchor 이동 후 `FOLLOW−DEAD` 되돌림에 즉시 반전.
- press/release 는 dir 변화 시에만 호출된다 (스파이 호출 횟수).
- 점프: down = 엣지 + held, up = held 해제. 활성 포인터가 있는 동안 두 번째 포인터 down = 무시.
- 공중 재down(같은 포인터 up 후 down) = 두 번째 엣지.
- 존별 두 번째 포인터 무시 — 후속 move/up 도 무시.
- `cancel` = up. `lostpointercapture` 경로도 up.
- reset: 액션 전부 release, 이후 stale pointerId 의 up/move 는 무해.
- 스냅샷: 상태 변화마다 발행, 내용 정확.

### `tests/core/input.test.ts`

- 기존 키보드 테스트 전부 통과.
- `press('jump')` 경로에서 `jumpBlocked` 규약: reset 시 held 였으면 다음 press 무시, release 후 press 는 엣지.
- `press('left')` + `handleKeyUp('ArrowLeft')` → 마지막 호출이 이긴다(false).

### `tests/core/storage.test.ts`

- v2 → v3: `controlsHintSeen` 기본 false, 기존 필드 보존, 이상값(문자열 등)은 false.

### `tests/architecture.test.ts`

- 변경 없음. `game/` 미접촉의 회귀 방지.

### 실기기 수동 체크리스트 (앱인토스 QR / 브라우저)

- 양손 동시 입력: 왼손 이동 중 오른손 점프·더블점프.
- 왼쪽 가장자리에서 시작한 이동에 iOS 스와이프백이 뜨지 않는다. 로비 복귀 후에는 다시 뜬다.
- 알림바를 내렸다 올린 뒤(=pointercancel) 잡고 있던 방향·점프가 풀려 있다.
- 퀴즈 모달을 닫은 직후 첫 점프가 먹는다(손을 뗐다 다시 눌렀을 때). 누른 채였다면 안 먹는다.
- 롱프레스에 메뉴/돋보기가 안 뜬다. 핀치·더블탭 줌이 안 된다. 페이지가 안 튕긴다.
- 데스크탑: 오버레이가 숨겨져 있고 키보드가 그대로 동작하며, 마우스로 존을 눌러도 동작한다.

## 10. 상위 스펙 갱신

- `2026-08-15-life-jump-design.md` 1절 비목표에서 "모바일 터치 조작 (키보드 전용)" 을 제거하고
  본 문서 링크를 남긴다.
- 13절 아키텍처 표에 `core/touch.ts`, `ui/touchOverlay.ts`, `toss/screen.ts` 추가.
