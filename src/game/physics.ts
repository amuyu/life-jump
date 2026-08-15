import type { GameState } from './state'
import type { InputState } from '../core/input'
import * as C from '../constants'

/** 한 스텝의 수평 이동·점프 발동·중력을 적용한다. 충돌은 Task 8이 별도로 처리한다. */
export function stepMotion(state: GameState, input: InputState, dt: number): void {
  const p = state.player
  const run = state.run

  // 1. 수평 이동
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  p.vx = dir * run.moveSpeed
  p.x += p.vx * dt

  // 좌우 벽
  if (p.x < 0) p.x = 0
  const maxX = C.LOGICAL_W - C.PLAYER_W
  if (p.x > maxX) p.x = maxX

  // 2. 점프 발동 (keydown 엣지에서만)
  if (input.jumpPressed) {
    if (p.onGround) {
      p.vy = run.jumpVelocity
      p.onGround = false
      p.doubleJumpUsed = false
    } else if (run.doubleJumpEnabled && !p.doubleJumpUsed) {
      p.vy = run.jumpVelocity
      p.doubleJumpUsed = true
    }
  }

  // 3. 가변 점프 컷오프 — 상승 중에 키를 떼면 속도를 자른다
  if (!input.jumpHeld && p.vy > C.JUMP_CUTOFF) {
    p.vy = C.JUMP_CUTOFF
  }

  // 4. 중력
  p.vy -= run.gravity * dt
  if (p.vy < -C.MAX_FALL) p.vy = -C.MAX_FALL

  // 5. 수직 이동 — 스윕 충돌이 쓸 수 있도록 이전 위치를 남긴다
  p.prevY = p.y
  p.y += p.vy * dt
}
