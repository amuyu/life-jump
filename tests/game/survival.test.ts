import { describe, it, expect } from 'vitest'
import {
  isInvulnerable, isReviveCandidate, pickRevivePlatform, handleFall,
} from '../../src/game/survival'
import { createGameState, defaultModifiers, makePlatform } from '../../src/game/state'
import * as C from '../../src/constants'

/** 카메라를 500에 두고 후보 발판들을 배치한 상태를 만든다 */
function scene() {
  const s = createGameState(defaultModifiers())
  s.camera.y = 500
  s.run.time = 100
  s.platforms = [
    makePlatform(1, 10, 400, 40),   // 화면 밖 (너무 낮음)
    makePlatform(2, 20, 560, 40),   // 후보 — 가장 낮음
    makePlatform(3, 30, 700, 40),   // 후보
  ]
  s.player.y = 460
  return s
}

describe('isInvulnerable', () => {
  it('만료 시각 전이면 참', () => {
    const s = createGameState(defaultModifiers())
    s.run.time = 5
    s.run.invulnerableUntil = 6
    expect(isInvulnerable(s)).toBe(true)
  })

  it('만료 시각 후면 거짓', () => {
    const s = createGameState(defaultModifiers())
    s.run.time = 7
    s.run.invulnerableUntil = 6
    expect(isInvulnerable(s)).toBe(false)
  })

  it('초기 상태는 무적이 아니다', () => {
    const s = createGameState(defaultModifiers())
    expect(isInvulnerable(s)).toBe(false)
  })
})

describe('isReviveCandidate', () => {
  it('화면 안 정상 발판은 후보다', () => {
    const s = scene()
    expect(isReviveCandidate(s, s.platforms[1]!)).toBe(true)
  })

  it('너무 낮은 발판은 후보가 아니다', () => {
    const s = scene()
    expect(isReviveCandidate(s, s.platforms[0]!)).toBe(false)
  })

  it('죽은 발판은 후보가 아니다', () => {
    const s = scene()
    s.platforms[1]!.dead = true
    expect(isReviveCandidate(s, s.platforms[1]!)).toBe(false)
  })

  it('소멸 타이머가 작동 중인 발판은 후보가 아니다', () => {
    const s = scene()
    s.platforms[1]!.crumbleAt = 200   // 아직 안 죽었지만 곧 사라진다
    expect(isReviveCandidate(s, s.platforms[1]!)).toBe(false)
  })
})

describe('pickRevivePlatform', () => {
  it('후보 중 가장 낮은 발판을 고른다', () => {
    const s = scene()
    expect(pickRevivePlatform(s).id).toBe(2)
  })

  it('후보가 없으면 구조 발판을 만든다', () => {
    const s = scene()
    s.platforms = []
    const p = pickRevivePlatform(s)
    expect(p.y).toBe(500 + C.RESCUE_MARGIN)
    expect(s.platforms).toContain(p)
  })

  it('소멸 타이머 발판만 남았으면 구조 발판을 만든다', () => {
    const s = scene()
    s.platforms = [makePlatform(9, 20, 560, 40, 'crumble')]
    s.platforms[0]!.crumbleAt = 200
    const p = pickRevivePlatform(s)
    expect(p.id).not.toBe(9)
    expect(p.y).toBe(500 + C.RESCUE_MARGIN)
  })

  it('구조 발판은 화면 폭 안에 있다', () => {
    const s = scene()
    s.platforms = []
    const p = pickRevivePlatform(s)
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.x + p.width).toBeLessThanOrEqual(C.LOGICAL_W)
  })
})

