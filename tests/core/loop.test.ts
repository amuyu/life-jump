import { describe, it, expect } from 'vitest'
import { createLoop } from '../../src/core/loop'
import { STEP, MAX_STEPS_PER_FRAME } from '../../src/constants'

describe('createLoop', () => {
  it('한 스텝에 못 미치는 delta는 스텝을 내지 않고 누적한다', () => {
    const loop = createLoop()
    expect(loop.frame(STEP / 2)).toBe(0)
    expect(loop.frame(STEP / 2)).toBe(1)
  })

  it('delta에 비례해 여러 스텝을 낸다', () => {
    const loop = createLoop()
    expect(loop.frame(STEP * 3)).toBe(3)
  })

  it('100ms를 넘는 delta는 초과분을 버린다', () => {
    const loop = createLoop()
    // 30초를 백그라운드에 있었어도 최대 6스텝만 나온다
    expect(loop.frame(30)).toBe(MAX_STEPS_PER_FRAME)
  })

  it('긴 delta 후에도 다음 프레임이 밀린 시간을 따라잡지 않는다', () => {
    const loop = createLoop()
    loop.frame(30)
    // accumulator에 잔여가 남아 있으면 여기서 또 여러 스텝이 나온다
    expect(loop.frame(STEP)).toBe(1)
  })

  it('reset()은 누적된 시간을 버린다', () => {
    const loop = createLoop()
    loop.frame(STEP * 0.9)
    loop.reset()
    expect(loop.frame(STEP * 0.2)).toBe(0)
  })

  it('음수나 NaN delta에도 스텝을 내지 않는다', () => {
    const loop = createLoop()
    expect(loop.frame(-5)).toBe(0)
    expect(loop.frame(Number.NaN)).toBe(0)
  })
})
