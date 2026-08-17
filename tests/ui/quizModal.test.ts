import { describe, it, expect } from 'vitest'
import { shuffleChoices, rewardOptions } from '../../src/ui/quizModal'
import { FOOD_TO_COIN } from '../../src/constants'
import { QUESTIONS } from '../../src/game/quiz'
import { createRng } from '../../src/core/rng'

describe('shuffleChoices', () => {
  const q = QUESTIONS[0]!

  it('보기를 섞어도 같은 네 개다', () => {
    const rng = createRng(7)
    for (let i = 0; i < 200; i++) {
      const s = shuffleChoices(q, rng)
      expect([...s.choices].sort()).toEqual([...q.choices].sort())
    }
  })

  it('정답 인덱스가 같은 문자열을 계속 가리킨다', () => {
    const rng = createRng(11)
    for (const question of QUESTIONS) {
      for (let i = 0; i < 5; i++) {
        const s = shuffleChoices(question, rng)
        expect(s.choices[s.answer]).toBe(question.choices[question.answer])
      }
    }
  })

  it('네 자리가 모두 정답이 될 수 있다', () => {
    const rng = createRng(3)
    const seen = new Set<number>()
    for (let i = 0; i < 200; i++) seen.add(shuffleChoices(q, rng).answer)
    expect([...seen].sort()).toEqual([0, 1, 2, 3])
  })

  it('quiz.json의 정답 편향을 실제로 없앤다', () => {
    // 원본 분포는 {0:5, 1:17, 2:16, 3:2} — 늘 1번을 찍으면 42.5%를 맞힌다.
    const before = [0, 0, 0, 0]
    for (const question of QUESTIONS) before[question.answer] = before[question.answer]! + 1
    expect(Math.max(...before) / QUESTIONS.length).toBeGreaterThan(0.35)

    const rng = createRng(2024)
    const after = [0, 0, 0, 0]
    for (let i = 0; i < 50; i++) {
      for (const question of QUESTIONS) {
        const a = shuffleChoices(question, rng).answer
        after[a] = after[a]! + 1
      }
    }
    const total = QUESTIONS.length * 50
    for (const count of after) {
      expect(count / total).toBeGreaterThan(0.2)
      expect(count / total).toBeLessThan(0.3)
    }
  })
})

describe('rewardOptions', () => {
  const reward = { thread: 12, coin: 12, food: 1 }

  it('실·코인·에너지 순서로 세 개, 라벨에 보상 수치가 들어간다', () => {
    const opts = rewardOptions(reward)
    expect(opts.map((o) => o.kind)).toEqual(['thread', 'coin', 'food'])
    expect(opts[0]!.label).toBe('실 12개')
    expect(opts[1]!.label).toBe('코인 12개')
    expect(opts[2]!.label).toBe('에너지 +1')
  })

  it('부연설명이 각 재화의 실제 쓰임새를 말한다', () => {
    // 플레이어는 이 화면에서 처음으로 세 재화를 비교한다 — 어디에 쓰는지 모르면 고를 수 없다.
    const [thread, coin, food] = rewardOptions(reward)
    expect(thread!.desc).toContain('옷')
    expect(coin!.desc).toContain('상점')
    expect(food!.desc).toContain('목숨')
  })

  it('에너지 설명은 가득일 때 코인으로 바뀌는 규칙과 그 수치를 알려준다', () => {
    // items.ts 의 grantFood 규칙 — 모르고 고르면 "왜 코인이 늘었지" 가 된다.
    // 숫자는 상수에서 오므로 값이 바뀌어도 문구가 거짓이 되지 않는다.
    const food = rewardOptions(reward)[2]!
    expect(food.desc).toContain(`코인 ${FOOD_TO_COIN}개`)
  })
})
