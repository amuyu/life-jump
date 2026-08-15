import { describe, it, expect } from 'vitest'
import { createGameState, defaultModifiers } from '../../src/game/state'
import * as C from '../../src/constants'

describe('createGameState', () => {
  it('기본 수정자로 만들면 상수값을 그대로 쓴다', () => {
    const s = createGameState(defaultModifiers())
    expect(s.run.gravity).toBe(C.GRAVITY)
    expect(s.run.jumpVelocity).toBe(C.JUMP_V)
    expect(s.run.moveSpeed).toBe(C.MOVE_SPEED)
    expect(s.run.maxEnergy).toBe(3)
    expect(s.run.energy).toBe(3)
  })

  it('시작 시 바닥 발판 위에 서 있다', () => {
    const s = createGameState(defaultModifiers())
    expect(s.platforms.length).toBeGreaterThan(0)
    expect(s.player.onGround).toBe(true)
    expect(s.player.vy).toBe(0)
  })

  it('player.prevY는 y와 같게 시작한다', () => {
    const s = createGameState(defaultModifiers())
    expect(s.player.prevY).toBe(s.player.y)
  })

  it('점수와 카메라가 0에서 시작한다', () => {
    const s = createGameState(defaultModifiers())
    expect(s.run.maxHeight).toBe(0)
    expect(s.camera.y).toBe(0)
  })

  it('로켓 부츠(startHeight)를 주면 플레이어·카메라·점수가 함께 올라간다', () => {
    const mods = { ...defaultModifiers(), startHeight: 1000 }
    const s = createGameState(mods)
    expect(s.player.y).toBeGreaterThanOrEqual(1000)
    expect(s.run.maxHeight).toBeGreaterThanOrEqual(1000)
    expect(s.camera.y).toBeGreaterThan(0)
  })

  it('로켓 부츠를 쓰면 시작 높이 아래에는 발판이 없고, highestGeneratedY가 그 높이에 고정된다', () => {
    const mods = { ...defaultModifiers(), startHeight: 1000 }
    const s = createGameState(mods)
    for (const p of s.platforms) {
      expect(p.y).toBeGreaterThanOrEqual(1000)
    }
    expect(s.highestGeneratedY).toBe(1000)
  })

  it('기본 시작 높이(0)에서도 발판이 그 아래로 내려가지 않고, highestGeneratedY가 0에 고정된다', () => {
    const s = createGameState(defaultModifiers())
    for (const p of s.platforms) {
      expect(p.y).toBeGreaterThanOrEqual(0)
    }
    expect(s.highestGeneratedY).toBe(0)
  })

  it('수정자가 run 상태에 반영된다', () => {
    const mods = {
      ...defaultModifiers(),
      maxEnergy: 5,
      gravity: 900,
      cushionAvailable: true,
      doubleJumpEnabled: true,
    }
    const s = createGameState(mods)
    expect(s.run.maxEnergy).toBe(5)
    expect(s.run.energy).toBe(5)
    expect(s.run.gravity).toBe(900)
    expect(s.run.cushionAvailable).toBe(true)
    expect(s.run.doubleJumpEnabled).toBe(true)
  })
})
