import { describe, it, expect } from 'vitest'
import {
  stepMovingPlatforms, applyLandingEffect, stepCrumbling,
} from '../../src/game/platforms'
import { createGameState, defaultModifiers, makePlatform } from '../../src/game/state'
import * as C from '../../src/constants'

describe('applyLandingEffect — 스프링', () => {
  it('착지 즉시 SPRING_V로 튀어오른다', () => {
    const s = createGameState(defaultModifiers())
    const spring = makePlatform(1, 0, 100, 40, 'spring')
    s.player.vy = 0
    s.player.onGround = true

    applyLandingEffect(s, spring)

    expect(s.player.vy).toBe(C.SPRING_V)
    expect(s.player.onGround).toBe(false)
  })

  it('스프링 높이가 약 234px이다', () => {
    const h = (C.SPRING_V * C.SPRING_V) / (2 * C.GRAVITY)
    expect(h).toBeGreaterThan(230)
    expect(h).toBeLessThan(240)
  })

  it('일반 발판은 아무 일도 하지 않는다', () => {
    const s = createGameState(defaultModifiers())
    const normal = makePlatform(1, 0, 100, 40, 'normal')
    s.player.vy = 0
    s.player.onGround = true

    applyLandingEffect(s, normal)

    expect(s.player.vy).toBe(0)
    expect(s.player.onGround).toBe(true)
  })
})

describe('applyLandingEffect — 부서짐', () => {
  it('착지하면 소멸 타이머가 걸린다', () => {
    const s = createGameState(defaultModifiers())
    s.run.time = 10
    const crumble = makePlatform(1, 0, 100, 40, 'crumble')

    applyLandingEffect(s, crumble)

    expect(crumble.crumbleAt).toBeCloseTo(10 + C.CRUMBLE_DELAY, 5)
  })

  it('이미 타이머가 걸린 발판은 다시 걸리지 않는다', () => {
    const s = createGameState(defaultModifiers())
    s.run.time = 10
    const crumble = makePlatform(1, 0, 100, 40, 'crumble')
    applyLandingEffect(s, crumble)
    const first = crumble.crumbleAt

    s.run.time = 10.2
    applyLandingEffect(s, crumble)
    expect(crumble.crumbleAt).toBe(first)
  })
})

describe('stepCrumbling', () => {
  it('시각이 지나면 dead가 된다', () => {
    const s = createGameState(defaultModifiers())
    const crumble = makePlatform(1, 0, 100, 40, 'crumble')
    crumble.crumbleAt = 5
    s.platforms = [crumble]

    s.run.time = 4.9
    stepCrumbling(s)
    expect(crumble.dead).toBe(false)

    s.run.time = 5.1
    stepCrumbling(s)
    expect(crumble.dead).toBe(true)
  })

  it('타이머가 없는 발판은 죽지 않는다', () => {
    const s = createGameState(defaultModifiers())
    const crumble = makePlatform(1, 0, 100, 40, 'crumble')
    s.platforms = [crumble]
    s.run.time = 9999
    stepCrumbling(s)
    expect(crumble.dead).toBe(false)
  })
})

describe('stepMovingPlatforms', () => {
  it('이동 발판이 좌우로 움직인다', () => {
    const s = createGameState(defaultModifiers())
    const mv = makePlatform(1, 60, 100, 40, 'moving')
    s.platforms = [mv]

    stepMovingPlatforms(s, C.STEP, null)
    expect(mv.x).toBeCloseTo(60 + C.MOVING_SPEED * C.STEP, 5)
  })

  it('MOVING_RANGE를 넘어가면 방향을 바꾼다', () => {
    const s = createGameState(defaultModifiers())
    const mv = makePlatform(1, 60, 100, 40, 'moving')
    s.platforms = [mv]

    // 오른쪽 끝까지 충분히 이동
    for (let i = 0; i < 200; i++) stepMovingPlatforms(s, C.STEP, null)
    expect(mv.x).toBeLessThanOrEqual(60 + C.MOVING_RANGE + 0.001)
    expect(mv.x).toBeGreaterThanOrEqual(60 - C.MOVING_RANGE - 0.001)
  })

  it('이동 범위를 절대 벗어나지 않는다', () => {
    const s = createGameState(defaultModifiers())
    const mv = makePlatform(1, 60, 100, 40, 'moving')
    s.platforms = [mv]

    for (let i = 0; i < 2000; i++) {
      stepMovingPlatforms(s, C.STEP, null)
      expect(mv.x).toBeGreaterThanOrEqual(60 - C.MOVING_RANGE - 0.001)
      expect(mv.x).toBeLessThanOrEqual(60 + C.MOVING_RANGE + 0.001)
    }
  })

  it('위에 선 플레이어를 함께 옮긴다', () => {
    const s = createGameState(defaultModifiers())
    const mv = makePlatform(1, 60, 100, 40, 'moving')
    s.platforms = [mv]
    s.player.x = 70

    const before = s.player.x
    stepMovingPlatforms(s, C.STEP, mv)
    expect(s.player.x).toBeCloseTo(before + C.MOVING_SPEED * C.STEP, 5)
  })

  it('다른 발판 위에 있으면 플레이어를 옮기지 않는다', () => {
    const s = createGameState(defaultModifiers())
    const mv = makePlatform(1, 60, 100, 40, 'moving')
    const other = makePlatform(2, 0, 50, 40)
    s.platforms = [mv, other]
    s.player.x = 10

    stepMovingPlatforms(s, C.STEP, other)
    expect(s.player.x).toBe(10)
  })

  it('함께 옮겨도 플레이어가 화면 밖으로 나가지 않는다', () => {
    const s = createGameState(defaultModifiers())
    const mv = makePlatform(1, C.LOGICAL_W - 40, 100, 40, 'moving')
    s.platforms = [mv]
    s.player.x = C.LOGICAL_W - C.PLAYER_W

    for (let i = 0; i < 300; i++) {
      stepMovingPlatforms(s, C.STEP, mv)
      expect(s.player.x).toBeGreaterThanOrEqual(0)
      expect(s.player.x + C.PLAYER_W).toBeLessThanOrEqual(C.LOGICAL_W)
    }
  })

  it('죽은 발판은 움직이지 않는다', () => {
    const s = createGameState(defaultModifiers())
    const mv = makePlatform(1, 60, 100, 40, 'moving')
    mv.dead = true
    s.platforms = [mv]

    stepMovingPlatforms(s, C.STEP, null)
    expect(mv.x).toBe(60)
  })
})
