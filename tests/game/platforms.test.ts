import { describe, it, expect } from 'vitest'
import {
  horizontalGap, reachTime, isReachable, generateUpTo, prunePlatforms,
} from '../../src/game/platforms'
import { createGameState, defaultModifiers, makePlatform } from '../../src/game/state'
import { createRng } from '../../src/core/rng'
import * as C from '../../src/constants'

describe('horizontalGap', () => {
  it('겹치면 0이다', () => {
    const a = makePlatform(1, 0, 0, 40)
    const b = makePlatform(2, 20, 50, 40)
    expect(horizontalGap(a, b)).toBe(0)
  })

  it('오른쪽으로 떨어져 있으면 양수 간격', () => {
    const a = makePlatform(1, 0, 0, 40)
    const b = makePlatform(2, 60, 50, 40)
    expect(horizontalGap(a, b)).toBe(20)
  })

  it('왼쪽으로 떨어져 있어도 양수 간격', () => {
    const a = makePlatform(1, 100, 0, 40)
    const b = makePlatform(2, 40, 50, 40)
    expect(horizontalGap(a, b)).toBe(20)
  })

  it('맞닿아 있으면 0이다', () => {
    const a = makePlatform(1, 0, 0, 40)
    const b = makePlatform(2, 40, 50, 40)
    expect(horizontalGap(a, b)).toBe(0)
  })
})

describe('reachTime', () => {
  it('최대 점프 높이를 넘으면 NaN', () => {
    expect(Number.isNaN(reachTime(C.MAX_JUMP_HEIGHT + 1))).toBe(true)
  })

  it('가까울수록 체공 시간이 길다 (더 일찍 지나고 늦게 돌아온다)', () => {
    expect(reachTime(32)).toBeGreaterThan(reachTime(72))
  })

  it('dy=0이면 왕복 전체 시간이다', () => {
    expect(reachTime(0)).toBeCloseTo((2 * C.JUMP_V) / C.GRAVITY, 5)
  })
})

describe('isReachable', () => {
  it('바로 위 가까운 발판은 도달 가능', () => {
    const a = makePlatform(1, 0, 0, 40)
    const b = makePlatform(2, 0, 40, 40)
    expect(isReachable(a, b)).toBe(true)
  })

  it('최대 점프 높이를 넘으면 도달 불가', () => {
    const a = makePlatform(1, 0, 0, 40)
    const b = makePlatform(2, 0, C.MAX_JUMP_HEIGHT + 10, 40)
    expect(isReachable(a, b)).toBe(false)
  })

  it('MAX_GAP_Y를 넘으면 도달 불가', () => {
    const a = makePlatform(1, 0, 0, 40)
    const b = makePlatform(2, 0, C.MAX_GAP_Y + 1, 40)
    expect(isReachable(a, b)).toBe(false)
  })

  it('수평으로 너무 멀면 도달 불가', () => {
    const a = makePlatform(1, 0, 0, 40)
    const b = makePlatform(2, 170, 72, 10)
    expect(isReachable(a, b)).toBe(false)
  })

  it('아래에 있는 발판은 항상 도달 가능', () => {
    const a = makePlatform(1, 0, 100, 40)
    const b = makePlatform(2, 150, 20, 20)
    expect(isReachable(a, b)).toBe(true)
  })

  it('이동 발판이 끼면 예산이 줄어든다 (더 엄격해진다)', () => {
    const from = makePlatform(1, 0, 0, 40)
    const toStatic = makePlatform(2, 0, 60, 40)
    const toMoving = makePlatform(3, 0, 60, 40, 'moving')

    // 정적끼리는 통과하지만 이동형이면 탈락하는 간격을 찾는다
    const dy = 60
    const budget = reachTime(dy) * C.MOVE_SPEED
    const x = 40 + budget - 5      // 정적 기준 예산 안쪽
    toStatic.x = x
    toMoving.x = x
    toMoving.movingOriginX = x

    expect(isReachable(from, toStatic)).toBe(true)
    expect(isReachable(from, toMoving)).toBe(false)
  })
})

