import type { SaveData } from './core/storage'
import type { RunModifiers, RunState } from './game/state'
import { modifiersFrom, consumeSelected, type ConsumableId } from './data/shop'

export interface StartRunResult {
  mods: RunModifiers
  applied: ConsumableId[]
}

/**
 * 게임 시작 절차 (스펙 8절, 10절): consumeSelected로 재고를 차감하고 실제
 * 적용분을 받은 뒤, 그 적용분만 modifiersFrom에 넘긴다. save를 제자리에서
 * 변경하지만 저장(writeSave)이나 게임 상태 생성(createGameState)은 호출자의
 * 몫이다 — 이 함수는 순수하지 않지만(재고 차감), DOM·영속화와는 무관하다.
 */
export function startRun(save: SaveData): StartRunResult {
  const applied = consumeSelected(save)
  const mods = modifiersFrom(save, applied)
  return { mods, applied }
}

export interface FinishRunResult {
  isNewBest: boolean
}

/**
 * 판 종료 결산: 획득한 실·코인을 누적하고, 도전 횟수를 늘리고, 최고기록을
 * 엄격히(strict) 갱신될 때만 갱신한다. 저장(writeSave)이나 화면 전환은
 * 호출자의 몫이다.
 */
export function finishRun(save: SaveData, run: RunState): FinishRunResult {
  save.thread += run.thread
  save.coins += run.coins
  save.totalRuns += 1

  const isNewBest = run.maxHeight > save.bestHeight
  if (isNewBest) save.bestHeight = run.maxHeight

  return { isNewBest }
}
