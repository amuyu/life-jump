import type { GameState } from './state'
import type { InputState } from '../core/input'
import type { Rng } from '../core/rng'
import { stepMotion, resolveLanding } from './physics'
import {
  stepMovingPlatforms, applyLandingEffect, stepCrumbling,
  generateUpTo, prunePlatforms,
} from './platforms'
import { updateCamera, isBelowFallLine } from './camera'
import { handleFall } from './survival'
import * as C from '../constants'

export interface UpdateDeps {
  rng: Rng
}

export function stepGame(state: GameState, input: InputState, deps: UpdateDeps): void {
  if (state.paused || state.run.over) return

  state.run.time += C.STEP

  // 이동 발판이 먼저 — 위에 선 플레이어를 실어 나른 뒤 입력을 적용한다
  const standing = state.standingOnId === null
    ? null
    : state.platforms.find((p) => p.id === state.standingOnId) ?? null

  stepMovingPlatforms(state, C.STEP, state.player.onGround ? standing : null)

  stepMotion(state, input, C.STEP)

  const landed = resolveLanding(state)
  if (landed !== null) {
    state.standingOnId = landed.id
    applyLandingEffect(state, landed)
    if (!state.player.onGround) state.standingOnId = null   // 스프링으로 즉시 이탈
  } else if (!state.player.onGround) {
    state.standingOnId = null
  }

  stepCrumbling(state)

  // 밟고 있던 발판이 부서졌으면 떨어진다
  if (state.standingOnId !== null) {
    const cur = state.platforms.find((p) => p.id === state.standingOnId)
    if (cur === undefined || cur.dead) {
      state.player.onGround = false
      state.standingOnId = null
    }
  }

  updateCamera(state)

  if (isBelowFallLine(state)) {
    handleFall(state)
    if (state.run.over) return
    state.standingOnId = null
  }

  generateUpTo(state, state.camera.y + C.GENERATE_AHEAD, deps.rng)
  prunePlatforms(state)
}
