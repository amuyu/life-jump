import type { GameState, ItemKind, RunState } from './state'
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

  const inSpace = platformY >= C.SPACE_START_Y

  // 우주에는 생명 유지 장치가 없다 — 음식 몫(2%)은 코인으로 넘어간다 (스펙 8절).
  // 수입을 깎는 변경이 아니라 **회복을 없애는** 변경이다: grantFood가 에너지 가득일 때
  // 이미 코인으로 바꿔주므로, 성한 플레이어에겐 원래도 코인이었다. 다친 플레이어만
  // 우주가 편도가 된다. 드랍 밀도를 유지하려고 없애지 않고 코인으로 돌린다.
  // 회복 수단이 0이 되지는 않는다 — 퀴즈 보상의 에너지는 우주에서도 그대로다.
  if (kind === 'food' && inSpace) {
    return { kind: 'coin', amount: rng.int(2, 3) }
  }

  // 우주 구간에서는 실·코인이 여러 개씩 (스펙 8절)
  if ((kind === 'thread' || kind === 'coin') && inSpace) {
    return { kind, amount: rng.int(2, 3) }
  }
  return { kind, amount: 1 }
}

/**
 * 음식 보상을 지급한다 — 에너지가 가득이면 코인으로 바꾼다 (스펙 8절).
 *
 * 발판 아이템과 퀴즈 보상이 **같은 함수**를 쓴다. 두 곳에 규칙을 따로 쓰면
 * 한쪽만 클램프해 보상이 조용히 증발한다 (실제로 퀴즈 쪽이 그랬다).
 */
export function grantFood(run: RunState, amount: number): void {
  for (let i = 0; i < amount; i++) {
    if (run.energy < run.maxEnergy) run.energy += 1
    else run.coins += C.FOOD_TO_COIN
  }
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

    // 이미 퀴즈를 하나 들고 있으면 두 번째 물음표는 줍지 않고 발판에 남겨둔다.
    // 들 수 있는 건 하나뿐이라, 주워버리면 조용히 사라지는 셈이 된다.
    if (kind === 'quiz' && state.heldQuiz !== null) continue

    // 먼저 비워야 같은 프레임에 두 번 처리되지 않는다
    plat.item = null
    plat.itemAmount = 0

    if (kind === 'thread') {
      state.run.thread += amount
    } else if (kind === 'coin') {
      state.run.coins += amount
    } else if (kind === 'food') {
      grantFood(state.run, 1)
    } else if (state.player.onGround) {
      // 물음표를 땅에서 주웠다 — 바로 멈추고 퀴즈를 예약한다
      state.pendingQuiz = { platformY: plat.y }
      state.paused = true
      return    // 일시정지했으므로 나머지는 다음에 줍는다
    } else {
      // 공중이다 — 착지할 때까지 들고만 있는다. 멈추지 않으므로 이번 프레임의
      // 나머지 아이템도 계속 줍는다. 승격은 update.ts가 착지 판정 뒤에 한다.
      state.heldQuiz = { platformY: plat.y }
    }
  }
}