describe('generateUpTo', () => {
  it('목표 높이까지 발판을 채운다', () => {
    const s = createGameState(defaultModifiers())
    generateUpTo(s, 2000, createRng(1))
    expect(s.highestGeneratedY).toBeGreaterThanOrEqual(2000)
    expect(s.platforms.length).toBeGreaterThan(20)
  })

  it('두 번 불러도 중복 생성하지 않는다', () => {
    const s = createGameState(defaultModifiers())
    const rng = createRng(1)
    generateUpTo(s, 2000, rng)
    const count = s.platforms.length
    generateUpTo(s, 2000, rng)
    expect(s.platforms.length).toBe(count)
  })

  it('모든 발판이 화면 폭 안에 있다', () => {
    const s = createGameState(defaultModifiers())
    generateUpTo(s, 5000, createRng(42))
    for (const p of s.platforms) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x + p.width).toBeLessThanOrEqual(C.LOGICAL_W)
    }
  })

  it('모든 발판 x가 정수다 (반올림 오차 원천 차단)', () => {
    const s = createGameState(defaultModifiers())
    generateUpTo(s, 12000, createRng(77))
    for (const p of s.platforms) {
      expect(Number.isInteger(p.x), `id=${p.id}`).toBe(true)
      expect(Number.isInteger(p.movingOriginX), `id=${p.id}`).toBe(true)
    }
  })

  it('발판 id가 유일하다', () => {
    const s = createGameState(defaultModifiers())
    generateUpTo(s, 3000, createRng(7))
    const ids = s.platforms.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('발판이 y 오름차순으로 쌓인다', () => {
    const s = createGameState(defaultModifiers())
    generateUpTo(s, 3000, createRng(7))
    for (let i = 1; i < s.platforms.length; i++) {
      expect(s.platforms[i]!.y).toBeGreaterThan(s.platforms[i - 1]!.y)
    }
  })

  it('높이 올라갈수록 발판이 좁아진다', () => {
    const s = createGameState(defaultModifiers())
    generateUpTo(s, C.DIFFICULTY_FULL_Y + 1000, createRng(3))
    const low = s.platforms.filter((p) => p.y > 100 && p.y < 1000)
    const high = s.platforms.filter((p) => p.y > C.DIFFICULTY_FULL_Y)
    const avg = (ps: typeof low) => ps.reduce((a, p) => a + p.width, 0) / ps.length
    expect(avg(high)).toBeLessThan(avg(low))
  })

  it('땅 구간에는 부서짐·움직임 발판이 없다', () => {
    const s = createGameState(defaultModifiers())
    generateUpTo(s, 2500, createRng(5))
    const groundOnes = s.platforms.filter((p) => p.y < C.SKY_START_Y && p.id !== 0)
    for (const p of groundOnes) {
      expect(['normal', 'spring']).toContain(p.kind)
    }
  })

  it('하늘 위로는 네 종류가 모두 나온다', () => {
    const s = createGameState(defaultModifiers())
    generateUpTo(s, 20000, createRng(99))
    const kinds = new Set(s.platforms.filter((p) => p.y > C.SKY_START_Y).map((p) => p.kind))
    expect(kinds.has('normal')).toBe(true)
    expect(kinds.has('spring')).toBe(true)
    expect(kinds.has('crumble')).toBe(true)
    expect(kinds.has('moving')).toBe(true)
  })
})

describe('generateUpTo — 도달 가능성 불변식 (이 태스크의 존재 이유)', () => {
  it('200개 시드 × 전 구간에서 모든 발판이 직전 발판에서 도달 가능하다', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = createGameState(defaultModifiers())
      generateUpTo(s, 12000, createRng(seed))

      for (let i = 1; i < s.platforms.length; i++) {
        const from = s.platforms[i - 1]!
        const to = s.platforms[i]!
        expect(
          isReachable(from, to),
          `seed=${seed} i=${i} from=(${from.x},${from.y},${from.kind}) to=(${to.x},${to.y},${to.kind})`,
        ).toBe(true)
      }
    }
  })
})

describe('prunePlatforms', () => {
  it('카메라 아래로 벗어난 발판을 제거한다', () => {
    const s = createGameState(defaultModifiers())
    generateUpTo(s, 3000, createRng(1))
    s.camera.y = 1500
    prunePlatforms(s)
    for (const p of s.platforms) {
      expect(p.y).toBeGreaterThanOrEqual(1500 - C.PRUNE_MARGIN)
    }
  })

  it('화면 안 발판은 남긴다', () => {
    const s = createGameState(defaultModifiers())
    generateUpTo(s, 3000, createRng(1))
    s.camera.y = 1000
    const before = s.platforms.filter((p) => p.y >= 1000).length
    prunePlatforms(s)
    expect(s.platforms.filter((p) => p.y >= 1000).length).toBe(before)
  })
})
