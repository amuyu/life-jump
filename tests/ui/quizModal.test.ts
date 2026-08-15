import { describe, it, expect } from 'vitest'
import { shuffleChoices } from '../../src/ui/quizModal'
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
