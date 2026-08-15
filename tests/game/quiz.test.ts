import { describe, it, expect } from 'vitest'
import { difficultyFor, rewardFor, pickQuestion, QUESTIONS } from '../../src/game/quiz'
import { createRng } from '../../src/core/rng'
import * as C from '../../src/constants'

describe('문제 데이터', () => {
  it('40문항이다', () => {
    expect(QUESTIONS.length).toBe(40)
  })

  it('id가 유일하다', () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(40)
  })

  it('모든 문제의 보기가 4개다', () => {
    for (const q of QUESTIONS) expect(q.choices.length, q.id).toBe(4)
  })

  it('정답 인덱스가 0~3 범위다', () => {
    for (const q of QUESTIONS) {
      expect(q.answer, q.id).toBeGreaterThanOrEqual(0)
      expect(q.answer, q.id).toBeLessThanOrEqual(3)
    }
  })

  it('보기에 중복이 없다', () => {
    for (const q of QUESTIONS) {
      expect(new Set(q.choices).size, q.id).toBe(4)
    }
  })

  it('질문과 보기가 비어 있지 않다', () => {
    for (const q of QUESTIONS) {
      expect(q.q.length, q.id).toBeGreaterThan(0)
      for (const c of q.choices) expect(c.length, q.id).toBeGreaterThan(0)
    }
  })

  it('세 난이도가 모두 존재한다', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      expect(QUESTIONS.filter((q) => q.difficulty === d).length, d).toBeGreaterThan(0)
    }
  })
})

describe('difficultyFor — 발판 높이 기준 (스펙 11절)', () => {
  it('땅 구간은 easy', () => {
    expect(difficultyFor(0)).toBe('easy')
    expect(difficultyFor(C.SKY_START_Y - 1)).toBe('easy')
  })

  it('하늘 구간은 normal', () => {
    expect(difficultyFor(C.SKY_START_Y)).toBe('normal')
    expect(difficultyFor(C.SPACE_START_Y - 1)).toBe('normal')
  })

  it('우주 구간은 hard', () => {
    expect(difficultyFor(C.SPACE_START_Y)).toBe('hard')
    expect(difficultyFor(50000)).toBe('hard')
  })
})

describe('rewardFor', () => {
  it('스펙 표와 일치한다', () => {
    expect(rewardFor('easy')).toEqual({ thread: 3, coin: 3, food: 1 })
    expect(rewardFor('normal')).toEqual({ thread: 6, coin: 6, food: 1 })
    expect(rewardFor('hard')).toEqual({ thread: 12, coin: 12, food: 1 })
  })

  it('음식은 난이도와 무관하게 1이다', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      expect(rewardFor(d).food).toBe(1)
    }
  })
})

describe('pickQuestion', () => {
  it('발판 높이에 맞는 난이도를 고른다', () => {
    const rng = createRng(1)
    expect(pickQuestion(100, [], rng).difficulty).toBe('easy')
    expect(pickQuestion(C.SKY_START_Y + 100, [], rng).difficulty).toBe('normal')
    expect(pickQuestion(C.SPACE_START_Y + 100, [], rng).difficulty).toBe('hard')
  })

  it('고른 문제 id를 seen에 추가한다', () => {
    const seen: string[] = []
    const q = pickQuestion(100, seen, createRng(1))
    expect(seen).toContain(q.id)
  })

  it('이미 나온 문제를 다시 고르지 않는다', () => {
    const seen: string[] = []
    const rng = createRng(1)
    const easyCount = QUESTIONS.filter((q) => q.difficulty === 'easy').length

    const picked: string[] = []
    for (let i = 0; i < easyCount; i++) {
      picked.push(pickQuestion(100, seen, rng).id)
    }
    expect(new Set(picked).size).toBe(easyCount)
  })

  it('난이도가 소진되면 그 난이도 이력만 비우고 계속 낸다', () => {
    const seen: string[] = []
    const rng = createRng(1)
    const easyCount = QUESTIONS.filter((q) => q.difficulty === 'easy').length

    // easy를 전부 소진하고, hard도 하나 풀어 이력에 남긴다
    for (let i = 0; i < easyCount; i++) pickQuestion(100, seen, rng)
    const hardId = pickQuestion(C.SPACE_START_Y, seen, rng).id

    // 한 문제 더 — easy 이력이 초기화되어야 한다
    const extra = pickQuestion(100, seen, rng)
    expect(extra.difficulty).toBe('easy')
    // hard 이력은 살아 있어야 한다
    expect(seen).toContain(hardId)
  })

  it('수백 번 호출해도 예외가 없다', () => {
    const seen: string[] = []
    const rng = createRng(9)
    expect(() => {
      for (let i = 0; i < 500; i++) pickQuestion(i * 40, seen, rng)
    }).not.toThrow()
  })
})
