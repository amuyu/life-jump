# Touch Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the game be played with two thumbs on a phone — left half of the screen is a relative joystick for left/right, right half is a hold-to-jump button — without touching the `game/` layer.

**Architecture:** `core/input.ts` grows a source-aware `press/release(action, source)` API and ORs the keyboard and touch sources into the existing boolean `InputState`. A new `core/touch.ts` turns Pointer Events into zone/joystick judgements and calls that API. A new `ui/touchOverlay.ts` draws hint glyphs, the live joystick track, and the first-run hint from snapshots the controller publishes. `toss/screen.ts` wraps the Toss swipe-back SDK call behind a serialized, failure-swallowing no-op-in-browser adapter. `main.ts` wires them into the run lifecycle.

**Tech Stack:** Vanilla TypeScript, Vite, Vitest (node env; jsdom added for the overlay test only), Pointer Events, CSS.

**Spec:** `docs/superpowers/specs/2026-08-17-touch-controls-design.md`

## Global Constraints

- `src/game/` must not change. `tests/architecture.test.ts` must keep passing unchanged (no `document`/`window`/`localStorage`/`Math.random`/`render/`/`ui/` in `game/`).
- `InputState` (`left`, `right`, `jumpHeld`, `jumpPressed`) keeps its shape — physics is untouched.
- Joystick constants live at the top of `src/core/touch.ts`, not `constants.ts`: `DEAD = 12`, `FOLLOW = 24` (CSS px), and `FOLLOW > DEAD` is a hard invariant.
- Dead-zone comparisons are inclusive: `dx >= DEAD` → right, `dx <= -DEAD` → left. Reversal distance is exactly `FOLLOW + DEAD = 36px`.
- One pointer per zone. Zone is decided at `down` and never changes for that pointer.
- `reset()` (modal) keeps pointers as `suppressed`; `clear()` (lifecycle: attach, detach, visibilitychange) drops them. Neither may depend on being called before/after `input.reset()`.
- `jumpBlocked` exists for the keyboard source only. Jump edge fires only when the combined `jumpHeld` goes false → true.
- Touch controller and overlay must not read or write `save`; the overlay reports hint completion via `onHintDone`.
- Hint copy: touch `"왼쪽 밀어서 이동 · 오른쪽 길게 눌러 점프"`, otherwise `"← → 이동 · Space 길게 눌러 점프"`. Show 1.5s, fade 0.3s. Any input dismisses early: the overlay watches touch snapshots (`moveAnchor !== null || jumpActive` — a move-zone `down` at `dir = 0` never reaches `InputState`), `main.ts` watches `InputState` for the keyboard.
- Save schema: add `controlsHintSeen: boolean` (default `false`), bump `SAVE_VERSION` 2 → 3, migration only advances the version.
- CSS: `body { touch-action: manipulation }`; `.game-layer { touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none }`. Do **not** put `overscroll-behavior` on `body`.
- Swipe-back SDK calls are serialized and de-duplicated; failures are swallowed; browser is a no-op.
- Commands: `npm test` (all tests), `npm run build` (tsc + vite). Run `npm test` before every commit.
- Test file naming/style: `tests/<mirror of src path>.test.ts`, Korean `it()` descriptions like the existing suite.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/input.ts` (modify) | Per-source state; `press/release(action, source)`; keyboard code → action mapping; OR-ed snapshot; keyboard-only `kbJumpBlocked`. |
| `src/core/touch.ts` (create) | Pointer → zone/joystick logic; `handlePointer`, `reset`, `clear`, `subscribe`, `attach`. No `document`/`window`; only the element it is handed. |
| `src/ui/touchHint.ts` (create) | Pure hint state machine (`shown → fading → done`) with injectable timers. No DOM. |
| `src/ui/touchOverlay.ts` (create) | DOM overlay: rest track, live track, jump glyph, hint element; subscribes to touch snapshots; uses `touchHint`. |
| `src/toss/screen.ts` (create) | `createSwipeBack(loadSdk)` + default `setSwipeBack(enabled)`; serialized, de-duplicated, swallowing. |
| `src/core/storage.ts` (modify) | `controlsHintSeen`, `SAVE_VERSION = 3`, v2→v3 migration. |
| `src/ui/styles.css` (modify) | WebView hardening + overlay styles. |
| `src/main.ts` (modify) | Lifecycle wiring. |
| `tests/core/input.test.ts` (modify), `tests/core/touch.test.ts` (create), `tests/ui/touchHint.test.ts` (create), `tests/ui/touchOverlay.test.ts` (create, jsdom), `tests/toss/screen.test.ts` (create), `tests/core/storage.test.ts` (modify) | Tests. |
| `docs/superpowers/specs/2026-08-15-life-jump-design.md`, `CLAUDE.md` (modify) | Doc updates. |

---

### Task 1: Source-aware `press/release` in `core/input.ts`

**Files:**
- Modify: `src/core/input.ts`
- Test: `tests/core/input.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  ```ts
  export type InputAction = 'left' | 'right' | 'jump'
  export type InputSource = 'keyboard' | 'touch'
  interface Input {
    press(action: InputAction, source: InputSource): void
    release(action: InputAction, source: InputSource): void
    // existing: snapshot, consume, reset, handleKeyDown, handleKeyUp, attach
  }
  ```

- [ ] **Step 1: Add the failing tests**

Append to the `describe('createInput', …)` block in `tests/core/input.test.ts`:

```ts
  it('키보드와 터치는 소스별 상태를 가지며 OR로 합쳐진다', () => {
    // 키보드 ←를 누른 채 마우스/터치로 이동 존을 눌렀다 떼도 ←는 살아 있어야 한다.
    // 마지막 호출이 이기는 단일 불리언이면 데스크탑에서 마우스 클릭 한 번에 키가 풀린다.
    const input = createInput()
    input.handleKeyDown('ArrowLeft')
    input.press('left', 'touch')
    input.release('left', 'touch')
    expect(input.snapshot().left).toBe(true)
    input.handleKeyUp('ArrowLeft')
    expect(input.snapshot().left).toBe(false)
  })

  it('터치 held 중 키보드 up이 와도 터치 쪽은 유지된다', () => {
    const input = createInput()
    input.press('right', 'touch')
    input.handleKeyDown('ArrowRight')
    input.handleKeyUp('ArrowRight')
    expect(input.snapshot().right).toBe(true)
    input.release('right', 'touch')
    expect(input.snapshot().right).toBe(false)
  })

  it('점프 엣지는 합산 held가 false→true일 때만 선다', () => {
    const input = createInput()
    input.handleKeyDown('Space')
    input.consume()
    input.press('jump', 'touch')     // Space 누른 채 점프 존 클릭 — 새 엣지가 아니다
    expect(input.snapshot().jumpPressed).toBe(false)
    expect(input.snapshot().jumpHeld).toBe(true)
    input.handleKeyUp('Space')
    expect(input.snapshot().jumpHeld).toBe(true)   // 터치가 아직 잡고 있다
    input.release('jump', 'touch')
    expect(input.snapshot().jumpHeld).toBe(false)
  })

  it('reset()의 jumpBlocked는 키보드에만 적용된다', () => {
    // 터치는 pointerdown이 반복되지 않으므로 block이 필요 없다 — 터치 컨트롤러가
    // 존 점유(suppressed)로 따로 막는다. 여기서는 input이 터치를 막지 않는지만 본다.
    const input = createInput()
    input.handleKeyDown('Space')
    input.reset()
    input.handleKeyDown('Space')                    // 키 반복 — 막힌다
    expect(input.snapshot().jumpPressed).toBe(false)
    input.press('jump', 'touch')                    // 새 손가락 — 엣지
    expect(input.snapshot().jumpPressed).toBe(true)
    expect(input.snapshot().jumpHeld).toBe(true)
  })

  it('reset()은 두 소스를 모두 뗀 것으로 만든다', () => {
    const input = createInput()
    input.press('left', 'touch')
    input.press('jump', 'touch')
    input.handleKeyDown('ArrowRight')
    input.reset()
    const s = input.snapshot()
    expect(s.left).toBe(false)
    expect(s.right).toBe(false)
    expect(s.jumpHeld).toBe(false)
    expect(s.jumpPressed).toBe(false)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/core/input.test.ts`
Expected: the five new tests FAIL with `input.press is not a function`; existing tests PASS.

- [ ] **Step 3: Rewrite `createInput` with per-source state**

Replace the body of `src/core/input.ts` from `const JUMP_CODES` to the end with:

```ts
const JUMP_CODES = new Set(['Space', 'ArrowUp', 'KeyW'])
const LEFT_CODES = new Set(['ArrowLeft', 'KeyA'])
const RIGHT_CODES = new Set(['ArrowRight', 'KeyD'])

export type InputAction = 'left' | 'right' | 'jump'
export type InputSource = 'keyboard' | 'touch'

interface SourceState {
  left: boolean
  right: boolean
  jumpHeld: boolean
}

const freshSource = (): SourceState => ({ left: false, right: false, jumpHeld: false })

export function createInput(): Input {
  // 소스별 상태. 스냅샷은 둘의 OR — 키보드 ←를 누른 채 마우스로 이동 존을 눌렀다
  // 떼도 ←가 살아 있어야 한다. 단일 불리언에 마지막 호출이 이기게 두면 데스크탑에서
  // 마우스 클릭 한 번에 키가 풀린다.
  const sources: Record<InputSource, SourceState> = {
    keyboard: freshSource(),
    touch: freshSource(),
  }
  let jumpPressed = false
  // reset() 시점에 점프키가 눌려 있었으면, 실제 keyup을 볼 때까지 점프를 막는다.
  // 브라우저의 키 반복 keydown은 새 누름과 구분되지 않으므로 이 플래그가 없으면
  // 모달을 마우스로 닫은 직후 "누르고 있던" Space가 점프로 이어진다 (스펙 8절 4).
  // 키보드 전용이다 — pointerdown은 반복되지 않으므로 터치에는 필요 없다.
  let kbJumpBlocked = false

  const anyJumpHeld = (): boolean => sources.keyboard.jumpHeld || sources.touch.jumpHeld

  const press = (action: InputAction, source: InputSource): void => {
    const s = sources[source]
    if (action === 'left') { s.left = true; return }
    if (action === 'right') { s.right = true; return }
    if (source === 'keyboard' && kbJumpBlocked) return   // 뗐다 다시 눌러야 한다
    // 합산 held가 false→true 로 바뀔 때만 엣지 — 이미 어느 소스든 잡고 있으면
    // 키 반복이거나 두 번째 소스의 중복 누름이다
    if (!anyJumpHeld()) jumpPressed = true
    s.jumpHeld = true
  }

  const release = (action: InputAction, source: InputSource): void => {
    const s = sources[source]
    if (action === 'left') { s.left = false; return }
    if (action === 'right') { s.right = false; return }
    s.jumpHeld = false
    if (source === 'keyboard') kbJumpBlocked = false   // 실제로 뗐다 — 다음 누름은 진짜 엣지다
  }

  const handleKeyDown = (code: string): void => {
    if (LEFT_CODES.has(code)) press('left', 'keyboard')
    if (RIGHT_CODES.has(code)) press('right', 'keyboard')
    if (JUMP_CODES.has(code)) press('jump', 'keyboard')
  }

  const handleKeyUp = (code: string): void => {
    if (LEFT_CODES.has(code)) release('left', 'keyboard')
    if (RIGHT_CODES.has(code)) release('right', 'keyboard')
    if (JUMP_CODES.has(code)) release('jump', 'keyboard')
  }

  const snapshot = (): InputState => ({
    left: sources.keyboard.left || sources.touch.left,
    right: sources.keyboard.right || sources.touch.right,
    jumpHeld: anyJumpHeld(),
    jumpPressed,
  })

  const consume = (): void => {
    jumpPressed = false
  }

  const reset = (): void => {
    // 눌려 있던 점프키는 실제 keyup을 볼 때까지 죽은 키로 둔다.
    // 눌려 있지 않았다면 막을 것이 없다 — 막으면 복귀 후 첫 점프를 먹는다.
    kbJumpBlocked = sources.keyboard.jumpHeld
    sources.keyboard = freshSource()
    sources.touch = freshSource()
    jumpPressed = false
  }

  const attach = (
    target: { addEventListener: Function; removeEventListener: Function },
    shouldCapture?: () => boolean,
  ): (() => void) => {
    const onDown = (e: { code: string; preventDefault(): void }) => {
      const known =
        JUMP_CODES.has(e.code) || LEFT_CODES.has(e.code) || RIGHT_CODES.has(e.code)
      // 플레이 중일 때만 가로챈다 — 로비·상점에서는 Space로 버튼을 누르고
      // ArrowUp으로 패널을 스크롤할 수 있어야 한다
      if (known && (shouldCapture === undefined || shouldCapture())) {
        e.preventDefault() // Space 스크롤 방지
      }
      handleKeyDown(e.code)
    }
    const onUp = (e: { code: string }) => handleKeyUp(e.code)

    target.addEventListener('keydown', onDown)
    target.addEventListener('keyup', onUp)
    return () => {
      target.removeEventListener('keydown', onDown)
      target.removeEventListener('keyup', onUp)
    }
  }

  return { snapshot, consume, reset, press, release, handleKeyDown, handleKeyUp, attach }
}
```

