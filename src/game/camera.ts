import type { GameState } from './state'
import * as C from '../constants'

/** 카메라 추종과 run.maxHeight 갱신. 둘 다 단조 증가한다. */
export function updateCamera(state: GameState): void {
  const target = state.player.y - C.CAMERA_FOLLOW_OFFSET
  if (target > state.camera.y) state.camera.y = target

  if (state.player.y > state.run.maxHeight) {
    state.run.maxHeight = state.player.y
  }
}

/** 화면 아래로 벗어났는지 판정 */
export function isBelowFallLine(state: GameState): boolean {
  return state.player.y < state.camera.y + C.FALL_LINE_OFFSET
}
