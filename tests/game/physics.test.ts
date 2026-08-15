import { describe, it, expect } from 'vitest'
import { stepMotion } from '../../src/game/physics'
import { createGameState, defaultModifiers } from '../../src/game/state'
import type { InputState } from '../../src/core/input'
import * as C from '../../src/constants'

const NONE: InputState = { left: false, right: false, jumpHeld: false, jumpPressed: false }
const inp = (o: Partial<InputState>): InputState => ({ ...NONE, ...o })

/** 점프 후 자유 낙하시켜 도달한 최대 높이를 잰다 */
function apexHeight(holdSteps: number): number {
  const s = createGameState(defaultModifiers())
  const startY = s.player.y
  let peak = startY

  stepMotion(s, inp({ jumpPressed: true, jumpHeld: true }), C.STEP)

  for (let i = 0; i < 400; i++) {
    const held = i < holdSteps
    stepMotion(s, inp({ jumpHeld: held }), C.STEP)
    peak = Math.max(peak, s.player.y)
    if (s.player.vy < 0 && s.player.y < startY) break
  }
  return peak - startY
}

describe('stepMotion — 중력', () => {
  it('공중에서 아래로 가속한다', () => {
    const s = createGameState(defaultModifiers())
    s.player.onGround = false
    stepMotion(s, NONE, C.STEP)
    expect(s.player.vy).toBeCloseTo(-C.GRAVITY * C.STEP, 5)
  })

  it('낙하 속도가 MAX_FALL을 넘지 않는다', () => {
    const s = createGameState(defaultModifiers())
    s.player.onGround = false
    for (let i = 0; i < 600; i++) stepMotion(s, NONE, C.STEP)
    expect(s.player.vy).toBeGreaterThanOrEqual(-C.MAX_FALL)
  })

  it('run.gravity를 낮추면(깃털) 더 천천히 떨어진다', () => {
    const a = createGameState(defaultModifiers())
    const b = createGameState({ ...defaultModifiers(), gravity: 900 })
    a.player.onGround = false
    b.player.onGround = false
    for (let i = 0; i < 10; i++) {
      stepMotion(a, NONE, C.STEP)
      stepMotion(b, NONE, C.STEP)
    }
    expect(b.player.y).toBeGreaterThan(a.player.y)
  })
})

describe('stepMotion — 좌우 이동', () => {
  it('오른쪽 키로 moveSpeed만큼 이동한다', () => {
    const s = createGameState(defaultModifiers())
    const x0 = s.player.x
    stepMotion(s, inp({ right: true }), C.STEP)
    expect(s.player.x - x0).toBeCloseTo(C.MOVE_SPEED * C.STEP, 5)
  })

  it('좌우를 동시에 누르면 움직이지 않는다', () => {
    const s = createGameState(defaultModifiers())
    const x0 = s.player.x
    stepMotion(s, inp({ left: true, right: true }), C.STEP)
    expect(s.player.x).toBeCloseTo(x0, 5)
  })

  it('화면 왼쪽 벽을 넘지 않는다', () => {
    const s = createGameState(defaultModifiers())
    for (let i = 0; i < 300; i++) stepMotion(s, inp({ left: true }), C.STEP)
    expect(s.player.x).toBeGreaterThanOrEqual(0)
  })

  it('화면 오른쪽 벽을 넘지 않는다', () => {
    const s = createGameState(defaultModifiers())
    for (let i = 0; i < 300; i++) stepMotion(s, inp({ right: true }), C.STEP)
    expect(s.player.x + C.PLAYER_W).toBeLessThanOrEqual(C.LOGICAL_W)
  })

  it('공중에서도 조향할 수 있다', () => {
    const s = createGameState(defaultModifiers())
    s.player.onGround = false
    const x0 = s.player.x
    stepMotion(s, inp({ right: true }), C.STEP)
    expect(s.player.x).toBeGreaterThan(x0)
  })
})

