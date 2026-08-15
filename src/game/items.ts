import type { GameState, ItemKind } from './state'
import type { Rng } from '../core/rng'
import * as C from '../constants'

export interface Drop {
  kind: ItemKind | null
  amount: number
}

// 누적 경계 — dropForRoll과 통계 테스트가 같은 값을 본다
const T_THREAD = 0.82
const T_COIN = 0.90
const T_FOOD = 0.97
const T_QUIZ = 0.99

export function dropForRoll(roll: number): ItemKind | null {
  if (roll < T_THREAD) return null
  if (roll < T_COIN) return 'thread'
  if (roll < T_FOOD) return 'coin'
  if (roll < T_QUIZ) return 'food'
  return 'quiz'
}

export function rollDrop(platformY: number, rng: Rng): Drop {
  const kind = dropForRoll(rng.next())
  if (kind === null) return { kind: null, amount: 0 }

  // 우주 구간에서는 실·코인이 여러 개씩 (스펙 8절)
  if ((kind === 'thread' || kind === 'coin') && platformY >= C.SPACE_START_Y) {
    return { kind, amount: rng.int(2, 3) }
  }
  return { kind, amount: 1 }
}

export function collectItems(state: GameState): void {
  const p = state.player
  const pad = C.ITEM_PICKUP_PAD + state.run.magnetRadius

  const left = p.x - pad
  const right = p.x + C.PLAYER_W + pad
  const bottom = p.y - pad
  const top = p.y + C.PLAYER_H + pad

  for (const plat of state.platforms) {
    if (plat.dead || plat.item === null) continue

    // 아이템은 발판 상단 중앙에 놓인다
    const ix = plat.x + plat.width / 2
    const iy = plat.y + 4

    if (ix < left || ix > right) continue
    if (iy < bottom || iy > top) continue

    const kind = plat.item
    const amount = plat.itemAmount

    // 먼저 비워야 같은 프레임에 두 번 처리되지 않는다
    plat.item = null
    plat.itemAmount = 0

    if (kind === 'thread') {
      state.run.thread += amount
    } else if (kind === 'coin') {
      state.run.coins += amount
    } else if (kind === 'food') {
      if (state.run.energy < state.run.maxEnergy) {
        state.run.energy += 1
      } else {
        state.run.coins += C.FOOD_TO_COIN
      }
    } else {
      // 물음표 — 게임을 멈추고 퀴즈를 예약한다
      state.pendingQuiz = { platformY: plat.y }
      state.paused = true
      return    // 일시정지했으므로 나머지는 다음에 줍는다
    }
  }
}