And extend the `Input` interface (keep the existing doc comments; add these two members after `reset()`):

```ts
  /** 소스별 액션 진입점 — 키보드는 'keyboard', 터치 컨트롤러는 'touch' 로 부른다 */
  press(action: InputAction, source: InputSource): void
  release(action: InputAction, source: InputSource): void
```

The `InputAction`/`InputSource` aliases are declared below the interface in the block above; that is fine — TypeScript resolves type aliases regardless of declaration order. Keep them where the block puts them.

- [ ] **Step 4: Run the whole input suite**

Run: `npx vitest run tests/core/input.test.ts`
Expected: all PASS (10 existing + 5 new).

- [ ] **Step 5: Run everything and commit**

Run: `npm test`
Expected: all PASS.

```bash
git add src/core/input.ts tests/core/input.test.ts
git commit -m "feat(input): track keyboard and touch as separate sources OR-ed into the snapshot"
```

---

### Task 2: Touch controller skeleton — zones, jump, cancel, clear, snapshot

**Files:**
- Create: `src/core/touch.ts`
- Test: `tests/core/touch.test.ts`

**Interfaces:**
- Consumes: `Input.press/release(action, 'touch')`, `Input.snapshot()` from Task 1.
- Produces:
  ```ts
  export const DEAD = 12
  export const FOLLOW = 24
  export interface TouchSnapshot {
    moveAnchor: { x: number; y: number } | null
    movePoint: { x: number; y: number } | null
    moveDir: -1 | 0 | 1
    jumpActive: boolean
    lastPointerType: string | null
  }
  export interface PointerLike {
    type: 'down' | 'move' | 'up' | 'cancel'
    pointerId: number
    clientX: number
    clientY: number
    pointerType?: string
  }
  export interface TouchTarget {
    addEventListener: Function
    removeEventListener: Function
    setPointerCapture?: (pointerId: number) => void
  }
  export interface TouchController {
    attach(el: TouchTarget): () => void
    reset(): void
    clear(): void
    subscribe(cb: (s: TouchSnapshot) => void): () => void
    handlePointer(e: PointerLike): void
  }
  export function createTouch(input: Input, layout: () => { width: number }): TouchController
  ```
  (`attach` and `reset` bodies are filled in by Tasks 4 and 5; this task stubs `attach` to throw and `reset` to call `clear`.)

- [ ] **Step 1: Write the failing tests**

Create `tests/core/touch.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { createInput } from '../../src/core/input'
import { createTouch, type TouchSnapshot } from '../../src/core/touch'

const W = 400              // 존 경계는 200
const LEFT_X = 100         // 이동 존
const RIGHT_X = 300        // 점프 존

function setup() {
  const input = createInput()
  const touch = createTouch(input, () => ({ width: W }))
  const snaps: TouchSnapshot[] = []
  touch.subscribe((s) => { snaps.push(s) })
  const ev = (type: 'down' | 'move' | 'up' | 'cancel', pointerId: number, x: number, y = 500, pointerType = 'touch') =>
    touch.handlePointer({ type, pointerId, clientX: x, clientY: y, pointerType })
  return { input, touch, snaps, ev }
}

describe('createTouch — 존과 점프', () => {
  it('오른쪽 절반 down은 점프 엣지 + held, up은 held 해제', () => {
    const { input, ev } = setup()
    ev('down', 1, RIGHT_X)
    expect(input.snapshot().jumpPressed).toBe(true)
    expect(input.snapshot().jumpHeld).toBe(true)
    input.consume()
    ev('up', 1, RIGHT_X)
    expect(input.snapshot().jumpHeld).toBe(false)
  })

  it('경계(W/2) 정확히 위는 점프 존이다', () => {
    const { input, ev } = setup()
    ev('down', 1, W / 2)
    expect(input.snapshot().jumpHeld).toBe(true)
  })

  it('같은 손가락을 뗐다 다시 누르면 두 번째 엣지 (더블점프)', () => {
    const { input, ev } = setup()
    ev('down', 1, RIGHT_X); input.consume()
    ev('up', 1, RIGHT_X)
    ev('down', 1, RIGHT_X)
    expect(input.snapshot().jumpPressed).toBe(true)
  })

  it('점프 존에 활성 포인터가 있으면 두 번째 포인터는 무시된다 — 후속 up도', () => {
    const { input, ev } = setup()
    ev('down', 1, RIGHT_X); input.consume()
    ev('down', 2, RIGHT_X + 20)
    expect(input.snapshot().jumpPressed).toBe(false)
    ev('up', 2, RIGHT_X + 20)             // 무시된 포인터의 up — 첫 손가락은 계속 held
    expect(input.snapshot().jumpHeld).toBe(true)
    ev('up', 1, RIGHT_X)
    expect(input.snapshot().jumpHeld).toBe(false)
  })

  it('존은 down 시점에 고정된다 — 이동 존에서 시작한 손가락이 오른쪽으로 넘어가도 점프가 안 된다', () => {
    const { input, ev } = setup()
    ev('down', 1, LEFT_X)
    ev('move', 1, RIGHT_X)
    expect(input.snapshot().jumpHeld).toBe(false)
    expect(input.snapshot().jumpPressed).toBe(false)
  })

  it('cancel은 up과 같다', () => {
    const { input, ev } = setup()
    ev('down', 1, RIGHT_X)
    ev('cancel', 1, RIGHT_X)
    expect(input.snapshot().jumpHeld).toBe(false)
  })

  it('추적 목록에 없는 pointerId의 move/up은 아무 일도 하지 않는다', () => {
    const { input, ev, snaps } = setup()
    const before = snaps.length
    ev('move', 9, RIGHT_X)
    ev('up', 9, RIGHT_X)
    expect(input.snapshot().jumpHeld).toBe(false)
    expect(snaps.length).toBe(before)
  })
})

describe('createTouch — clear()', () => {
  it('clear는 액션을 전부 해제하고 목록을 비운다 — 이후 같은 id의 up은 무시, 같은 존 새 down은 정상', () => {
    const { input, touch, ev } = setup()
    ev('down', 1, RIGHT_X); input.consume()
    touch.clear()
    expect(input.snapshot().jumpHeld).toBe(false)
    ev('up', 1, RIGHT_X)                   // detach 뒤 늦게 온 up — 무해
    ev('down', 7, RIGHT_X)                 // 다음 판의 새 손가락 — 존이 비어 있어야 한다
    expect(input.snapshot().jumpPressed).toBe(true)
  })
})

describe('createTouch — 스냅샷', () => {
  it('점프 down/up에 jumpActive와 lastPointerType이 반영된다', () => {
    const { ev, snaps } = setup()
    ev('down', 1, RIGHT_X, 500, 'mouse')
    expect(snaps.at(-1)).toMatchObject({ jumpActive: true, lastPointerType: 'mouse', moveDir: 0, moveAnchor: null })
    ev('up', 1, RIGHT_X, 500, 'mouse')
    expect(snaps.at(-1)?.jumpActive).toBe(false)
  })

  it('무시된 두 번째 포인터는 스냅샷을 발행하지 않는다', () => {
    const { ev, snaps } = setup()
    ev('down', 1, RIGHT_X)
    const n = snaps.length
    ev('down', 2, RIGHT_X)
    expect(snaps.length).toBe(n)
  })

  it('unsubscribe 후에는 콜백이 오지 않는다', () => {
    const { touch, ev } = setup()
    const cb = vi.fn()
    const off = touch.subscribe(cb)
    off()
    ev('down', 1, RIGHT_X)
    expect(cb).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/touch.test.ts`
Expected: FAIL — cannot resolve `../../src/core/touch`.

- [ ] **Step 3: Create `src/core/touch.ts`**

