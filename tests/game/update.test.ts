import { describe, it, expect } from 'vitest'
import { stepGame } from '../../src/game/update'
import { createGameState, defaultModifiers, makePlatform } from '../../src/game/state'
import type { GameState, Platform } from '../../src/game/state'
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

  it('발판 끝에서 걸어 나가면 onGround가 내려가고 지상 점프가 되지 않는다', () => {
    // 회귀: onGround가 점프·스프링·발판 소멸에서만 내려가던 시절에는, 발판
    // 끝에서 걸어 나가도 플래그가 참으로 남아 낙하 내내 지상 점프(그리고
    // 더블 점프 재충전)가 공짜로 가능했다.
    const s = createGameState(defaultModifiers())
    const ledge = makePlatform(1, 60, 0, 24)
    s.platforms = [ledge]
    s.highestGeneratedY = 1e9      // 새 발판 생성을 막는다
    s.player.x = 60                // 발판 왼쪽 끝 (발판 오른쪽 끝 = 84)
    s.player.y = 0
    s.player.prevY = 0
    s.player.vy = 0
    s.player.onGround = true
    s.standingOnId = 1

    // 오른쪽으로 걸어 발판 밖으로 나간다 (90px/s × 1/60초 = 스텝당 1.5px)
    for (let i = 0; i < 20; i++) stepGame(s, inp({ right: true }), deps())

    expect(s.player.onGround).toBe(false)
    expect(s.standingOnId).toBeNull()
    expect(s.player.vy).toBeLessThan(0)
    expect(s.player.y).toBeLessThan(0)

    // 낙하 중에 점프키를 눌러도 지상 점프가 나가지 않는다 — 계속 가속 낙하한다
    const vyBefore = s.player.vy
    stepGame(s, inp({ jumpPressed: true, jumpHeld: true }), deps())
    expect(s.player.vy).toBeLessThan(vyBefore)
    expect(s.player.onGround).toBe(false)
  })

  it('걸어 나간 뒤에는 이동 발판이 플레이어를 더 이상 실어 나르지 않는다', () => {
    const s = createGameState(defaultModifiers())
    const mv = makePlatform(1, 60, 0, 24, 'moving')
    s.platforms = [mv]
    s.highestGeneratedY = 1e9
    s.player.x = 60
    s.player.y = 0
    s.player.prevY = 0
    s.player.vy = 0
    s.player.onGround = true
    s.standingOnId = 1

    for (let i = 0; i < 20; i++) stepGame(s, inp({ right: true }), deps())
    expect(s.player.onGround).toBe(false)

    // 발판만 움직이고 플레이어의 x는 그대로여야 한다
    const platX = mv.x
    const playerX = s.player.x
    for (let i = 0; i < 5; i++) stepGame(s, NONE, deps())
    expect(mv.x).not.toBeCloseTo(platX, 3)
    expect(s.player.x).toBeCloseTo(playerX, 6)
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
  /** player.y보다 높은 발판 중 가장 낮은 것 — 다음으로 밟아야 할 발판 */
  function lowestPlatformAbove(s: GameState): Platform | null {
    let best: Platform | null = null
    for (const p of s.platforms) {
      if (p.dead) continue
      if (p.y <= s.player.y) continue
      if (best === null || p.y < best.y) best = p
    }
    return best
  }

  /**
   * 목표 발판을 향해 좌우로 조향하며 착지할 때마다(그리고 스프링에 튕길 때마다)
   * 점프하는 봇. 도달 가능성 불변식(platforms.ts의 isReachable)이 실제 물리
   * 시뮬레이션 하에서도 성립하는지 끝까지 검증하는 것이 목적이므로, 조향 없이
   * 수직으로만 뛰는 봇으로는 부족하다 — 이동 발판 없이 수평 오프셋만 있는
   * 발판은 절대 밟지 못해 정지 화면 폭 발판(시작 발판)에서 영원히 튕기기만
   * 한다.
   *
   * 두 가지 함정을 피해야 한다:
   *
   * 1. 매 프레임 목표를 새로 고르면(가장 낮은 미달성 발판) 비행 중간에 목표가
   *    계속 바뀌어 좌우 조향이 서로 상쇄되고 제자리를 맴돈다. 그래서 목표는
   *    "탄도 구간 하나"당 한 번만 고른다 — 새 탄도가 시작될 때만(= 자체 점프
   *    발동 또는 스프링 튕김으로 vy가 이전 프레임보다 커졌을 때) 갱신한다.
   * 2. 점프를 스프링 착지 시점부터 30프레임처럼 고정 구간만 붙들면, 그 구간이
   *    끝난 뒤 우연히 스프링을 밟을 때 physics.ts의 가변 점프 컷오프
   *    (`!jumpHeld && vy > JUMP_CUTOFF`이면 vy를 300으로 자름)가 다음 프레임에
   *    즉시 발동해 750짜리 스프링 반동을 300 근처로 깎아버린다. 착지
   *    직후(onGround=true) 값은 스프링에서는 절대 true가 되지 않으므로(스프링은
   *    착지 즉시 onGround=false로 튕겨 나가도록 설계돼 있다 — platforms.ts의
   *    applyLandingEffect), 고정 프레임 카운터로는 이 컷오프를 피할 수 없다.
   *    공중에 있는 동안은 계속 점프를 붙들고 있게 하면(실제 플레이어가 계속
   *    점프를 누르고 있는 것과 같다) 이 문제가 사라진다.
   */
  function autoPlay(seed: number, steps: number) {
    const s = createGameState(defaultModifiers())
    const d = deps(seed)
    let target: Platform | null = null
    const DEAD_ZONE = 4 // 목표 중심에 이미 정렬돼 있을 때 좌우로 떨지 않기 위한 여유

    for (let i = 0; i < steps; i++) {
      let left = false
      let right = false
      if (target !== null) {
        const targetCenterX = target.x + target.width / 2
        const playerCenterX = s.player.x + C.PLAYER_W / 2
        if (playerCenterX < targetCenterX - DEAD_ZONE) right = true
        else if (playerCenterX > targetCenterX + DEAD_ZONE) left = true
      }

      const input = s.player.onGround
        ? inp({ left, right, jumpPressed: true, jumpHeld: true })
        : inp({ left, right, jumpHeld: true })

      const prevVy = s.player.vy
      stepGame(s, input, d)

      // 아이템 드롭 중 1% 확률의 퀴즈를 주우면 paused=true가 되어 stepGame이
      // 계속 조기 반환한다. 이 봇은 등반 불변식만 검증하므로 퀴즈 보상은
      // 포기하고 즉시 닫아 계속 진행한다.
      if (s.pendingQuiz !== null) {
        s.pendingQuiz = null
        s.paused = false
      }

      // 새 탄도 구간이 시작됐을 때만(자체 점프 또는 스프링 튕김으로 vy가
      // 증가했을 때) 목표를 다시 고른다. 그 사이에는 같은 목표를 향해
      // 끝까지 조향한다.
      if (target === null || target.dead || s.player.vy > prevVy) {
        target = lowestPlatformAbove(s)
      }

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

  it('실제로 위로 올라간다 — 시드 1~6 모두 유의미하게 상승한다', () => {
    // 시드 1과 6은 조향 없는 봇에서는 시작 발판 바로 위 스프링에 영원히
    // 갇혀 92px(1회 최대 점프 높이)를 넘지 못했다. 조향하는 봇으로 두 시드
    // 모두 실제로 등반이 가능한지 — platforms.ts의 도달 가능성 불변식이
    // 물리 시뮬레이션 하에서도 성립하는지 — 확인한다.
    for (let seed = 1; seed <= 6; seed++) {
      const s = autoPlay(seed, 3000)
      expect(s.run.maxHeight).toBeGreaterThan(300)
    }
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

describe('stepGame — 공중에서 주운 퀴즈는 착지할 때 뜬다', () => {
  // 낙하 중인 플레이어와, 그 아래 착지할 발판 하나
  function fallingToward(platY: number) {
    const s = createGameState(defaultModifiers())
    s.platforms = [makePlatform(1, 0, platY, C.LOGICAL_W)]
    s.highestGeneratedY = platY
    s.player.y = platY + 30
    s.player.prevY = platY + 30
    s.player.vy = -100
    s.player.onGround = false
    s.standingOnId = null
    return s
  }

  it('들고 있는 동안에는 멈추지 않고 계속 떨어진다', () => {
    const s = fallingToward(400)
    s.heldQuiz = { platformY: 777 }
    const startY = s.player.y

    stepGame(s, NONE, deps())

    expect(s.player.onGround).toBe(false)
    expect(s.player.y).toBeLessThan(startY)   // 실제로 낙하가 진행됐다
    expect(s.paused).toBe(false)
    expect(s.pendingQuiz).toBeNull()
    expect(s.heldQuiz).toEqual({ platformY: 777 })
  })

  it('발이 땅에 닿는 순간 퀴즈가 뜨고 게임이 멈춘다', () => {
    const s = fallingToward(400)
    s.heldQuiz = { platformY: 777 }

    let steps = 0
    while (!s.player.onGround && steps < 60) { stepGame(s, NONE, deps()); steps++ }

    expect(s.player.onGround).toBe(true)      // 착지 자체가 일어났는지 먼저 확인
    expect(s.pendingQuiz).toEqual({ platformY: 777 })   // 주웠던 발판 높이가 보존된다
    expect(s.heldQuiz).toBeNull()
    expect(s.paused).toBe(true)
  })

  it('스프링으로 즉시 튕겨 나가면 아직 뜨지 않는다', () => {
    // applyLandingEffect가 onGround를 곧바로 내리므로 여전히 공중이다
    const s = createGameState(defaultModifiers())
    s.platforms = [makePlatform(1, 0, 0, C.LOGICAL_W, 'spring')]
    s.highestGeneratedY = 0
    s.player.y = 20
    s.player.prevY = 20
    s.player.vy = -100
    s.player.onGround = false
    s.standingOnId = null
    s.heldQuiz = { platformY: 777 }

    for (let i = 0; i < 7; i++) stepGame(s, NONE, deps())

    expect(s.player.vy).toBeGreaterThan(C.JUMP_V)   // 실제로 튕겨 올랐다
    expect(s.player.onGround).toBe(false)
    expect(s.pendingQuiz).toBeNull()
    expect(s.heldQuiz).toEqual({ platformY: 777 })
  })
})

describe('stepGame — 되살아난 발판에 다시 오를 수 있다', () => {
  it('부서져 막혔던 길이 되살아난 뒤 실제로 착지로 이어진다', () => {
    // 이 기능의 존재 이유를 그대로 재현한다: 부서지는 발판 하나가 위아래를 잇는
    // 유일한 통로였고, 그것이 사라지면 영구히 막힌다.
    const s = createGameState(defaultModifiers())
    const crumble = makePlatform(1, 0, 100, C.LOGICAL_W, 'crumble')
    s.platforms = [crumble]
    s.highestGeneratedY = 100

    // 밟아서 부순다
    s.player.y = 130
    s.player.prevY = 130
    s.player.vy = -100
    s.player.onGround = false
    s.standingOnId = null
    for (let i = 0; i < 40; i++) stepGame(s, NONE, deps())
    expect(crumble.dead).toBe(true)

    // 부서진 동안에는 통과해버린다 — 착지 대상이 아니다
    s.player.y = 130
    s.player.prevY = 130
    s.player.vy = -100
    s.player.onGround = false
    s.standingOnId = null
    for (let i = 0; i < 10; i++) stepGame(s, NONE, deps())
    expect(s.player.onGround).toBe(false)
    expect(s.player.y).toBeLessThan(100)   // 발판을 뚫고 내려갔다

    // 시간이 지나 되살아난다
    s.run.time += C.CRUMBLE_RESPAWN
    stepGame(s, NONE, deps())
    expect(crumble.dead).toBe(false)

    // 이제 다시 착지할 수 있다
    s.player.y = 130
    s.player.prevY = 130
    s.player.vy = -100
    s.player.onGround = false
    s.standingOnId = null
    let steps = 0
    while (!s.player.onGround && steps < 40) { stepGame(s, NONE, deps()); steps++ }
    expect(s.player.onGround).toBe(true)
    expect(s.player.y).toBe(100)
  })
})
