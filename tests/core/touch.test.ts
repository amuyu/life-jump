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