```ts
import type { Input } from './input'

/**
 * 조이스틱 튜닝 상수 (CSS px). 물리 상수와 섞지 않기 위해 constants.ts 에 두지 않는다.
 * FOLLOW > DEAD 는 불변식이다 — 같거나 작으면 한 방향으로 밀다 손가락을 멈추는 순간
 * anchor 가 손가락 DEAD 이내로 따라와 방향이 풀린다.
 */
export const DEAD = 12     // 이 안이면 정지
export const FOLLOW = 24   // 중심에서 이만큼 넘게 멀어지면 중심이 따라온다

export interface TouchSnapshot {
  /** 이동 존 활성 시 조이스틱 중심 (CSS px) */
  moveAnchor: { x: number; y: number } | null
  /** 이동 존 활성 시 현재 손가락 */
  movePoint: { x: number; y: number } | null
  moveDir: -1 | 0 | 1
  jumpActive: boolean
  /** 마지막으로 처리한 포인터의 종류 ('touch' | 'mouse' | 'pen' | null). 오버레이 표시 판단용 */
  lastPointerType: string | null
}

export interface PointerLike {
  type: 'down' | 'move' | 'up' | 'cancel'
  pointerId: number
  clientX: number
  clientY: number
  pointerType?: string
}

/** attach 가 필요로 하는 최소 DOM 표면 — 테스트에서는 가짜 객체를 넣는다 */
export interface TouchTarget {
  addEventListener: Function
  removeEventListener: Function
  setPointerCapture?: (pointerId: number) => void
}

export interface TouchController {
  /** DOM 배선. 반환된 함수가 detach — 호출자(main.ts)가 보관한다. attach·detach 모두 clear() 를 부른다 */
  attach(el: TouchTarget): () => void
  /** 모달용 — 손가락이 아직 화면에 있다. 포인터를 suppressed 로 보존하고 액션만 해제 */
  reset(): void
  /** 수명 종료·OS 개입용 — 포인터 목록을 전부 삭제하고 액션 해제. 이후 어떤 stale up 도 무시된다 */
  clear(): void
  subscribe(cb: (s: TouchSnapshot) => void): () => void
  /** 테스트·배선용 저수준 진입점 — DOM 없이 가짜 이벤트를 넣는다 */
  handlePointer(e: PointerLike): void
}

type Zone = 'move' | 'jump'
type Dir = -1 | 0 | 1

interface Tracked {
  zone: Zone
  /** reset() 을 거친 손가락 — 존은 점유하지만 move 는 무시하고 up 은 제거만 한다 */
  suppressed: boolean
  anchorX: number
  anchorY: number
  x: number
  y: number
  dir: Dir
}

const dirAction = (dir: Dir): 'left' | 'right' => (dir < 0 ? 'left' : 'right')

export function createTouch(input: Input, layout: () => { width: number }): TouchController {
  const pointers = new Map<number, Tracked>()
  const subs = new Set<(s: TouchSnapshot) => void>()
  let lastPointerType: string | null = null

  const zoneOf = (x: number): Zone => (x < layout().width / 2 ? 'move' : 'jump')

  const activeIn = (zone: Zone): Tracked | null => {
    for (const t of pointers.values()) if (t.zone === zone) return t
    return null
  }

  const publish = (): void => {
    const move = activeIn('move')
    const jump = activeIn('jump')
    const live = move !== null && !move.suppressed ? move : null
    const snap: TouchSnapshot = {
      moveAnchor: live === null ? null : { x: live.anchorX, y: live.anchorY },
      movePoint: live === null ? null : { x: live.x, y: live.y },
      moveDir: live === null ? 0 : live.dir,
      jumpActive: jump !== null && !jump.suppressed,
      lastPointerType,
    }
    for (const cb of subs) cb(snap)
  }

  /** dir 이 바뀔 때만 press/release 를 부른다 — 매 move 마다 부르지 않는다 */
  const setDir = (t: Tracked, next: Dir): void => {
    if (t.dir === next) return
    if (t.dir !== 0) input.release(dirAction(t.dir), 'touch')
    if (next !== 0) input.press(dirAction(next), 'touch')
    t.dir = next
  }

  const releaseActions = (t: Tracked): void => {
    if (t.suppressed) return
    if (t.zone === 'jump') input.release('jump', 'touch')
    else setDir(t, 0)
  }

  const onDown = (e: PointerLike): void => {
    const zone = zoneOf(e.clientX)
    // 한 존에 한 포인터 — 활성이든 suppressed 든 이미 있으면 무시 (스냅샷도 안 낸다)
    if (activeIn(zone) !== null) return
    pointers.set(e.pointerId, {
      zone, suppressed: false,
      anchorX: e.clientX, anchorY: e.clientY, x: e.clientX, y: e.clientY, dir: 0,
    })
    if (zone === 'jump') input.press('jump', 'touch')
    publish()
  }

  const onMove = (e: PointerLike): void => {
    const t = pointers.get(e.pointerId)
    if (t === undefined || t.suppressed || t.zone !== 'move') return
    t.x = e.clientX
    t.y = e.clientY
    // 조이스틱 판정은 Task 3 에서 채운다
    publish()
  }

  const onUp = (e: PointerLike): void => {
    const t = pointers.get(e.pointerId)
    if (t === undefined) return
    pointers.delete(e.pointerId)
    releaseActions(t)
    publish()
  }

  const handlePointer = (e: PointerLike): void => {
    if (e.pointerType !== undefined) lastPointerType = e.pointerType
    switch (e.type) {
      case 'down': onDown(e); break
      case 'move': onMove(e); break
      case 'up':
      case 'cancel': onUp(e); break
    }
  }

  const clear = (): void => {
    for (const t of pointers.values()) releaseActions(t)
    pointers.clear()
    publish()
  }

  const reset = (): void => {
    // Task 4 에서 suppressed 규칙으로 바꾼다
    clear()
  }

  const subscribe = (cb: (s: TouchSnapshot) => void): (() => void) => {
    subs.add(cb)
    return () => { subs.delete(cb) }
  }

  const attach = (_el: TouchTarget): (() => void) => {
    throw new Error('attach 는 Task 5 에서 구현한다')
  }

  return { attach, reset, clear, subscribe, handlePointer }
}
```

- [ ] **Step 4: Run the touch tests**

Run: `npx vitest run tests/core/touch.test.ts`
Expected: all PASS.

- [ ] **Step 5: Run everything and commit**

Run: `npm test`
Expected: all PASS (architecture test still green — `touch.ts` is in `core/`).

```bash
git add src/core/touch.ts tests/core/touch.test.ts
git commit -m "feat(touch): pointer controller with zone split, hold-to-jump, cancel and clear"
```

---

### Task 3: Relative joystick in the move zone

**Files:**
- Modify: `src/core/touch.ts` (`onMove`)
- Test: `tests/core/touch.test.ts`

**Interfaces:**
- Consumes: Task 2's `createTouch`, `DEAD`, `FOLLOW`.
- Produces: no new names; `onMove` now drives `left`/`right`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/core/touch.test.ts`:

```ts
import { DEAD, FOLLOW } from '../../src/core/touch'   // 파일 상단 import 줄에 합친다

