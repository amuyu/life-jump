import { describe, it, expect } from 'vitest'
import * as C from '../src/constants'

describe('constants', () => {
  it('최대 점프 높이가 스펙 4절의 96px이다', () => {
    // 정의를 그대로 되풀이하면(= JUMP_V²/2G와 비교하면) 절대 실패할 수 없다.
    // 스펙이 못 박은 리터럴과 비교해야 물리 상수를 건드렸을 때 걸린다.
    expect(C.MAX_JUMP_HEIGHT).toBe(96)
  })

  it('MAX_GAP_Y가 최대 점프 높이보다 작다 (안전 여백)', () => {
    expect(C.MAX_GAP_Y).toBeLessThan(C.MAX_JUMP_HEIGHT)
  })

  it('delta 클램프가 스텝 상한에서 파생되어 정확히 일치한다', () => {
    // 두 값을 독립 상수로 두면 0.1 / (1/60) 같은 나눗셈이 런타임에 따라
    // 5.999...가 될 여지가 있다. 파생 관계로 묶어 그 가능성을 없앤다.
    expect(C.MAX_FRAME_DELTA).toBe(0.1)   // 스펙 4절이 못 박은 100ms
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
