import type { GameState, Platform } from './state'
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

/**
 * 이번 스텝에 착지한 발판을 돌려준다. 착지했으면 player.y/vy/onGround를 갱신한다.
 * 착지하지 않았으면 null.
 *
 * onGround는 여기서 양방향으로 결정된다. 발판 위에 서 있는 동안에도 중력이
 * 매 스텝 발바닥을 상단선 아래로 밀어내므로 매 스텝 다시 착지 판정을 통과한다.
 * 따라서 "하강 중인데 이번 스텝에 아무 발판도 가로지르지 않았다"는 곧
 * **발판 끝에서 걸어 나갔다**는 뜻이며, 그 순간 onGround를 내려야 한다.
 * 내리지 않으면 낙하 내내 지상 점프(그리고 더블 점프 재충전)가 가능해진다.
 *
 * 단순 사각형 겹침 검사가 아니라 prevY..y 구간이 발판 상단선을 가로질렀는지
 * 검사한다 — 최대 낙하 속도(600px/s)는 프레임당 10px 이동인데 발판은 6px
 * 두께라서, 겹침 검사만으로는 고속 낙하 시 발판을 관통해버린다.
 */
export function resolveLanding(state: GameState): Platform | null {
  const p = state.player

  if (p.vy >= 0) return null // 상승 중이거나 정지 — 착지 없음

  const left = p.x
  const right = p.x + C.PLAYER_W

  let best: Platform | null = null

  for (const plat of state.platforms) {
    if (plat.dead) continue

    // 발바닥이 이번 스텝에 상단선을 가로질렀는가
    if (!(p.prevY >= plat.y && p.y < plat.y)) continue

    // x축이 실제로 겹치는가 (경계 접촉은 겹침이 아니다)
    if (!(left < plat.x + plat.width && right > plat.x)) continue

    // 여러 개를 가로질렀다면 가장 높은(= 먼저 만나는) 것
    if (best === null || plat.y > best.y) best = plat
  }

  if (best === null) {
    // 하강 중인데 밟은 것이 없다 — 발판 끝을 벗어났다
    p.onGround = false
    return null
  }

  p.y = best.y
  p.prevY = best.y
  p.vy = 0
  p.onGround = true
  p.doubleJumpUsed = false
  return best
}
