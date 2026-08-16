import { describe, it, expect, vi } from 'vitest'
import { createInput } from '../../src/core/input'
import { createTouch, type TouchSnapshot, DEAD, FOLLOW } from '../../src/core/touch'

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

  it('suppressed 이동 존 손가락의 move는 방향을 바꾸지 못한다', () => {
    const { input, touch, ev, snaps } = setup()
    ev('down', 1, LEFT_X); ev('move', 1, LEFT_X + 30)
    expect(input.snapshot().right).toBe(true)
    touch.reset()
    const n = snaps.length
    ev('move', 1, LEFT_X + 60)          // 죽은 손가락 — 판정도, 스냅샷 발행도 없다
    expect(input.snapshot().right).toBe(false)
    expect(input.snapshot().left).toBe(false)
    expect(snaps.length).toBe(n)
    ev('move', 1, LEFT_X - 60)
    expect(input.snapshot().left).toBe(false)
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
