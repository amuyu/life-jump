import type { GameState, Platform } from './state'
import { makePlatform } from './state'
import * as C from '../constants'

/** 무적 시간 중인가 */
export function isInvulnerable(state: GameState): boolean {
  return state.run.time < state.run.invulnerableUntil
}

/** 부활 후보 발판인가 (소멸 예정·폐기 예정 제외) */
export function isReviveCandidate(state: GameState, p: Platform): boolean {
  if (p.dead) return false
  if (p.crumbleAt !== null) return false          // 곧 사라진다
  if (p.y < state.camera.y + C.REVIVE_MIN_MARGIN) return false   // 화면 밖 또는 폐기 예정
  return true
}

/** 부활 발판을 고른다. 후보가 없으면 구조 발판을 생성해 배열에 넣고 돌려준다. */
export function pickRevivePlatform(state: GameState): Platform {
  let best: Platform | null = null

  for (const p of state.platforms) {
    if (!isReviveCandidate(state, p)) continue
    if (best === null || p.y < best.y) best = p    // 가장 낮은 후보
  }

  if (best !== null) return best

  // 후보가 없다 — 구조 발판을 만든다
  const width = C.PLATFORM_W_START
  const rescue = makePlatform(
    state.nextPlatformId++,
    Math.round((C.LOGICAL_W - width) / 2),
    state.camera.y + C.RESCUE_MARGIN,
    width,
  )
  state.platforms.push(rescue)
  // y 오름차순을 유지한다 (다른 코드가 순서를 가정한다)
  state.platforms.sort((a, b) => a.y - b.y)
  return rescue
}

function revive(state: GameState): void {
  const platform = pickRevivePlatform(state)
  const p = state.player

  p.x = Math.min(
    Math.max(platform.x + platform.width / 2 - C.PLAYER_W / 2, 0),
    C.LOGICAL_W - C.PLAYER_W,
  )
  p.y = platform.y
  p.prevY = platform.y
  p.vx = 0
  p.vy = 0
  p.onGround = true
  p.doubleJumpUsed = false

  // 조건부 설정 — 이미 무적이면 기존 만료 시각을 유지한다 (연장 금지)
  if (!isInvulnerable(state)) {
    state.run.invulnerableUntil = state.run.time + C.INVULN_SECONDS
  }
}

/** 낙하 판정 시 호출. 스펙 7절의 5단계를 그대로 따른다. */
export function handleFall(state: GameState): void {
  const run = state.run

  // 1. 무적 중 — 에너지도 방석도 소모하지 않는다
  if (isInvulnerable(state)) {
    revive(state)
    return
  }

  // 2. 방석 — 재고가 아니라 이번 판의 효과를 소진한다
  if (run.cushionAvailable) {
    run.cushionAvailable = false
    revive(state)
    return
  }

  // 3. 에너지 감소
  run.energy -= 1

  // 4. 에너지 0 — 여기서 종료. 부활 발판을 찾지도, 구조 발판을 만들지도 않는다
  if (run.energy <= 0) {
    run.energy = 0
    run.over = true
    return
  }

  // 5. 부활
  revive(state)
}