describe('handleFall — 순서', () => {
  it('무적 중이면 에너지도 방석도 소모하지 않는다', () => {
    const s = scene()
    s.run.energy = 2
    s.run.cushionAvailable = true
    s.run.invulnerableUntil = s.run.time + 1

    handleFall(s)

    expect(s.run.energy).toBe(2)
    expect(s.run.cushionAvailable).toBe(true)
    expect(s.run.over).toBe(false)
  })

  it('무적 중 재구조해도 만료 시각이 연장되지 않는다', () => {
    const s = scene()
    const until = s.run.time + 1
    s.run.invulnerableUntil = until

    handleFall(s)
    handleFall(s)
    handleFall(s)

    expect(s.run.invulnerableUntil).toBe(until)
  })

  it('방석이 있으면 에너지 대신 방석을 소진한다', () => {
    const s = scene()
    s.run.energy = 2
    s.run.cushionAvailable = true

    handleFall(s)

    expect(s.run.energy).toBe(2)
    expect(s.run.cushionAvailable).toBe(false)
    expect(s.run.over).toBe(false)
  })

  it('에너지 1칸 + 방석이면 게임 오버가 아니다', () => {
    const s = scene()
    s.run.energy = 1
    s.run.cushionAvailable = true

    handleFall(s)

    expect(s.run.over).toBe(false)
    expect(s.run.energy).toBe(1)
  })

  it('방석이 없으면 에너지가 깎인다', () => {
    const s = scene()
    s.run.energy = 3

    handleFall(s)

    expect(s.run.energy).toBe(2)
  })

  it('에너지 1칸 + 방석 없이 떨어지면 즉시 게임 오버다', () => {
    const s = scene()
    s.run.energy = 1

    handleFall(s)

    expect(s.run.energy).toBe(0)
    expect(s.run.over).toBe(true)
  })

  it('게임 오버 시 구조 발판을 만들지 않는다', () => {
    const s = scene()
    s.platforms = []           // 후보가 없어 구조 발판이 필요한 상황
    s.run.energy = 1

    handleFall(s)

    expect(s.run.over).toBe(true)
    expect(s.platforms.length).toBe(0)
  })

  it('게임 오버 시 무적을 설정하지 않는다', () => {
    const s = scene()
    s.run.energy = 1
    handleFall(s)
    expect(s.run.invulnerableUntil).toBe(0)
  })
})

describe('handleFall — 부활 결과', () => {
  it('부활 발판 위에 정지 상태로 놓인다', () => {
    const s = scene()
    s.player.vy = -600
    s.player.vx = 90

    handleFall(s)

    expect(s.player.y).toBe(560)
    expect(s.player.prevY).toBe(560)
    expect(s.player.vy).toBe(0)
    expect(s.player.vx).toBe(0)
    expect(s.player.onGround).toBe(true)
  })

  it('부활 후 화면 안에 있다', () => {
    const s = scene()
    handleFall(s)
    expect(s.player.y).toBeGreaterThan(s.camera.y + C.FALL_LINE_OFFSET)
  })

  it('부활해도 점수와 카메라가 줄지 않는다', () => {
    const s = scene()
    s.run.maxHeight = 5000
    const cam = s.camera.y

    handleFall(s)

    expect(s.run.maxHeight).toBe(5000)
    expect(s.camera.y).toBe(cam)
  })

  it('무적이 아니었으면 1.5초 무적이 걸린다', () => {
    const s = scene()
    handleFall(s)
    expect(s.run.invulnerableUntil).toBeCloseTo(s.run.time + C.INVULN_SECONDS, 5)
  })

  it('더블 점프가 초기화된다', () => {
    const s = scene()
    s.player.doubleJumpUsed = true
    handleFall(s)
    expect(s.player.doubleJumpUsed).toBe(false)
  })
})

describe('handleFall — 스프링 시나리오 (스펙이 지목한 확정 버그)', () => {
  it('스프링으로 크게 오른 뒤 추락해도 부활 지점이 화면 안이다', () => {
    const s = createGameState(defaultModifiers())
    // 스프링 발판이 y=1000, 카메라는 정점 추종으로 그보다 위에 있다
    const springY = 1000
    const apex = springY + (C.SPRING_V * C.SPRING_V) / (2 * C.GRAVITY)
    s.camera.y = apex - C.CAMERA_FOLLOW_OFFSET     // 1042 — 스프링 발판보다 위!
    s.run.time = 50
    s.platforms = [
      makePlatform(1, 20, springY, 40, 'spring'),   // 화면 밖
      makePlatform(2, 30, s.camera.y + 80, 40),     // 화면 안
    ]
    s.player.y = s.camera.y - 40

    handleFall(s)

    // "마지막 착지 발판"(스프링)이 아니라 화면 안 발판에 부활해야 한다
    expect(s.player.y).toBe(s.camera.y + 80)
    expect(s.player.y).toBeGreaterThan(s.camera.y + C.FALL_LINE_OFFSET)
  })

  it('연속 낙하로 에너지 3칸이 한꺼번에 증발하지 않는다', () => {
    const s = createGameState(defaultModifiers())
    s.camera.y = 1042
    s.run.time = 50
    s.platforms = [makePlatform(1, 20, 1000, 40, 'spring')]  // 화면 밖뿐
    s.player.y = 1000

    handleFall(s)

    expect(s.run.energy).toBe(2)
    // 부활 지점이 화면 안이라 즉시 재낙하하지 않는다
    expect(s.player.y).toBeGreaterThan(s.camera.y + C.FALL_LINE_OFFSET)
  })
})