describe('createTouch — 상대 조이스틱', () => {
  it('상수 불변식: FOLLOW > DEAD', () => {
    expect(FOLLOW).toBeGreaterThan(DEAD)
  })

  it('down 직후는 정지, DEAD 안에서는 정지', () => {
    const { input, ev } = setup()
    ev('down', 1, LEFT_X)
    expect(input.snapshot().left).toBe(false)
    expect(input.snapshot().right).toBe(false)
    ev('move', 1, LEFT_X + DEAD - 1)
    expect(input.snapshot().right).toBe(false)
  })

  it('경계 포함 — 정확히 DEAD 만큼 밀면 방향이 선다', () => {
    const { input, ev } = setup()
    ev('down', 1, LEFT_X)
    ev('move', 1, LEFT_X + DEAD)
    expect(input.snapshot().right).toBe(true)
    ev('move', 1, LEFT_X - DEAD)
    expect(input.snapshot().right).toBe(false)
    expect(input.snapshot().left).toBe(true)
  })

  it('한 방향으로 계속 밀어 anchor가 따라온 뒤 손가락을 멈춰도 방향이 유지된다', () => {
    const { input, ev, snaps } = setup()
    ev('down', 1, LEFT_X)
    ev('move', 1, LEFT_X + 80)
    expect(input.snapshot().right).toBe(true)
    // anchor 는 손가락에서 정확히 FOLLOW 뒤에 있다
    expect(snaps.at(-1)?.moveAnchor?.x).toBe(LEFT_X + 80 - FOLLOW)
    ev('move', 1, LEFT_X + 80)      // 같은 자리 — 멈춤
    expect(input.snapshot().right).toBe(true)
  })

  it('반전 거리는 정확히 FOLLOW + DEAD — 그보다 1px 덜 가면 정지, 딱 그만큼이면 반대 방향', () => {
    const { input, ev } = setup()
    ev('down', 1, LEFT_X)
    ev('move', 1, LEFT_X + 80)                              // 오른쪽, anchor = finger − FOLLOW
    const finger = LEFT_X + 80
    ev('move', 1, finger - (FOLLOW + DEAD - 1))            // 35px 되돌림 → 아직 정지
    expect(input.snapshot().right).toBe(false)
    expect(input.snapshot().left).toBe(false)
    ev('move', 1, finger - (FOLLOW + DEAD))                // 36px → 왼쪽
    expect(input.snapshot().left).toBe(true)
  })

  it('press/release는 dir이 바뀔 때만 불린다', () => {
    const { input, ev } = setup()
    const press = vi.spyOn(input, 'press')
    const release = vi.spyOn(input, 'release')
    ev('down', 1, LEFT_X)
    ev('move', 1, LEFT_X + 20)
    ev('move', 1, LEFT_X + 21)
    ev('move', 1, LEFT_X + 22)
    expect(press).toHaveBeenCalledTimes(1)
    expect(press).toHaveBeenCalledWith('right', 'touch')
    ev('up', 1, LEFT_X + 22)
    expect(release).toHaveBeenCalledTimes(1)
    expect(release).toHaveBeenCalledWith('right', 'touch')
  })

  it('up/cancel은 현재 방향을 해제한다', () => {
    const { input, ev } = setup()
    ev('down', 1, LEFT_X)
    ev('move', 1, LEFT_X - 30)
    expect(input.snapshot().left).toBe(true)
    ev('cancel', 1, LEFT_X - 30)
    expect(input.snapshot().left).toBe(false)
  })

  it('이동 존에 활성 포인터가 있으면 두 번째 포인터는 무시된다', () => {
    const { input, ev } = setup()
    ev('down', 1, LEFT_X)
    ev('down', 2, LEFT_X + 50)
    ev('move', 2, LEFT_X + 100)      // 무시된 포인터 — 방향에 영향 없음
    expect(input.snapshot().right).toBe(false)
  })

  it('스냅샷의 moveDir/moveAnchor/movePoint가 판정과 일치한다', () => {
    const { ev, snaps } = setup()
    ev('down', 1, LEFT_X, 420)
    ev('move', 1, LEFT_X + 15, 425)
    expect(snaps.at(-1)).toMatchObject({
      moveDir: 1,
      moveAnchor: { x: LEFT_X, y: 420 },
      movePoint: { x: LEFT_X + 15, y: 425 },
    })
    ev('up', 1, LEFT_X + 15, 425)
    expect(snaps.at(-1)).toMatchObject({ moveDir: 0, moveAnchor: null, movePoint: null })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/touch.test.ts`
Expected: the joystick tests FAIL (direction never set); Task 2 tests still PASS.

- [ ] **Step 3: Implement the joystick in `onMove`**

Replace `onMove` in `src/core/touch.ts`:

```ts
  const onMove = (e: PointerLike): void => {
    const t = pointers.get(e.pointerId)
    if (t === undefined || t.suppressed || t.zone !== 'move') return
    t.x = e.clientX
    t.y = e.clientY

    // 따라오는 중심 — |dx| 가 FOLLOW 를 넘으면 anchor 를 손가락 뒤 FOLLOW 지점으로 끌어온다.
    // 그래서 한 방향으로 아무리 밀어도 dx 는 ±FOLLOW 에 머물고, 반전에는 FOLLOW + DEAD 만 필요하다.
    let dx = t.x - t.anchorX
    if (dx > FOLLOW) { t.anchorX = t.x - FOLLOW; dx = FOLLOW }
    else if (dx < -FOLLOW) { t.anchorX = t.x + FOLLOW; dx = -FOLLOW }

    // 경계 포함 — 경계에 닿는 순간 반응해야 반전 거리가 정확히 FOLLOW + DEAD 가 된다
    const next: Dir = dx >= DEAD ? 1 : dx <= -DEAD ? -1 : 0
    setDir(t, next)
    publish()
  }
```

- [ ] **Step 4: Run the touch tests**

Run: `npx vitest run tests/core/touch.test.ts`
Expected: all PASS.

- [ ] **Step 5: Run everything and commit**

Run: `npm test`

```bash
git add src/core/touch.ts tests/core/touch.test.ts
git commit -m "feat(touch): relative joystick with inclusive dead zone and following anchor"
```

---

### Task 4: `reset()` with suppressed pointers

**Files:**
- Modify: `src/core/touch.ts` (`reset`, and `onUp` already handles suppressed via `releaseActions`)
- Test: `tests/core/touch.test.ts`

**Interfaces:**
- Consumes: Task 2/3.
- Produces: `reset()` semantics per spec 4.6.

- [ ] **Step 1: Write the failing tests**

Append to `tests/core/touch.test.ts`:

```ts
describe('createTouch — reset() (모달용, suppressed)', () => {
  it('reset은 액션을 해제하지만 손가락은 존을 계속 점유한다', () => {
    const { input, touch, ev } = setup()
    ev('down', 1, RIGHT_X); input.consume()
    ev('down', 2, LEFT_X); ev('move', 2, LEFT_X + 30)
    touch.reset()
    expect(input.snapshot().jumpHeld).toBe(false)
    expect(input.snapshot().right).toBe(false)

    // suppressed 손가락이 떠 있는 동안 같은 존의 새 down 은 무시된다
    ev('down', 3, RIGHT_X)
    expect(input.snapshot().jumpPressed).toBe(false)
    ev('down', 4, LEFT_X); ev('move', 4, LEFT_X + 30)
    expect(input.snapshot().right).toBe(false)
  })

  it('suppressed 손가락의 move는 무시되고 up은 제거만 한다 — 그 뒤 새 down은 정상 엣지', () => {
    const { input, touch, ev } = setup()
    ev('down', 1, RIGHT_X); input.consume()
    touch.reset()
    ev('move', 1, RIGHT_X + 5)
    expect(input.snapshot().jumpHeld).toBe(false)
    ev('up', 1, RIGHT_X + 5)
    expect(input.snapshot().jumpHeld).toBe(false)     // 없던 액션을 해제하지 않는다
    ev('down', 2, RIGHT_X)
    expect(input.snapshot().jumpPressed).toBe(true)
  })

  it('reset 뒤 이동 존 suppressed 손가락은 스냅샷에서 사라진다', () => {
    const { touch, ev, snaps } = setup()
    ev('down', 1, LEFT_X); ev('move', 1, LEFT_X + 30)
    touch.reset()
    expect(snaps.at(-1)).toMatchObject({ moveDir: 0, moveAnchor: null, movePoint: null, jumpActive: false })
  })

  it('input.reset()과 touch.reset()의 순서는 결과에 영향이 없다', () => {
    const run = (first: 'input' | 'touch') => {
      const { input, touch, ev } = setup()
      ev('down', 1, RIGHT_X); ev('down', 2, LEFT_X); ev('move', 2, LEFT_X - 40)
      input.handleKeyDown('Space')
      input.consume()
      if (first === 'input') { input.reset(); touch.reset() } else { touch.reset(); input.reset() }
      // 키보드는 실제 keyup 까지 막힌다, 터치는 새 손가락으로 바로 엣지
      input.handleKeyDown('Space')
      const afterKb = input.snapshot()
      ev('up', 1, RIGHT_X)               // 죽은 손가락 제거
      ev('down', 3, RIGHT_X)
      const afterTouch = input.snapshot()
      return { afterKb, afterTouch }
    }
    const a = run('input')
    const b = run('touch')
    expect(a.afterKb).toEqual({ left: false, right: false, jumpHeld: false, jumpPressed: false })
    expect(b.afterKb).toEqual(a.afterKb)
    expect(a.afterTouch.jumpPressed).toBe(true)
    expect(b.afterTouch).toEqual(a.afterTouch)
  })

  it('clear는 suppressed 포인터도 지운다', () => {
    const { input, touch, ev } = setup()
    ev('down', 1, RIGHT_X)
    input.consume()               // 첫 down 의 엣지를 지운다 — 안 지우면 새 down 이 무시돼도 통과한다
    touch.reset()
    touch.clear()
    expect(input.snapshot().jumpHeld).toBe(false)
    ev('down', 2, RIGHT_X)
    expect(input.snapshot().jumpPressed).toBe(true)
    expect(input.snapshot().jumpHeld).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/touch.test.ts`
Expected: 존 점유를 검사하는 첫 테스트가 FAIL한다 — 현재 `reset`은 `clear`와 같아 포인터를 삭제하므로 두 번째 포인터가 허용된다. 나머지 넷은 삭제 구현으로도 통과하는 것이 맞다 (suppressed 여부와 무관한 성질을 검사한다).

- [ ] **Step 3: Implement suppressed reset**

Replace `reset` in `src/core/touch.ts`:

```ts
  const reset = (): void => {
    // 손가락은 아직 화면에 있다 — 삭제하지 않고 죽은 손가락으로 표시한다. 존은 계속
    // 점유되므로 그 손가락이 떠 있는 동안 같은 존의 새 down 은 무시되고, 실제 up 후
    // 다음 down 이 진짜 엣지가 된다. 키보드의 kbJumpBlocked 와 같은 체감이지만
    // 메커니즘은 존 점유다.
    for (const t of pointers.values()) {
      releaseActions(t)
      t.suppressed = true
      t.dir = 0
    }
    publish()
  }
```

`onUp` already skips action release for suppressed pointers because `releaseActions` returns early on `t.suppressed`; `onMove` already ignores suppressed pointers. Nothing else changes.

- [ ] **Step 4: Run the touch tests**

Run: `npx vitest run tests/core/touch.test.ts`
Expected: all PASS.

- [ ] **Step 5: Run everything and commit**

Run: `npm test`

```bash
git add src/core/touch.ts tests/core/touch.test.ts
git commit -m "feat(touch): reset() keeps fingers suppressed so a modal cannot hand a held finger a free jump"
```

---

### Task 5: `attach()` — DOM wiring with pointer capture and touchmove guard

**Files:**
- Modify: `src/core/touch.ts` (`attach`)
- Test: `tests/core/touch.test.ts`

**Interfaces:**
- Consumes: Task 2's `TouchTarget`.
- Produces: `attach(el: TouchTarget): () => void` — registers `pointerdown/move/up/cancel`, `lostpointercapture`, `touchmove {passive:false}`; calls `clear()` on attach and on detach.

- [ ] **Step 1: Write the failing tests**

Append to `tests/core/touch.test.ts`:

```ts
type Handler = (e: unknown) => void

function fakeElement() {
  const handlers: Record<string, Handler> = {}
  const removed: string[] = []
  const options: Record<string, unknown> = {}
  const captured: number[] = []
  const el = {
    addEventListener: (type: string, fn: Handler, opts?: unknown) => { handlers[type] = fn; options[type] = opts },
    removeEventListener: (type: string) => { removed.push(type) },
    setPointerCapture: (id: number) => { captured.push(id) },
  }
  return { el, handlers, removed, options, captured }
}

describe('createTouch — attach()', () => {
  it('pointer 이벤트를 handlePointer로 넘기고 down에서 setPointerCapture를 부른다', () => {
    const { input, touch } = setup()
    const { el, handlers, captured } = fakeElement()
    touch.attach(el)
    handlers['pointerdown']!({ pointerId: 4, clientX: RIGHT_X, clientY: 10, pointerType: 'touch' })
    expect(captured).toEqual([4])
    expect(input.snapshot().jumpHeld).toBe(true)
    handlers['pointerup']!({ pointerId: 4, clientX: RIGHT_X, clientY: 10, pointerType: 'touch' })
    expect(input.snapshot().jumpHeld).toBe(false)
  })

  it('pointercancel과 lostpointercapture는 cancel로 처리된다', () => {
    const { input, touch } = setup()
    const { el, handlers } = fakeElement()
    touch.attach(el)
    handlers['pointerdown']!({ pointerId: 1, clientX: RIGHT_X, clientY: 10, pointerType: 'touch' })
    handlers['pointercancel']!({ pointerId: 1, clientX: RIGHT_X, clientY: 10, pointerType: 'touch' })
    expect(input.snapshot().jumpHeld).toBe(false)

    handlers['pointerdown']!({ pointerId: 2, clientX: RIGHT_X, clientY: 10, pointerType: 'touch' })
    handlers['lostpointercapture']!({ pointerId: 2, clientX: RIGHT_X, clientY: 10, pointerType: 'touch' })
    expect(input.snapshot().jumpHeld).toBe(false)
  })

  it('touchmove는 passive:false 로 등록되고 preventDefault 를 부른다', () => {
    const { touch } = setup()
    const { el, handlers, options } = fakeElement()
    touch.attach(el)
    expect(options['touchmove']).toEqual({ passive: false })
    let prevented = 0
    handlers['touchmove']!({ preventDefault: () => { prevented += 1 } })
    expect(prevented).toBe(1)
  })

  it('detach는 리스너를 전부 떼고 clear 한다 — 눌린 채 끝난 손가락이 다음 attach 의 존을 점유하지 않는다', () => {
    const { input, touch } = setup()
    const { el, handlers, removed } = fakeElement()
    const detach = touch.attach(el)
    handlers['pointerdown']!({ pointerId: 1, clientX: RIGHT_X, clientY: 10, pointerType: 'touch' })
    input.consume()
    detach()
    expect(input.snapshot().jumpHeld).toBe(false)
    expect(removed.sort()).toEqual(
      ['lostpointercapture', 'pointercancel', 'pointerdown', 'pointermove', 'pointerup', 'touchmove'],
    )
    // 재attach 후 같은 존의 새 손가락은 정상
    const second = fakeElement()
    touch.attach(second.el)
    second.handlers['pointerdown']!({ pointerId: 9, clientX: RIGHT_X, clientY: 10, pointerType: 'touch' })
    expect(input.snapshot().jumpPressed).toBe(true)
  })

  it('setPointerCapture 가 없거나 던져도 attach 는 동작한다', () => {
    const { input, touch } = setup()
    const handlers: Record<string, Handler> = {}
    const el = {
      addEventListener: (type: string, fn: Handler) => { handlers[type] = fn },
      removeEventListener: () => {},
      setPointerCapture: () => { throw new Error('InvalidStateError') },
    }
    touch.attach(el)
    handlers['pointerdown']!({ pointerId: 1, clientX: RIGHT_X, clientY: 10, pointerType: 'touch' })
    expect(input.snapshot().jumpHeld).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/touch.test.ts`
Expected: attach tests FAIL with `attach 는 Task 5 에서 구현한다`.

- [ ] **Step 3: Implement `attach`**

Replace the `attach` stub in `src/core/touch.ts`:

```ts
  const attach = (el: TouchTarget): (() => void) => {
    clear()   // 이전 판에서 눌린 채 끝난 손가락이 남아 있으면 안 된다

    type PE = { pointerId: number; clientX: number; clientY: number; pointerType?: string }
    const toLike = (type: PointerLike['type']) => (e: PE) =>
      handlePointer({ type, pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, pointerType: e.pointerType })

    const onDown = (e: PE) => {
      // 손가락이 요소 밖으로 나가도 up 을 받는다. 일부 환경은 여기서 던지므로 삼킨다.
      try { el.setPointerCapture?.(e.pointerId) } catch { /* 캡처 실패는 치명적이지 않다 */ }
      toLike('down')(e)
    }
    const onMove = toLike('move')
    const onUp = toLike('up')
    // lostpointercapture 는 up 뒤에도 한 번 더 오지만 그때는 이미 목록에 없는 포인터라 무시된다
    const onCancel = toLike('cancel')
    // iOS 러버밴드 안전망 — .game-layer 의 touch-action: none 이 못 막는 스크롤을 잡는다
    const onTouchMove = (e: { preventDefault(): void }) => { e.preventDefault() }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    el.addEventListener('lostpointercapture', onCancel)
    el.addEventListener('touchmove', onTouchMove, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('lostpointercapture', onCancel)
      el.removeEventListener('touchmove', onTouchMove)
      clear()   // 리스너가 떨어진 뒤에는 up 을 영영 못 받는다 — 목록을 비운다
    }
  }
```

- [ ] **Step 4: Run the touch tests**

Run: `npx vitest run tests/core/touch.test.ts`
Expected: all PASS.

- [ ] **Step 5: Run everything and commit**

Run: `npm test`

```bash
git add src/core/touch.ts tests/core/touch.test.ts
git commit -m "feat(touch): attach pointer/touch listeners with capture, cancel mapping and clear on detach"
```

---

### Task 6: Save schema — `controlsHintSeen`, v3 migration

**Files:**
- Modify: `src/core/storage.ts`
- Test: `tests/core/storage.test.ts`

**Interfaces:**
- Produces: `SaveData.controlsHintSeen: boolean`, `SAVE_VERSION = 3`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/core/storage.test.ts` (inside the file's top-level scope, after the existing describes):

```ts
describe('parseSave — v3 controlsHintSeen', () => {
  it('기본값은 false 다', () => {
    expect(defaultSave().controlsHintSeen).toBe(false)
    expect(SAVE_VERSION).toBe(3)
  })

  it('controlsHintSeen 없는 v2 저장이 나머지를 초기화하지 않고 병합된다', () => {
    const v2 = JSON.stringify({
      version: 2,
      bestHeight: 1200, totalRuns: 3, thread: 7, coins: 40,
      ownedOutfits: [DEFAULT_OUTFIT_ID], equippedOutfit: DEFAULT_OUTFIT_ID,
      upgrades: { jump: 1, energy: 0, air: 0, magnet: 0 },
      consumables: { rocket: 0, feather: 1, cushion: 0, doubleJump: 0 },
      selectedConsumables: [], seenQuizIds: ['q1'], recentRuns: [1200],
    })
    const out = parseSave(v2, VALID)
    expect(out.version).toBe(SAVE_VERSION)
    expect(out.controlsHintSeen).toBe(false)
    expect(out.bestHeight).toBe(1200)
    expect(out.recentRuns).toEqual([1200])
    expect(out.seenQuizIds).toEqual(['q1'])
  })

  it('true 는 보존되고 불리언이 아니면 false 다', () => {
    expect(parseSave(JSON.stringify({ version: SAVE_VERSION, controlsHintSeen: true }), VALID).controlsHintSeen).toBe(true)
    expect(parseSave(JSON.stringify({ version: SAVE_VERSION, controlsHintSeen: 'yes' }), VALID).controlsHintSeen).toBe(false)
    expect(parseSave(JSON.stringify({ version: SAVE_VERSION, controlsHintSeen: 1 }), VALID).controlsHintSeen).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/storage.test.ts`
Expected: the three new tests FAIL (`SAVE_VERSION` is 2, field missing).

- [ ] **Step 3: Implement**

In `src/core/storage.ts`:

1. `export const SAVE_VERSION = 3`
2. Add to `SaveData` after `recentRuns`:
   ```ts
     /** 첫 판 조작 안내를 이미 보여줬는가 (터치/키보드 공통) */
     controlsHintSeen: boolean
   ```
3. Add to `defaultSave()` return: `controlsHintSeen: false,`
4. In `migrate()` after the v1→v2 block:
   ```ts
     // v2 → v3: controlsHintSeen 필드 추가. 순수 추가 필드라 3단계 병합이 기본값(false)을
     // 채워준다 — version 번호만 전진시킨다.
     if ((cur['version'] as number) < 3) {
       cur = { ...cur, version: 3 }
     }
   ```
5. In the `merged` literal after `recentRuns:` add:
   ```ts
       controlsHintSeen: migrated['controlsHintSeen'] === true,
   ```

- [ ] **Step 4: Run storage tests, then everything**

Run: `npx vitest run tests/core/storage.test.ts` → all PASS.
Run: `npm test` → all PASS. (Other tests that build `SaveData` via `defaultSave()`/spreads keep working; if any test constructs a `SaveData` literal by hand and now fails type-check in `npm run build`, add `controlsHintSeen: false` to that literal.)
Run: `npm run build` → PASS (tsc is the gate; fix any literal that misses the new field).

- [ ] **Step 5: Commit**

```bash
git add src/core/storage.ts tests/core/storage.test.ts
git commit -m "feat(storage): add controlsHintSeen and bump save schema to v3"
```

---

### Task 7: Pure hint state machine (`ui/touchHint.ts`)

**Files:**
- Create: `src/ui/touchHint.ts`
- Test: `tests/ui/touchHint.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const HINT_SHOW_MS = 1500
  export const HINT_FADE_MS = 300
  export type HintPhase = 'idle' | 'shown' | 'fading' | 'done'
  export interface HintTimers {
    setTimeout(fn: () => void, ms: number): unknown
    clearTimeout(handle: unknown): void
  }
  export interface HintController {
    start(): void        // idle → shown, 1.5s 후 자동 dismiss
    dismiss(): void      // shown → fading → (0.3s) done + onDone 한 번. 멱등
    dispose(): void      // 타이머 정리, done 으로. onDone 안 부름
    readonly phase: HintPhase
  }
  export function createHintController(opts: {
    enabled: boolean
    onPhase(phase: HintPhase): void
    onDone(): void
    timers?: HintTimers
  }): HintController
  ```

- [ ] **Step 1: Write the failing tests**

Create `tests/ui/touchHint.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { createHintController, HINT_SHOW_MS, HINT_FADE_MS, type HintPhase } from '../../src/ui/touchHint'

/** 수동으로 진행시키는 타이머 */
function fakeTimers() {
  let now = 0
  let seq = 0
  const pending = new Map<number, { at: number; fn: () => void }>()
  return {
    timers: {
      setTimeout: (fn: () => void, ms: number) => { const id = ++seq; pending.set(id, { at: now + ms, fn }); return id },
      clearTimeout: (h: unknown) => { pending.delete(h as number) },
    },
    advance(ms: number) {
      now += ms
      for (const [id, t] of [...pending.entries()].sort((a, b) => a[1].at - b[1].at)) {
        if (t.at <= now) { pending.delete(id); t.fn() }
      }
    },
    pendingCount: () => pending.size,
  }
}

function setup(enabled = true) {
  const ft = fakeTimers()
  const phases: HintPhase[] = []
  const onDone = vi.fn()
  const hint = createHintController({ enabled, onPhase: (p) => { phases.push(p) }, onDone, timers: ft.timers })
  return { ft, phases, onDone, hint }
}

describe('createHintController', () => {
  it('start 후 1.5초가 지나면 fading, 0.3초 뒤 done + onDone 한 번', () => {
    const { ft, phases, onDone, hint } = setup()
    hint.start()
    expect(hint.phase).toBe('shown')
    ft.advance(HINT_SHOW_MS - 1)
    expect(hint.phase).toBe('shown')
    ft.advance(1)
    expect(hint.phase).toBe('fading')
    ft.advance(HINT_FADE_MS)
    expect(hint.phase).toBe('done')
    expect(phases).toEqual(['shown', 'fading', 'done'])
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('dismiss는 shown 타이머를 취소하고 즉시 fading 으로 — 멱등', () => {
    const { ft, onDone, hint } = setup()
    hint.start()
    ft.advance(200)
    hint.dismiss()
    expect(hint.phase).toBe('fading')
    hint.dismiss()                       // 두 번째 — 아무 일도 없다
    ft.advance(HINT_SHOW_MS)             // 원래 show 타이머 시각을 지나도 중복 fade 없음
    expect(hint.phase).toBe('done')
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(ft.pendingCount()).toBe(0)
  })

  it('done 뒤의 dismiss 는 no-op', () => {
    const { ft, onDone, hint } = setup()
    hint.start()
    hint.dismiss()
    ft.advance(HINT_FADE_MS)
    hint.dismiss()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('enabled=false 면 처음부터 done 이고 start/dismiss 가 아무 것도 하지 않는다', () => {
    const { ft, phases, onDone, hint } = setup(false)
    expect(hint.phase).toBe('done')
    hint.start()
    hint.dismiss()
    ft.advance(HINT_SHOW_MS + HINT_FADE_MS)
    expect(phases).toEqual([])
    expect(onDone).not.toHaveBeenCalled()
  })

  it('dispose 는 타이머를 정리하고 onDone 을 부르지 않는다', () => {
    const { ft, onDone, hint } = setup()
    hint.start()
    hint.dispose()
    expect(hint.phase).toBe('done')
    expect(ft.pendingCount()).toBe(0)
    ft.advance(HINT_SHOW_MS + HINT_FADE_MS)
    expect(onDone).not.toHaveBeenCalled()
  })

  it('start 를 두 번 불러도 타이머는 하나다', () => {
    const { ft, hint } = setup()
    hint.start()
    hint.start()
    expect(ft.pendingCount()).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/ui/touchHint.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/ui/touchHint.ts`:

```ts
export const HINT_SHOW_MS = 1500
export const HINT_FADE_MS = 300

export type HintPhase = 'idle' | 'shown' | 'fading' | 'done'

/** 테스트에서 가짜 타이머를 주입하기 위한 최소 표면 */
export interface HintTimers {
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export interface HintController {
  /** idle → shown. HINT_SHOW_MS 뒤 자동으로 dismiss() */
  start(): void
  /** shown → fading → (HINT_FADE_MS) done, onDone 은 딱 한 번. 그 밖의 상태에서는 no-op */
  dismiss(): void
  /** 타이머 정리 + done. onDone 을 부르지 않는다 (언마운트용) */
  dispose(): void
  readonly phase: HintPhase
}

const realTimers: HintTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
}

/**
 * 첫 판 조작 안내의 상태 기계. DOM 을 모른다 — 오버레이가 onPhase 로 클래스를 바꾸고
 * main 이 onDone 으로 save 를 갱신한다.
 */
export function createHintController(opts: {
  enabled: boolean
  onPhase(phase: HintPhase): void
  onDone(): void
  timers?: HintTimers
}): HintController {
  const timers = opts.timers ?? realTimers
  let phase: HintPhase = opts.enabled ? 'idle' : 'done'
  let showTimer: unknown = null
  let fadeTimer: unknown = null

  const setPhase = (next: HintPhase): void => {
    phase = next
    opts.onPhase(next)
  }

  const clearTimers = (): void => {
    if (showTimer !== null) { timers.clearTimeout(showTimer); showTimer = null }
    if (fadeTimer !== null) { timers.clearTimeout(fadeTimer); fadeTimer = null }
  }

  const dismiss = (): void => {
    if (phase !== 'shown') return
    clearTimers()
    setPhase('fading')
    fadeTimer = timers.setTimeout(() => {
      fadeTimer = null
      setPhase('done')
      opts.onDone()
    }, HINT_FADE_MS)
  }

  const start = (): void => {
    if (phase !== 'idle') return
    setPhase('shown')
    showTimer = timers.setTimeout(() => {
      showTimer = null
      dismiss()
    }, HINT_SHOW_MS)
  }

  const dispose = (): void => {
    clearTimers()
    phase = 'done'   // onPhase/onDone 없이 조용히 끝낸다 — DOM 은 곧 사라진다
  }

  return {
    start, dismiss, dispose,
    get phase() { return phase },
  }
}
```

- [ ] **Step 4: Run hint tests, then everything**

Run: `npx vitest run tests/ui/touchHint.test.ts` → PASS.
Run: `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/touchHint.ts tests/ui/touchHint.test.ts
git commit -m "feat(ui): first-run controls hint state machine with injectable timers"
```

---

### Task 8: Touch overlay DOM (`ui/touchOverlay.ts`) + jsdom

**Files:**
- Modify: `package.json` (add `jsdom` devDependency)
- Create: `src/ui/touchOverlay.ts`
- Test: `tests/ui/touchOverlay.test.ts` (jsdom environment)

**Interfaces:**
- Consumes: `TouchController.subscribe`, `TouchSnapshot`, `FOLLOW` (Task 2), `createHintController` (Task 7).
- Produces:
  ```ts
  export interface TouchOverlayOptions {
    showHint: boolean
    onHintDone(): void
    isCoarse?: () => boolean     // 기본: matchMedia('(pointer: coarse)').matches
  }
  export interface MountedTouchOverlay {
    dismissHint(): void
    unmount(): void
  }
  export function mountTouchOverlay(gameLayer: HTMLElement, touch: Pick<TouchController, 'subscribe'>, opts: TouchOverlayOptions): MountedTouchOverlay
  ```
  DOM contract (tests and CSS depend on these class names):
  - root `div.touch-overlay`, gets `touch-overlay-glyphs-hidden` while glyphs are hidden
  - `div.touch-track.touch-track-rest` with children `span.touch-track-arrow` ×2 (`◀`, `▶`) and `span.touch-knob`; gets `is-active` while `moveAnchor !== null`; knob `style.transform = translateX(<px>)` where px = `moveDir * TRACK_HALF`
  - `div.touch-track.touch-track-live` positioned via `style.left/top` at `moveAnchor`; `hidden` attribute when no anchor; knob translateX = clamp((movePoint.x − moveAnchor.x)/FOLLOW, −1, 1) × TRACK_HALF
  - `div.touch-jump-glyph` (`●`); gets `is-active` while `jumpActive`
  - `div.touch-hint` with text; classes `touch-hint-shown` / `touch-hint-fading`; removed from DOM on `done`; not created when `showHint` is false
  - the overlay dismisses the hint itself as soon as a snapshot has `moveAnchor !== null || jumpActive` (a move-zone `down` at `dir = 0` is invisible in `InputState`); `main.ts` additionally calls `dismissHint()` for keyboard input
  - `export const TRACK_HALF = 32` (track is 96px wide)

- [ ] **Step 1: Install jsdom**

Run: `npm install -D jsdom`
Expected: `package.json` devDependencies gains `"jsdom"`; `npm test` still passes (env is still `node` globally — the overlay test opts in per file).

- [ ] **Step 2: Write the failing tests**

Create `tests/ui/touchOverlay.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountTouchOverlay, TRACK_HALF } from '../../src/ui/touchOverlay'
import { FOLLOW, type TouchSnapshot } from '../../src/core/touch'
import { HINT_SHOW_MS, HINT_FADE_MS } from '../../src/ui/touchHint'

const idle: TouchSnapshot = { moveAnchor: null, movePoint: null, moveDir: 0, jumpActive: false, lastPointerType: null }

function fakeTouch() {
  let cb: ((s: TouchSnapshot) => void) | null = null
  return {
    subscribe: (fn: (s: TouchSnapshot) => void) => { cb = fn; return () => { cb = null } },
    emit: (s: Partial<TouchSnapshot>) => { cb?.({ ...idle, ...s }) },
    subscribed: () => cb !== null,
  }
}

function setup(opts: { showHint?: boolean; isCoarse?: boolean } = {}) {
  const layer = document.createElement('div')
  document.body.appendChild(layer)
  const touch = fakeTouch()
  const onHintDone = vi.fn()
  const mounted = mountTouchOverlay(layer, touch, {
    showHint: opts.showHint ?? true,
    onHintDone,
    isCoarse: () => opts.isCoarse ?? true,
  })
  const q = <T extends Element>(sel: string) => layer.querySelector<T>(sel)
  return { layer, touch, onHintDone, mounted, q }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = '' })

describe('mountTouchOverlay — 구조', () => {
  it('트랙·점프 글리프·안내를 gameLayer 안에 만든다', () => {
    const { q } = setup()
    expect(q('.touch-overlay')).not.toBeNull()
    expect(q('.touch-track.touch-track-rest .touch-knob')).not.toBeNull()
    expect(q('.touch-track.touch-track-live')).not.toBeNull()
    expect(q('.touch-jump-glyph')).not.toBeNull()
    expect(q('.touch-hint')?.textContent).toBe('왼쪽 밀어서 이동 · 오른쪽 길게 눌러 점프')
  })

  it('unmount 는 DOM 을 제거하고 구독을 해제한다', () => {
    const { layer, touch, mounted } = setup()
    mounted.unmount()
    expect(layer.querySelector('.touch-overlay')).toBeNull()
    expect(touch.subscribed()).toBe(false)
  })
})

describe('mountTouchOverlay — 스냅샷 반영', () => {
  it('moveDir 에 따라 rest 트랙 노브가 좌/중/우로 옮겨지고 활성 클래스가 붙는다', () => {
    const { touch, q } = setup()
    touch.emit({ moveAnchor: { x: 50, y: 500 }, movePoint: { x: 70, y: 500 }, moveDir: 1 })
    const rest = q<HTMLElement>('.touch-track-rest')!
    expect(rest.classList.contains('is-active')).toBe(true)
    expect(q<HTMLElement>('.touch-track-rest .touch-knob')!.style.transform).toBe(`translateX(${TRACK_HALF}px)`)
    touch.emit(idle)
    expect(rest.classList.contains('is-active')).toBe(false)
    expect(q<HTMLElement>('.touch-track-rest .touch-knob')!.style.transform).toBe('translateX(0px)')
  })

  it('live 트랙은 anchor 위치에 뜨고 손가락 오프셋을 ±FOLLOW → ±TRACK_HALF 로 매핑한다', () => {
    const { touch, q } = setup()
    const live = q<HTMLElement>('.touch-track-live')!
    expect(live.hidden).toBe(true)
    touch.emit({ moveAnchor: { x: 120, y: 480 }, movePoint: { x: 120 + FOLLOW / 2, y: 480 }, moveDir: 1 })
    expect(live.hidden).toBe(false)
    expect(live.style.left).toBe('120px')
    expect(live.style.top).toBe('480px')
    expect(q<HTMLElement>('.touch-track-live .touch-knob')!.style.transform).toBe(`translateX(${TRACK_HALF / 2}px)`)
    // FOLLOW 를 넘는 오프셋은 잘린다
    touch.emit({ moveAnchor: { x: 120, y: 480 }, movePoint: { x: 120 + FOLLOW * 3, y: 480 }, moveDir: 1 })
    expect(q<HTMLElement>('.touch-track-live .touch-knob')!.style.transform).toBe(`translateX(${TRACK_HALF}px)`)
  })

  it('jumpActive 가 점프 글리프의 활성 클래스를 토글한다', () => {
    const { touch, q } = setup()
    touch.emit({ jumpActive: true })
    expect(q('.touch-jump-glyph')!.classList.contains('is-active')).toBe(true)
    touch.emit({ jumpActive: false })
    expect(q('.touch-jump-glyph')!.classList.contains('is-active')).toBe(false)
  })
})

describe('mountTouchOverlay — 표시 조건', () => {
  it('coarse 가 아니면 글리프를 숨기고 키보드 문구를 쓴다', () => {
    const { q } = setup({ isCoarse: false })
    expect(q('.touch-overlay')!.classList.contains('touch-overlay-glyphs-hidden')).toBe(true)
    expect(q('.touch-hint')?.textContent).toBe('← → 이동 · Space 길게 눌러 점프')
  })

  it('숨긴 상태에서 touch 포인터 스냅샷이 오면 글리프를 보인다', () => {
    const { touch, q } = setup({ isCoarse: false })
    touch.emit({ lastPointerType: 'mouse', jumpActive: true })
    expect(q('.touch-overlay')!.classList.contains('touch-overlay-glyphs-hidden')).toBe(true)
    touch.emit({ lastPointerType: 'touch', jumpActive: true })
    expect(q('.touch-overlay')!.classList.contains('touch-overlay-glyphs-hidden')).toBe(false)
  })
})

describe('mountTouchOverlay — 안내', () => {
  it('마운트 직후 shown, dismissHint 로 fading, 0.3초 뒤 제거 + onHintDone 한 번', () => {
    const { q, mounted, onHintDone } = setup()
    expect(q('.touch-hint')!.classList.contains('touch-hint-shown')).toBe(true)
    mounted.dismissHint()
    expect(q('.touch-hint')!.classList.contains('touch-hint-fading')).toBe(true)
    mounted.dismissHint()
    vi.advanceTimersByTime(HINT_FADE_MS)
    expect(q('.touch-hint')).toBeNull()
    expect(onHintDone).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(HINT_SHOW_MS)
    expect(onHintDone).toHaveBeenCalledTimes(1)
  })

  it('활성 포인터가 보이면 오버레이가 스스로 안내를 내린다 — 이동 존 down 직후(dir=0)도 포함', () => {
    // 이동 존을 처음 누르면 12px 밀기 전까지 InputState 는 전부 false 다. main 의 스냅샷
    // 검사만으로는 "화면을 눌렀는데 안내가 안 내려가는" 구간이 생기므로 오버레이가
    // moveAnchor/jumpActive 를 직접 본다.
    const { touch, q, onHintDone } = setup()
    touch.emit({ moveAnchor: { x: 50, y: 500 }, movePoint: { x: 50, y: 500 }, moveDir: 0 })
    expect(q('.touch-hint')!.classList.contains('touch-hint-fading')).toBe(true)
    vi.advanceTimersByTime(HINT_FADE_MS)
    expect(onHintDone).toHaveBeenCalledTimes(1)
  })

  it('jumpActive 스냅샷도 안내를 내린다', () => {
    const { touch, q } = setup()
    touch.emit({ jumpActive: true })
    expect(q('.touch-hint')!.classList.contains('touch-hint-fading')).toBe(true)
  })

  it('1.5초가 지나면 스스로 페이드한다', () => {
    const { q, onHintDone } = setup()
    vi.advanceTimersByTime(HINT_SHOW_MS)
    expect(q('.touch-hint')!.classList.contains('touch-hint-fading')).toBe(true)
    vi.advanceTimersByTime(HINT_FADE_MS)
    expect(onHintDone).toHaveBeenCalledTimes(1)
  })

  it('showHint=false 면 안내 DOM 이 없고 dismissHint 는 no-op, onHintDone 은 안 불린다', () => {
    const { q, mounted, onHintDone } = setup({ showHint: false })
    expect(q('.touch-hint')).toBeNull()
    mounted.dismissHint()
    vi.advanceTimersByTime(HINT_SHOW_MS + HINT_FADE_MS)
    expect(onHintDone).not.toHaveBeenCalled()
  })

  it('unmount 는 진행 중 타이머를 정리하고 onHintDone 을 부르지 않는다', () => {
    const { mounted, onHintDone } = setup()
    mounted.unmount()
    vi.advanceTimersByTime(HINT_SHOW_MS + HINT_FADE_MS)
    expect(onHintDone).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/ui/touchOverlay.test.ts`
Expected: FAIL — module not found. (If it fails with "jsdom not installed", redo Step 1.)

- [ ] **Step 4: Implement `src/ui/touchOverlay.ts`**

```ts
import type { TouchController, TouchSnapshot } from '../core/touch'
import { FOLLOW } from '../core/touch'
import { createHintController, type HintPhase } from './touchHint'

/** 트랙 폭 96px 의 절반 — 노브가 움직이는 최대 거리 */
export const TRACK_HALF = 32

const HINT_TOUCH = '왼쪽 밀어서 이동 · 오른쪽 길게 눌러 점프'
const HINT_KEYBOARD = '← → 이동 · Space 길게 눌러 점프'

export interface TouchOverlayOptions {
  showHint: boolean
  /** 안내가 끝났을 때 딱 한 번 — main 이 save 갱신·저장 */
  onHintDone(): void
  /** 기본 matchMedia('(pointer: coarse)'). 테스트 주입용 */
  isCoarse?: () => boolean
}

export interface MountedTouchOverlay {
  /** 멱등 — 여러 번 불려도 타이머·onHintDone 중복 없음 */
  dismissHint(): void
  /** 구독 해제 + DOM 제거 + 남은 타이머 정리. 안내가 진행 중이었으면 onHintDone 은 부르지 않는다 */
  unmount(): void
}

const defaultIsCoarse = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

function buildTrack(extraClass: string): { track: HTMLDivElement; knob: HTMLSpanElement } {
  const track = document.createElement('div')
  track.className = `touch-track ${extraClass}`
  const left = document.createElement('span')
  left.className = 'touch-track-arrow'
  left.textContent = '◀'
  const knob = document.createElement('span')
  knob.className = 'touch-knob'
  const right = document.createElement('span')
  right.className = 'touch-track-arrow'
  right.textContent = '▶'
  track.append(left, knob, right)
  return { track, knob }
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/**
 * 판 중 캔버스 위에 겹치는 순수 DOM 오버레이. pointer-events: none — 판정은 gameLayer 가
 * 하고 여기서는 스냅샷을 그림으로 옮기기만 한다. save 를 모른다.
 */
export function mountTouchOverlay(
  gameLayer: HTMLElement,
  touch: Pick<TouchController, 'subscribe'>,
  opts: TouchOverlayOptions,
): MountedTouchOverlay {
  const isCoarse = opts.isCoarse ?? defaultIsCoarse
  let glyphsVisible = isCoarse()

  const root = document.createElement('div')
  root.className = 'touch-overlay'
  root.classList.toggle('touch-overlay-glyphs-hidden', !glyphsVisible)

  const rest = buildTrack('touch-track-rest')
  const live = buildTrack('touch-track-live')
  live.track.hidden = true

  const jump = document.createElement('div')
  jump.className = 'touch-jump-glyph'
  jump.textContent = '●'

  root.append(rest.track, live.track, jump)

  // ── 첫 판 안내 ──
  let hintEl: HTMLDivElement | null = null
  if (opts.showHint) {
    hintEl = document.createElement('div')
    hintEl.className = 'touch-hint type-caption'
    hintEl.textContent = glyphsVisible ? HINT_TOUCH : HINT_KEYBOARD
    root.appendChild(hintEl)
  }
  const onPhase = (phase: HintPhase): void => {
    if (hintEl === null) return
    hintEl.classList.toggle('touch-hint-shown', phase === 'shown')
    hintEl.classList.toggle('touch-hint-fading', phase === 'fading')
    if (phase === 'done') { hintEl.remove(); hintEl = null }
  }
  const hint = createHintController({ enabled: opts.showHint, onPhase, onDone: opts.onHintDone })

  gameLayer.appendChild(root)
  hint.start()

  const render = (s: TouchSnapshot): void => {
    if (!glyphsVisible && s.lastPointerType === 'touch') {
      glyphsVisible = true
      root.classList.remove('touch-overlay-glyphs-hidden')
    }

    const active = s.moveAnchor !== null
    // 손가락이 닿은 순간 안내를 내린다 — 이동 존 down 직후는 dir=0 이라 InputState 로는
    // 보이지 않는다. 키보드는 main 이 스냅샷 플래그로 dismissHint 를 부른다. 멱등이라 겹쳐도 무해.
    if (active || s.jumpActive) hint.dismiss()
    rest.track.classList.toggle('is-active', active)
    rest.knob.style.transform = `translateX(${s.moveDir * TRACK_HALF}px)`

    if (s.moveAnchor !== null && s.movePoint !== null) {
      live.track.hidden = false
      live.track.style.left = `${s.moveAnchor.x}px`
      live.track.style.top = `${s.moveAnchor.y}px`
      const ratio = clamp((s.movePoint.x - s.moveAnchor.x) / FOLLOW, -1, 1)
      live.knob.style.transform = `translateX(${ratio * TRACK_HALF}px)`
    } else {
      live.track.hidden = true
    }

    jump.classList.toggle('is-active', s.jumpActive)
  }

  const unsubscribe = touch.subscribe(render)

  return {
    dismissHint: () => { hint.dismiss() },
    unmount: () => {
      unsubscribe()
      hint.dispose()
      root.remove()
    },
  }
}
```

- [ ] **Step 5: Run overlay tests, then everything**

Run: `npx vitest run tests/ui/touchOverlay.test.ts` → PASS.
Run: `npm test` → PASS.
Run: `npm run build` → PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/ui/touchOverlay.ts tests/ui/touchOverlay.test.ts
git commit -m "feat(ui): touch overlay with slider tracks, jump glyph and first-run hint"
```

---

### Task 9: Swipe-back adapter (`toss/screen.ts`)

**Files:**
- Create: `src/toss/screen.ts`
- Test: `tests/toss/screen.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type SwipeBackFn = ((options: { isEnabled: boolean }) => Promise<void>) & { isSupported?: () => boolean }
  export function createSwipeBack(loadSdk: () => Promise<SwipeBackFn | null>): { set(enabled: boolean): Promise<void> }
  export function setSwipeBack(enabled: boolean): Promise<void>   // 기본 인스턴스 — 동적 import 로더 사용
  ```

- [ ] **Step 1: Write the failing tests**

Create `tests/toss/screen.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { createSwipeBack, type SwipeBackFn } from '../../src/toss/screen'

/** 호출 순서를 손으로 풀어주는 SDK 흉내 */
function deferredSdk() {
  const calls: boolean[] = []
  const resolvers: Array<() => void> = []
  const fn = vi.fn((o: { isEnabled: boolean }) => new Promise<void>((resolve) => {
    calls.push(o.isEnabled)
    resolvers.push(resolve)
  })) as unknown as SwipeBackFn
  return { fn, calls, resolveNext: () => { resolvers.shift()?.() } }
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0))

describe('createSwipeBack', () => {
  it('SDK 가 없으면 아무 것도 하지 않고 resolve 한다', async () => {
    const sb = createSwipeBack(async () => null)
    await expect(sb.set(false)).resolves.toBeUndefined()
  })

  it('isSupported 가 false 면 부르지 않는다', async () => {
    const sdk = deferredSdk()
    sdk.fn.isSupported = () => false
    const sb = createSwipeBack(async () => sdk.fn)
    await sb.set(false)
    expect(sdk.calls).toEqual([])
  })

  it('호출을 직렬화한다 — 앞 호출이 끝나기 전에는 다음을 보내지 않는다', async () => {
    const sdk = deferredSdk()
    const sb = createSwipeBack(async () => sdk.fn)
    void sb.set(false)
    void sb.set(true)
    await flush()
    expect(sdk.calls).toEqual([false])      // 두 번째는 대기 중
    sdk.resolveNext()
    await flush()
    expect(sdk.calls).toEqual([false, true])
  })

  it('마지막으로 요청한 값과 같으면 스킵한다', async () => {
    // SDK 호출은 chain.then 안에서 비동기로 시작된다 — resolveNext 는 반드시 호출이
    // 실제로 일어난 것을(calls) 확인한 뒤에 부른다. 그 전에 부르면 빈 큐를 건드릴 뿐이다.
    const sdk = deferredSdk()
    const sb = createSwipeBack(async () => sdk.fn)
    void sb.set(false)
    await flush()
    expect(sdk.calls).toEqual([false])
    sdk.resolveNext()
    await flush()

    void sb.set(false)                       // 같은 값 — 보내지 않는다
    await flush()
    expect(sdk.calls).toEqual([false])

    void sb.set(true)
    await flush()
    expect(sdk.calls).toEqual([false, true])
    sdk.resolveNext()
    await flush()
  })

  it('SDK 가 던져도 삼키고 다음 호출은 계속된다', async () => {
    let n = 0
    const fn = vi.fn(async () => { n += 1; if (n === 1) throw new Error('boom') }) as unknown as SwipeBackFn
    const sb = createSwipeBack(async () => fn)
    await expect(sb.set(false)).resolves.toBeUndefined()
    await sb.set(true)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('로더가 던져도 삼킨다', async () => {
    const sb = createSwipeBack(async () => { throw new Error('no module') })
    await expect(sb.set(false)).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/toss/screen.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/toss/screen.ts`:

```ts
/**
 * 앱인토스 화면 제어 래퍼. 게임 코드는 이 모듈만 보고, SDK 유무·실패는 여기서 삼킨다.
 * 브라우저(SDK 없음)에서는 전부 no-op 이다.
 */

export type SwipeBackFn =
  ((options: { isEnabled: boolean }) => Promise<void>) & { isSupported?: () => boolean }

/**
 * iOS 스와이프백 on/off. 호출은 직렬화된다 — 앞 요청이 네이티브에 도달하기 전에 다음을 보내면
 * 도착 순서가 뒤집혀 로비에서 스와이프백이 꺼진 채 남을 수 있다. 마지막으로 요청한 값과 같은
 * 요청은 보내지 않는다.
 */
export function createSwipeBack(loadSdk: () => Promise<SwipeBackFn | null>): { set(enabled: boolean): Promise<void> } {
  let chain: Promise<void> = Promise.resolve()
  let lastRequested: boolean | null = null

  const set = (enabled: boolean): Promise<void> => {
    if (lastRequested === enabled) return chain
    lastRequested = enabled
    chain = chain.then(async () => {
      try {
        const fn = await loadSdk()
        if (fn === null) return
        if (fn.isSupported !== undefined && !fn.isSupported()) return
        await fn({ isEnabled: enabled })
      } catch {
        // SDK 없음·브리지 없음·네이티브 거부 — 게임 진행에 영향을 주지 않는다
      }
    })
    return chain
  }

  return { set }
}

// 패키지 이름을 변수에 두어 Vite 가 빌드 시 해석하지 않게 한다 — 아직 설치되지 않은
// 환경(일반 웹 빌드)에서는 런타임 import 가 실패하고 위 try/catch 가 삼킨다.
// 앱인토스 이식 시 @apps-in-toss/web-framework 를 설치하면 그대로 살아난다.
// (export 이름은 스펙 7.4 선행 확인 항목 — 다르면 아래 한 줄만 고친다)
const SDK_MODULE = '@apps-in-toss/web-framework'
const SDK_EXPORT = 'setIosSwipeGestureEnabled'

async function loadFromSdk(): Promise<SwipeBackFn | null> {
  const mod = (await import(/* @vite-ignore */ SDK_MODULE)) as Record<string, unknown>
  const fn = mod[SDK_EXPORT]
  return typeof fn === 'function' ? (fn as SwipeBackFn) : null
}

const defaultSwipeBack = createSwipeBack(loadFromSdk)

export const setSwipeBack = (enabled: boolean): Promise<void> => defaultSwipeBack.set(enabled)
```

- [ ] **Step 4: Run tests and build**

Run: `npx vitest run tests/toss/screen.test.ts` → PASS.
Run: `npm test` → PASS.
Run: `npm run build` → PASS. If Vite still warns/fails on the dynamic import, confirm the `/* @vite-ignore */` comment is directly inside `import(` and the specifier is the `SDK_MODULE` variable, not a literal.

- [ ] **Step 5: Commit**

```bash
git add src/toss/screen.ts tests/toss/screen.test.ts
git commit -m "feat(toss): serialized swipe-back adapter that no-ops without the SDK"
```

---

### Task 10: CSS — WebView hardening and overlay styles

**Files:**
- Modify: `src/ui/styles.css`

**Interfaces:**
- Consumes: class names from Task 8's DOM contract.

- [ ] **Step 1: Add WebView rules**

In `src/ui/styles.css`, change the `body` rule and `.game-layer` rule:

```css
body {
  background: var(--surface-soft);
  color: var(--text-body);
  font-family: var(--font-body);
  min-height: 100vh;
  touch-action: manipulation;   /* 더블탭 줌 제거. 스크롤·핀치는 그대로 — 로비/상점은 일반 문서다 */
}
```

```css
.game-layer {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-soft);
  /* 판 중: 스크롤·핀치·풀투리프레시 차단, 롱프레스 선택/메뉴 차단.
     overscroll-behavior 는 body 에 두지 않는다 — 로비·상점의 스크롤 감각까지 바꾼다.
     여기서 못 막는 iOS 러버밴드는 touch.ts 의 touchmove preventDefault 가 잡는다. */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
```

- [ ] **Step 2: Add overlay styles**

Append before the `/* ── Mobile ─── */` block:

```css
/* ── Touch controls overlay ──────────────────────────────────────
   gameLayer 안에서 캔버스 위에 겹친다. pointer-events: none — 판정은 gameLayer 가 하고
   여기는 그림만이다. 좌표는 CSS px (손가락 좌표계)라 캔버스 HUD(논리 180×320)와 섞지 않는다. */
.touch-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  --touch-glyph: rgba(255, 255, 255, 0.95);
  --touch-glyph-outline: rgba(0, 0, 0, 0.55);
  --touch-glyph-idle: 0.25;
  --touch-glyph-active: 0.6;
  --touch-bottom: max(24px, calc(env(safe-area-inset-bottom) + 12px));
}
.touch-overlay-glyphs-hidden .touch-track-rest,
.touch-overlay-glyphs-hidden .touch-jump-glyph { display: none; }

.touch-track {
  position: absolute;
  width: 96px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 6px;
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.18);
  color: var(--touch-glyph);
  text-shadow: 0 0 2px var(--touch-glyph-outline), 0 0 1px var(--touch-glyph-outline);
  opacity: var(--touch-glyph-idle);
  transition: opacity 120ms ease;
}
.touch-track.is-active { opacity: var(--touch-glyph-active); }
.touch-track-arrow { font-size: 14px; line-height: 1; }
.touch-knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  border-radius: var(--radius-circle);
  background: var(--touch-glyph);
  box-shadow: 0 0 0 1px var(--touch-glyph-outline);
  transition: transform 60ms linear;
}
/* 하단 상시 트랙 — 왼쪽 절반 가운데 */
.touch-track-rest {
  left: 25%;
  bottom: var(--touch-bottom);
  transform: translateX(-50%);
}
/* 손가락 위 트랙 — left/top 을 anchor 로 옮기고 중심을 맞춘다 */
.touch-track-live {
  transform: translate(-50%, -50%);
  opacity: var(--touch-glyph-active);
}
.touch-jump-glyph {
  position: absolute;
  left: 75%;
  bottom: var(--touch-bottom);
  transform: translateX(-50%);
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  line-height: 1;
  color: var(--touch-glyph);
  text-shadow: 0 0 2px var(--touch-glyph-outline), 0 0 1px var(--touch-glyph-outline);
  opacity: var(--touch-glyph-idle);
  transition: opacity 120ms ease;
}
.touch-jump-glyph.is-active { opacity: var(--touch-glyph-active); }

.touch-hint {
  position: absolute;
  top: max(24px, calc(env(safe-area-inset-top) + 12px));
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 12px;
  border-radius: var(--radius-full);
  background: rgba(10, 19, 23, 0.72);
  color: var(--color-canvas);
  white-space: nowrap;
  opacity: 0;
  transition: opacity 300ms ease;
}
.touch-hint-shown { opacity: 1; }
.touch-hint-fading { opacity: 0; }
```

- [ ] **Step 3: Verify build**

Run: `npm run build` → PASS (CSS is not type-checked; this confirms nothing else broke).
Run: `npm test` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/ui/styles.css
git commit -m "style: harden the game layer for WebView touch and style the touch overlay"
```

---

### Task 11: Wire it into `main.ts`

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `createTouch` (Task 2–5), `mountTouchOverlay`/`MountedTouchOverlay` (Task 8), `setSwipeBack` (Task 9), `save.controlsHintSeen` (Task 6).

- [ ] **Step 1: Imports and module state**

Add imports after the existing `import { createInput } from './core/input'`:

```ts
import { createTouch } from './core/touch'
import { mountTouchOverlay, type MountedTouchOverlay } from './ui/touchOverlay'
import { setSwipeBack } from './toss/screen'
```

After `const input = createInput()` add:

```ts
// 터치 컨트롤러는 판 중에만 gameLayer 에 붙는다. 존 경계는 gameLayer 폭(= 뷰포트 폭)의 절반.
const touch = createTouch(input, () => ({ width: gameLayer.clientWidth }))
let detachTouch: (() => void) | null = null
let overlay: MountedTouchOverlay | null = null
// 안내를 이미 내렸으면 매 프레임 dismissHint 를 부르지 않기 위한 로컬 플래그 (dismissHint 자체도 멱등)
let hintDismissed = false
```

- [ ] **Step 2: Lifecycle helper**

Add after the `persist` definition:

```ts
// 판을 떠날 때의 정리 — 판 중이 아닐 때 불려도 안전하도록 null 가드로 멱등하게 둔다.
// detach 가 내부에서 clear 하므로 눌린 채 끝난 손가락이 다음 판의 존을 점유하지 않는다.
function leaveRun(): void {
  detachTouch?.()
  detachTouch = null
  overlay?.unmount()
  overlay = null
  void setSwipeBack(true)
}
```

- [ ] **Step 3: visibilitychange → clear**

Replace the visibilitychange handler body:

```ts
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    loop.reset()
    input.reset()
    // reset 이 아니라 clear — 숨겨진 동안 OS 가 터치를 가져갔다. 추적 중이던 포인터는
    // 전부 stale 이고 up 이 안 올 수 있다. 늦게 오더라도 목록에 없어 무시된다.
    touch.clear()
  }
})
```

- [ ] **Step 4: goToLobby / enterLoadout / finishRun call leaveRun**

- In `goToLobby()` and `enterLoadout()`, add `leaveRun()` as the first statement.
- In `finishRun()`, add `leaveRun()` before `state = null`.

- [ ] **Step 5: startRun attaches**

In `startRun()`, after `gameLayer.classList.remove('hidden')` and before `loop.reset()`:

```ts
  detachTouch = touch.attach(gameLayer)   // 내부에서 clear — touch.reset() 은 따로 부르지 않는다
  hintDismissed = false
  overlay = mountTouchOverlay(gameLayer, touch, {
    showHint: !save.controlsHintSeen,
    onHintDone() {
      save.controlsHintSeen = true
      persist()
    },
  })
  void setSwipeBack(false)
```

- [ ] **Step 6: Quiz close resets touch too**

In `openQuiz`'s completion callback, after `input.reset()` add:

```ts
    touch.reset()     // 손가락은 아직 화면에 있다 — suppressed 로 두고 액션만 해제 (순서 무관)
```

- [ ] **Step 7: frame dismisses the hint on first keyboard input**

Touch is covered by the overlay itself (it watches `moveAnchor`/`jumpActive` in its own subscription); this loop covers the keyboard, whose presses never appear in touch snapshots. In `frame()`, inside `if (state !== null) {` before the quiz check:

```ts
    if (overlay !== null && !hintDismissed) {
      const s = input.snapshot()
      if (s.left || s.right || s.jumpHeld || s.jumpPressed) {
        hintDismissed = true
        overlay.dismissHint()
      }
    }
```

- [ ] **Step 8: Build, test, and check the layer boundary**

Run: `npm run build` → PASS.
Run: `npm test` → PASS (including `tests/architecture.test.ts` — no `game/` file changed).

- [ ] **Step 9: Manual desktop check**

Run: `npm run dev`, open in a desktop browser:
- Overlay glyphs are hidden; the hint reads `← → 이동 · Space 길게 눌러 점프`, disappears after 1.5s or on the first key.
- Clicking and dragging on the left half moves; clicking the right half jumps (mouse goes through the same path). After the first mouse interaction glyphs stay hidden (mouse ≠ touch).
- Open DevTools device toolbar (touch emulation): glyphs appear; drag left half to move, tap right half to jump, hold for a higher jump, two-finger emulation is not available — verify single-thumb behaviours.
- Reload: hint no longer shows (`controlsHintSeen` saved).

- [ ] **Step 10: Commit**

```bash
git add src/main.ts
git commit -m "feat(main): wire touch controller, overlay and swipe-back into the run lifecycle"
```

---

### Task 12: Docs — parent spec, CLAUDE.md, real-device checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-08-15-life-jump-design.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Parent spec non-goals and architecture table**

In `docs/superpowers/specs/2026-08-15-life-jump-design.md`:
- Under `### 비목표 (Non-goals)`, replace the line `- 모바일 터치 조작 (키보드 전용)` with
  `- ~~모바일 터치 조작~~ → `2026-08-17-touch-controls-design.md` 에서 해제`
- In section 13's file listing (the block containing `input.ts            키보드 상태 추적`), change that line to `input.ts            키보드·터치 소스 상태 추적 (OR 합산)` and add directly below it:
  ```
      touch.ts            Pointer Events → 존/조이스틱 판정 (터치 스펙 4절)
  ```
  and under `ui/` add `touchOverlay.ts / touchHint.ts   터치 글리프·첫 판 안내`, and add a `toss/` entry: `toss/screen.ts   앱인토스 SDK 래퍼 (스와이프백)`.

- [ ] **Step 2: CLAUDE.md**

In `CLAUDE.md` under `## Architecture`, add after the `core/` line:

```
  toss/          앱인토스 SDK 래퍼 (screen.ts: 스와이프백). SDK 미설치 환경에서는 no-op
```

And add a subsection after "세이브 마이그레이션 규약":

```markdown
### 입력 소스 규약

- 키보드와 터치는 `core/input.ts` 안에서 소스별 상태를 가지며 스냅샷에서 OR 된다. 새 입력 소스는
  `press/release(action, source)` 를 부르는 얇은 층으로 붙인다 — `InputState` 는 바꾸지 않는다.
- 터치 판정 상수(`DEAD`, `FOLLOW`)는 `core/touch.ts` 상단. `FOLLOW > DEAD` 불변식.
- 모달을 닫을 때는 `input.reset()` + `touch.reset()`, 페이지 복귀·판 종료에는 `touch.clear()`
  (detach 가 대신 부른다). 둘을 바꿔 쓰면 죽은 손가락이 존을 영구 점유하거나 첫 점프를 먹는다.
- 설계: `docs/superpowers/specs/2026-08-17-touch-controls-design.md`
```

Also update the "life-jump 이식 시 정리 필요한 지점" table row **입력**: change the "이식 시 필요한 것" cell to `완료 — 터치 스펙 참조. 실기기 검증(9절 체크리스트) 남음`.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-08-15-life-jump-design.md CLAUDE.md
git commit -m "docs: record touch controls in the parent spec and CLAUDE.md"
```

- [ ] **Step 4: Real-device checklist (not automatable — record results in the PR/commit notes)**

From spec §9, on a phone (browser first; Toss QR once the granite build exists):
- 양손 동시 입력: 왼손 이동 중 오른손 점프·더블점프.
- 왼쪽 가장자리에서 시작한 이동에 iOS 스와이프백이 뜨지 않는다(토스 앱). 로비 복귀 후에는 다시 뜬다.
- 알림바를 내렸다 올린 뒤 잡고 있던 방향·점프가 풀려 있다.
- 홈으로 나갔다 돌아온 뒤 이동·점프 존이 모두 정상 반응한다.
- 손가락을 누른 채 판이 끝난 뒤 다음 판에서 같은 존이 정상 반응한다.
- 퀴즈 모달을 닫은 직후 첫 점프가 먹는다(손을 뗐다 다시 눌렀을 때). 누른 채였다면 안 먹는다.
- 롱프레스에 메뉴/돋보기가 안 뜬다. 핀치·더블탭 줌이 안 된다. 페이지가 안 튕긴다.
- 반전 감각: `FOLLOW`/`DEAD` 를 조정할 경우 `tests/core/touch.test.ts` 의 거리 테스트가 상수를 참조하므로 그대로 통과해야 하고, `FOLLOW > DEAD` 테스트가 하한을 지킨다.

---

## Self-review notes

- Spec coverage: §3 → Task 1; §4.1–4.5 → Tasks 2, 3, 5; §4.6 → Tasks 4 (reset) and 2/5 (clear); §4.7 → Task 2; §5 → Tasks 7, 8; §6 → Task 6; §7.1 → Task 10; §7.2 → Task 9; §7.4 → Task 9's `SDK_EXPORT` constant + Task 12 checklist; §8 → Task 11; §9 → each task's tests + Task 12 Step 4; §10 → Task 12.
- The overlay's "hybrid device" reveal uses `lastPointerType === 'touch'` from the snapshot (Task 2 publishes it on every handled event).
- `Pick<TouchController, 'subscribe'>` in `mountTouchOverlay` lets the overlay test use a fake without implementing the whole controller.
