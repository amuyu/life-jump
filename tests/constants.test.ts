import { describe, it, expect } from 'vitest'
import * as C from '../src/constants'

describe('constants', () => {
  it('MAX_JUMP_HEIGHT가 JUMP_V와 GRAVITY에서 파생된 값과 일치한다', () => {
    expect(C.MAX_JUMP_HEIGHT).toBeCloseTo((C.JUMP_V * C.JUMP_V) / (2 * C.GRAVITY), 5)
  })

  it('MAX_GAP_Y가 최대 점프 높이보다 작다 (안전 여백)', () => {
    expect(C.MAX_GAP_Y).toBeLessThan(C.MAX_JUMP_HEIGHT)
  })

  it('delta 클램프가 스텝 상한에서 파생되어 정확히 일치한다', () => {
    // 두 값을 독립 상수로 두면 0.1 / (1/60) 같은 나눗셈이 런타임에 따라
    // 5.999...가 될 여지가 있다. 파생 관계로 묶어 그 가능성을 없앤다.
    expect(C.MAX_FRAME_DELTA).toBe(C.STEP * C.MAX_STEPS_PER_FRAME)
    expect(Math.floor(C.MAX_FRAME_DELTA / C.STEP)).toBe(C.MAX_STEPS_PER_FRAME)
  })

  it('컷오프 속도가 점프 속도보다 작다', () => {
    expect(C.JUMP_CUTOFF).toBeLessThan(C.JUMP_V)
  })

  it('구간 경계가 순서대로다', () => {
    expect(C.SKY_START_Y).toBeGreaterThan(0)
    expect(C.SPACE_START_Y).toBeGreaterThan(C.SKY_START_Y)
  })
})
