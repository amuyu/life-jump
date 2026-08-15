import { describe, it, expect } from 'vitest'
import { stepGame } from '../../src/game/update'
import { createGameState, defaultModifiers, makePlatform } from '../../src/game/state'
import { createRng } from '../../src/core/rng'
import type { InputState } from '../../src/core/input'
import * as C from '../../src/constants'

const NONE: InputState = { left: false, right: false, jumpHeld: false, jumpPressed: false }
const inp = (o: Partial<InputState>): InputState => ({ ...NONE, ...o })
const deps = (seed = 1) => ({ rng: createRng(seed) })

describe('stepGame — 기본 동작', () => {
  it('게임 시간이 흐른다', () => {
    const s = createGameState(defaultModifiers())
    stepGame(s, NONE, deps())
    expect(s.run.time).toBeCloseTo(C.STEP, 6)
  })

  it('일시정지 중에는 아무것도 변하지 않는다', () => {
    const s = createGameState(defaultModifiers())
    s.paused = true
    const snapshot = JSON.stringify(s)
    stepGame(s, inp({ jumpPressed: true, jumpHeld: true }), deps())
    expect(JSON.stringify(s)).toBe(snapshot)
  })

  it('게임 오버 후에는 아무것도 변하지 않는다', () => {
    const s = createGameState(defaultModifiers())
    s.run.over = true
    const snapshot = JSON.stringify(s)
    stepGame(s, inp({ jumpPressed: true, jumpHeld: true }), deps())
    expect(JSON.stringify(s)).toBe(snapshot)
  })

  it('점프하면 위로 올라간다', () => {
    const s = createGameState(defaultModifiers())
    const y0 = s.player.y
    stepGame(s, inp({ jumpPressed: true, jumpHeld: true }), deps())
    for (let i = 0; i < 10; i++) stepGame(s, inp({ jumpHeld: true }), deps())
    expect(s.player.y).toBeGreaterThan(y0)
  })

  it('카메라 위로 발판이 계속 생성된다', () => {
    const s = createGameState(defaultModifiers())
    stepGame(s, NONE, deps())
    expect(s.highestGeneratedY).toBeGreaterThan(s.camera.y + C.LOGICAL_H)
  })
})

describe('stepGame — 발판 상호작용', () => {
  it('스프링을 밟으면 크게 튀어오른다', () => {
    const s = createGameState(defaultModifiers())
    s.platforms = [makePlatform(1, 0, 0, C.LOGICAL_W, 'spring')]
    s.highestGeneratedY = 0
    s.player.y = 20
    s.player.prevY = 20
    s.player.vy = -100
    s.player.onGround = false

    for (let i = 0; i < 7; i++) stepGame(s, NONE, deps())
    expect(s.player.vy).toBeGreaterThan(C.JUMP_V)
  })

  it('부서지는 발판은 밟고 0.3초 뒤 사라진다', () => {
    const s = createGameState(defaultModifiers())
    const crumble = makePlatform(1, 0, 0, C.LOGICAL_W, 'crumble')
    s.platforms = [crumble]
    s.highestGeneratedY = 0
    s.player.y = 5
    s.player.prevY = 5
    s.player.vy = -100
    s.player.onGround = false

    for (let i = 0; i < 40; i++) stepGame(s, NONE, deps())
    expect(crumble.dead).toBe(true)
  })

  it('이동 발판 위에 선 플레이어가 함께 움직인다', () => {
    const s = createGameState(defaultModifiers())
    const mv = makePlatform(1, 60, 0, 60, 'moving')
    s.platforms = [mv]
    s.highestGeneratedY = 0
    s.player.x = 80
    s.player.y = 0
    s.player.prevY = 0
    s.player.vy = 0
    s.player.onGround = true
    s.standingOnId = 1

    const x0 = s.player.x
    for (let i = 0; i < 10; i++) stepGame(s, NONE, deps())
    expect(s.player.x).not.toBeCloseTo(x0, 3)
  })
})

describe('stepGame — 낙하와 부활', () => {
  it('화면 아래로 벗어나면 에너지가 깎이고 부활한다', () => {
    const s = createGameState(defaultModifiers())
    s.camera.y = 1000
    s.platforms = [makePlatform(1, 60, 1100, 40)]
    s.highestGeneratedY = 1100
    s.player.y = 980
    s.player.prevY = 980
    s.player.vy = -300
    s.player.onGround = false

    stepGame(s, NONE, deps())

    expect(s.run.energy).toBe(2)
    expect(s.player.y).toBe(1100)
  })

  it('에너지를 다 쓰면 게임 오버가 된다', () => {
    const s = createGameState(defaultModifiers())
    s.run.energy = 1
    s.camera.y = 1000
    s.platforms = []
    s.highestGeneratedY = 1100
    s.player.y = 900
    s.player.prevY = 900
    s.player.vy = -300
    s.player.onGround = false

    stepGame(s, NONE, deps())

    expect(s.run.over).toBe(true)
  })
})

