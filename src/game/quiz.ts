import type { Rng } from '../core/rng'
import { zoneAt } from './zones'
import raw from '../data/quiz.json'

export type Difficulty = 'easy' | 'normal' | 'hard'

export interface Question {
  id: string
  difficulty: Difficulty
  q: string
  choices: [string, string, string, string]
  answer: number
}

export type RewardKind = 'thread' | 'coin' | 'food'

export interface Reward {
  thread: number
  coin: number
  food: number
}

export const QUESTIONS: readonly Question[] = raw.questions as Question[]

export function difficultyFor(platformY: number): Difficulty {
  const zone = zoneAt(platformY)
  if (zone === 'space') return 'hard'
  if (zone === 'sky') return 'normal'
  return 'easy'
}

export function rewardFor(d: Difficulty): Reward {
  if (d === 'hard') return { thread: 12, coin: 12, food: 1 }
  if (d === 'normal') return { thread: 6, coin: 6, food: 1 }
  return { thread: 3, coin: 3, food: 1 }
}

export function pickQuestion(platformY: number, seen: string[], rng: Rng): Question {
  const difficulty = difficultyFor(platformY)
  const pool = QUESTIONS.filter((q) => q.difficulty === difficulty)

  let fresh = pool.filter((q) => !seen.includes(q.id))

  if (fresh.length === 0) {
    // 이 난이도만 소진 — 해당 난이도 이력만 지운다
    const poolIds = new Set(pool.map((q) => q.id))
    for (let i = seen.length - 1; i >= 0; i--) {
      if (poolIds.has(seen[i]!)) seen.splice(i, 1)
    }
    fresh = [...pool]
  }

  const picked = rng.pick(fresh)
  seen.push(picked.id)
  return picked
}