describe('stepMotion — 가변 점프', () => {
  it('끝까지 누르면 약 96px(9.6m) 오른다', () => {
    expect(apexHeight(999)).toBeGreaterThan(C.MAX_JUMP_HEIGHT * 0.95)
    expect(apexHeight(999)).toBeLessThanOrEqual(C.MAX_JUMP_HEIGHT + 2)
  })

  it('즉시 떼면 약 37px(3.7m)만 오른다', () => {
    const h = apexHeight(0)
    const expected = (C.JUMP_CUTOFF * C.JUMP_CUTOFF) / (2 * C.GRAVITY) // 37.5
    expect(h).toBeGreaterThan(expected * 0.9)
    expect(h).toBeLessThan(expected * 1.25)
  })

  it('오래 누를수록 높이 오른다 (단조 증가)', () => {
    // mid는 8이 아닌 6을 쓴다: JUMP_V=480, GRAVITY=1200, JUMP_CUTOFF=300, STEP=1/60에서는
    // 정확히 8프레임 보유 시 자연 감쇠만으로 vy가 정확히 300(컷오프 값)에 도달해
    // 컷오프가 아무 효과도 못 내고(vy가 이미 300 이하) long(999)과 완전히 같은 궤적이 된다.
    // (460 - 8*20 = 300, 부동소수점 근사가 아니라 정확한 수치적 우연.) 6은 그 경계 이전이라
    // 컷오프가 실제로 vy를 깎아 short < mid < long의 진짜 단조 증가를 검증할 수 있다.
    const short = apexHeight(2)
    const mid = apexHeight(6)
    const long = apexHeight(999)
    expect(mid).toBeGreaterThan(short)
    expect(long).toBeGreaterThan(mid)
  })

  it('땅에 있지 않으면 jumpPressed로 점프하지 않는다', () => {
    const s = createGameState(defaultModifiers())
    s.player.onGround = false
    s.player.vy = -100
    stepMotion(s, inp({ jumpPressed: true, jumpHeld: true }), C.STEP)
    expect(s.player.vy).toBeLessThan(0)
  })

  it('컷오프는 상승 중일 때만 적용된다 (낙하 속도를 올리지 않는다)', () => {
    const s = createGameState(defaultModifiers())
    s.player.onGround = false
    s.player.vy = -500
    stepMotion(s, NONE, C.STEP)
    expect(s.player.vy).toBeLessThan(-500)
  })
})

describe('stepMotion — 더블 점프', () => {
  it('비활성 상태에서는 공중 점프가 안 된다', () => {
    const s = createGameState(defaultModifiers())
    stepMotion(s, inp({ jumpPressed: true, jumpHeld: true }), C.STEP)
    const vyAfterFirst = s.player.vy
    stepMotion(s, inp({ jumpPressed: true, jumpHeld: true }), C.STEP)
    expect(s.player.vy).toBeLessThan(vyAfterFirst)
  })

  it('활성 상태에서는 공중에서 1회 더 점프한다', () => {
    const s = createGameState({ ...defaultModifiers(), doubleJumpEnabled: true })
    stepMotion(s, inp({ jumpPressed: true, jumpHeld: true }), C.STEP)
    for (let i = 0; i < 20; i++) stepMotion(s, inp({ jumpHeld: true }), C.STEP)
    const before = s.player.vy
    stepMotion(s, inp({ jumpPressed: true, jumpHeld: true }), C.STEP)
    expect(s.player.vy).toBeGreaterThan(before)
    expect(s.player.doubleJumpUsed).toBe(true)
  })

  it('공중 점프는 착지 전까지 1회뿐이다', () => {
    const s = createGameState({ ...defaultModifiers(), doubleJumpEnabled: true })
    stepMotion(s, inp({ jumpPressed: true, jumpHeld: true }), C.STEP)
    stepMotion(s, inp({ jumpPressed: true, jumpHeld: true }), C.STEP)
    const before = s.player.vy
    stepMotion(s, inp({ jumpPressed: true, jumpHeld: true }), C.STEP)
    expect(s.player.vy).toBeLessThan(before)
  })
})

describe('stepMotion — prevY', () => {
  it('이동 전 y를 prevY에 기록한다', () => {
    const s = createGameState(defaultModifiers())
    s.player.onGround = false
    const y0 = s.player.y
    stepMotion(s, NONE, C.STEP)
    expect(s.player.prevY).toBe(y0)
    expect(s.player.y).not.toBe(y0)
  })
})