describe('stepGame — 장시간 시뮬레이션 (통합)', () => {
  /** 항상 최대로 점프하며 올라가는 봇 */
  function autoPlay(seed: number, steps: number) {
    const s = createGameState(defaultModifiers())
    const d = deps(seed)
    let jumpHeldFor = 0

    for (let i = 0; i < steps; i++) {
      let input = inp({ jumpHeld: jumpHeldFor > 0 })
      if (s.player.onGround) {
        input = inp({ jumpPressed: true, jumpHeld: true })
        jumpHeldFor = 30
      }
      if (jumpHeldFor > 0) jumpHeldFor--
      stepGame(s, input, d)
      if (s.run.over) break
    }
    return s
  }

  it('20개 시드로 3000스텝을 돌려도 예외가 없다', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(() => autoPlay(seed, 3000)).not.toThrow()
    }
  })

  it('불변식이 끝까지 유지된다', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = autoPlay(seed, 3000)
      expect(s.run.maxHeight).toBeGreaterThanOrEqual(0)
      expect(s.run.energy).toBeGreaterThanOrEqual(0)
      expect(s.run.energy).toBeLessThanOrEqual(s.run.maxEnergy)
      expect(s.player.x).toBeGreaterThanOrEqual(0)
      expect(s.player.x + C.PLAYER_W).toBeLessThanOrEqual(C.LOGICAL_W)
    }
  })

  it('발판 배열이 무한히 커지지 않는다', () => {
    const s = autoPlay(1, 5000)
    expect(s.platforms.length).toBeLessThan(60)
  })

  it('실제로 위로 올라간다', () => {
    const s = autoPlay(4, 3000)
    expect(s.run.maxHeight).toBeGreaterThan(200)
  })
})

describe('stepGame — run 모디파이어가 실제로 물리에 반영된다 (커버리지 갭 보강)', () => {
  // physics.ts가 run.jumpVelocity/run.moveSpeed 대신 C.JUMP_V/C.MOVE_SPEED를
  // 직접 읽어도 기존 148개 테스트는 전부 통과한다 (기본값이 상수와 같으므로).
  // 상점의 "점프력"·"공중 조작" 업그레이드가 조용히 무효화되는 것을 막기 위해
  // 상수와 다른 값을 명시적으로 주입해 검증한다.

  it('run.jumpVelocity를 올리면 더 높이 뛴다', () => {
    const base = createGameState(defaultModifiers())
    const boosted = createGameState({ ...defaultModifiers(), jumpVelocity: 540 })

    // 발판 생성을 꺼서 도약 정점 측정을 우연히 밟는 스프링 발판에 오염되지
    // 않게 한다 — 정점은 상승 구간(하강 착지 판정이 스킵되는 구간)에서만
    // 결정되므로 발판 유무와 무관하지만, 값을 예측 가능하게 유지하기 위함.
    base.platforms = []
    base.highestGeneratedY = 1e9
    boosted.platforms = []
    boosted.highestGeneratedY = 1e9

    const jumpInput = inp({ jumpPressed: true, jumpHeld: true })
    const holdInput = inp({ jumpHeld: true })
    const dBase = deps()
    const dBoosted = deps()

    stepGame(base, jumpInput, dBase)
    stepGame(boosted, jumpInput, dBoosted)

    let peakBase = base.player.y
    let peakBoosted = boosted.player.y

    for (let i = 0; i < 39; i++) {
      stepGame(base, holdInput, dBase)
      stepGame(boosted, holdInput, dBoosted)
      if (base.player.y > peakBase) peakBase = base.player.y
      if (boosted.player.y > peakBoosted) peakBoosted = boosted.player.y
    }

    expect(peakBoosted).toBeGreaterThan(peakBase)
  })

  it('run.moveSpeed를 올리면 더 멀리 이동한다', () => {
    const base = createGameState(defaultModifiers())
    const boosted = createGameState({ ...defaultModifiers(), moveSpeed: 130 })

    const x0 = base.player.x
    expect(boosted.player.x).toBe(x0)

    const rightInput = inp({ right: true })
    const dBase = deps()
    const dBoosted = deps()
    for (let i = 0; i < 30; i++) {
      stepGame(base, rightInput, dBase)
      stepGame(boosted, rightInput, dBoosted)
    }

    const distBase = base.player.x - x0
    const distBoosted = boosted.player.x - x0

    expect(distBoosted).toBeGreaterThan(distBase)
  })
})
