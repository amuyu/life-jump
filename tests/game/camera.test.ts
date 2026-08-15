import { describe, it, expect } from 'vitest'
import { updateCamera, isBelowFallLine } from '../../src/game/camera'
import { createGameState, defaultModifiers } from '../../src/game/state'
import * as C from '../../src/constants'

describe('updateCamera', () => {
  it('플레이어가 추종선을 넘으면 카메라가 따라 올라간다', () => {
    const s = createGameState(defaultModifiers())
    s.player.y = 1000
    updateCamera(s)
    expect(s.camera.y).toBe(1000 - C.CAMERA_FOLLOW_OFFSET)
  })

  it('추종선 아래에 있으면 카메라가 움직이지 않는다', () => {
    const s = createGameState(defaultModifiers())
    s.player.y = 1000
    updateCamera(s)
    const cam = s.camera.y

    s.player.y = 500
    updateCamera(s)
    expect(s.camera.y).toBe(cam)
  })

  it('카메라는 절대 내려가지 않는다', () => {
    const s = createGameState(defaultModifiers())
    const heights = [500, 1200, 800, 2000, 100, 1500]
    let prev = s.camera.y
    for (const h of heights) {
      s.player.y = h
      updateCamera(s)
      expect(s.camera.y).toBeGreaterThanOrEqual(prev)
      prev = s.camera.y
    }
  })

  it('run.maxHeight가 최고 도달 높이를 기록한다', () => {
    const s = createGameState(defaultModifiers())
    s.player.y = 700
    updateCamera(s)
    expect(s.run.maxHeight).toBe(700)
  })

  it('run.maxHeight는 절대 내려가지 않는다', () => {
    const s = createGameState(defaultModifiers())
    s.player.y = 900
    updateCamera(s)
    s.player.y = 200      // 부활로 아래에 재배치된 상황
    updateCamera(s)
    expect(s.run.maxHeight).toBe(900)
  })
})

describe('isBelowFallLine', () => {
  it('카메라 하단보다 충분히 아래면 참', () => {
    const s = createGameState(defaultModifiers())
    s.camera.y = 500
    s.player.y = 500 + C.FALL_LINE_OFFSET - 1
    expect(isBelowFallLine(s)).toBe(true)
  })

  it('판정선 위면 거짓', () => {
    const s = createGameState(defaultModifiers())
    s.camera.y = 500
    s.player.y = 500 + C.FALL_LINE_OFFSET + 1
    expect(isBelowFallLine(s)).toBe(false)
  })

  it('화면 안에 있으면 거짓', () => {
    const s = createGameState(defaultModifiers())
    s.camera.y = 500
    s.player.y = 600
    expect(isBelowFallLine(s)).toBe(false)
  })
})
