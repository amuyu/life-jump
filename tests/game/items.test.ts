import { describe, it, expect } from 'vitest'
import { rollDrop, dropForRoll, collectItems } from '../../src/game/items'
import { createGameState, defaultModifiers, makePlatform } from '../../src/game/state'
import { createRng } from '../../src/core/rng'
import * as C from '../../src/constants'

describe('dropForRoll — 경계 매핑 (결정론적, 절대 흔들리지 않는다)', () => {
  const CASES: Array<[number, string | null]> = [
    [0,        null],
    [0.5,      null],
    [0.8199,   null],
    [0.82,     'thread'],
    [0.8999,   'thread'],
    [0.90,     'coin'],
    [0.9699,   'coin'],
    [0.97,     'food'],
    [0.9899,   'food'],
    [0.99,     'quiz'],
    [0.99999,  'quiz'],
  ]

  for (const [roll, expected] of CASES) {
    it(`roll=${roll} → ${expected ?? '없음'}`, () => {
      expect(dropForRoll(roll)).toBe(expected)
    })
  }
})

describe('rollDrop — 통계 (넓은 허용오차)', () => {
  it('10만 회 표본이 명세 ±20% 안에 든다', () => {
    const rng = createRng(2024)
    const counts: Record<string, number> = { none: 0, thread: 0, coin: 0, food: 0, quiz: 0 }
    const N = 100_000

    for (let i = 0; i < N; i++) {
      const d = rollDrop(1000, rng)
      counts[d.kind ?? 'none'] = (counts[d.kind ?? 'none'] ?? 0) + 1
    }

    const check = (key: string, expected: number) => {
      const ratio = counts[key]! / N
      expect(ratio, `${key} 실제 ${ratio.toFixed(4)} 기대 ${expected}`)
        .toBeGreaterThan(expected * 0.8)
      expect(ratio, `${key} 실제 ${ratio.toFixed(4)} 기대 ${expected}`)
        .toBeLessThan(expected * 1.2)
    }

    check('none', 0.82)
    check('thread', 0.08)
    check('coin', 0.07)
    check('food', 0.02)
    check('quiz', 0.01)
  })
})

describe('rollDrop — 우주 보너스', () => {
  it('우주 아래에서는 실·코인이 1개씩이다', () => {
    const rng = createRng(5)
    for (let i = 0; i < 3000; i++) {
      const d = rollDrop(1000, rng)
      if (d.kind === 'thread' || d.kind === 'coin') expect(d.amount).toBe(1)
    }
  })

  it('우주에서는 실·코인이 2~3개씩이다', () => {
    const rng = createRng(5)
    let saw = false
    for (let i = 0; i < 3000; i++) {
      const d = rollDrop(C.SPACE_START_Y + 500, rng)
      if (d.kind === 'thread' || d.kind === 'coin') {
        expect(d.amount).toBeGreaterThanOrEqual(2)
        expect(d.amount).toBeLessThanOrEqual(3)
        saw = true
      }
    }
    expect(saw).toBe(true)
  })

  it('음식과 퀴즈는 우주에서도 1개다', () => {
    const rng = createRng(11)
    for (let i = 0; i < 5000; i++) {
      const d = rollDrop(C.SPACE_START_Y + 500, rng)
      if (d.kind === 'food' || d.kind === 'quiz') expect(d.amount).toBe(1)
    }
  })

  it('아이템이 없으면 amount는 0이다', () => {
    const rng = createRng(3)
    for (let i = 0; i < 1000; i++) {
      const d = rollDrop(1000, rng)
      if (d.kind === null) expect(d.amount).toBe(0)
    }
  })
})

/** 플레이어를 발판 위에 세운 상태 */
function pickupScene(item: 'thread' | 'coin' | 'food' | 'quiz', amount = 1) {
  const s = createGameState(defaultModifiers())
  const p = makePlatform(1, 60, 200, 40)
  p.item = item
  p.itemAmount = amount
  s.platforms = [p]
  s.player.x = 74
  s.player.y = 200
  return s
}

describe('collectItems', () => {
  it('실을 주우면 run.thread가 는다', () => {
    const s = pickupScene('thread', 2)
    collectItems(s)
    expect(s.run.thread).toBe(2)
    expect(s.platforms[0]!.item).toBeNull()
  })

  it('코인을 주우면 run.coins가 는다', () => {
    const s = pickupScene('coin', 3)
    collectItems(s)
    expect(s.run.coins).toBe(3)
  })

  it('음식은 에너지를 1 채운다', () => {
    const s = pickupScene('food')
    s.run.energy = 1
    collectItems(s)
    expect(s.run.energy).toBe(2)
  })

  it('에너지가 가득이면 음식이 코인으로 바뀐다', () => {
    const s = pickupScene('food')
    s.run.energy = s.run.maxEnergy
    collectItems(s)
    expect(s.run.energy).toBe(s.run.maxEnergy)
    expect(s.run.coins).toBe(C.FOOD_TO_COIN)
  })

  it('물음표는 퀴즈를 예약하고 일시정지시킨다', () => {
    const s = pickupScene('quiz')
    collectItems(s)
    expect(s.pendingQuiz).toEqual({ platformY: 200 })
    expect(s.paused).toBe(true)
    expect(s.platforms[0]!.item).toBeNull()
  })

  it('멀리 있는 아이템은 줍지 않는다', () => {
    const s = pickupScene('coin')
    s.player.x = 5
    s.player.y = 200
    collectItems(s)
    expect(s.run.coins).toBe(0)
    expect(s.platforms[0]!.item).toBe('coin')
  })

  it('자석이 있으면 더 멀리서도 줍는다', () => {
    const s = pickupScene('coin')
    s.player.x = 30
    s.player.y = 200
    s.run.magnetRadius = 40
    collectItems(s)
    expect(s.run.coins).toBe(1)
  })

  it('같은 아이템을 두 번 줍지 않는다', () => {
    const s = pickupScene('coin', 5)
    collectItems(s)
    collectItems(s)
    expect(s.run.coins).toBe(5)
  })

  it('죽은 발판의 아이템은 줍지 않는다', () => {
    const s = pickupScene('coin')
    s.platforms[0]!.dead = true
    collectItems(s)
    expect(s.run.coins).toBe(0)
  })
})
