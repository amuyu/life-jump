import type { GameState } from '../game/state'
import type { Screen } from './canvas'
import * as C from '../constants'

const HEART_W = 9
const HEART_H = 8

function drawHeart(
  ctx: CanvasRenderingContext2D, x: number, y: number, filled: boolean,
): void {
  ctx.fillStyle = filled ? '#eb4d4b' : 'rgba(0,0,0,0.28)'
  // 8×7 하트를 사각형 세 개로 근사한다
  ctx.fillRect(x + 1, y + 1, 2, 2)
  ctx.fillRect(x + 5, y + 1, 2, 2)
  ctx.fillRect(x, y + 2, 8, 3)
  ctx.fillRect(x + 1, y + 5, 6, 1)
  ctx.fillRect(x + 3, y + 6, 2, 1)
}

export function drawHud(screen: Screen, state: GameState): void {
  const ctx = screen.ctx
  const run = state.run

  // 에너지
  for (let i = 0; i < run.maxEnergy; i++) {
    drawHeart(ctx, 4 + i * (HEART_W + 1), 4, i < run.energy)
  }

  ctx.font = '8px monospace'
  ctx.textBaseline = 'top'

  // 높이 (10px = 1m)
  const meters = Math.floor(run.maxHeight / C.PX_PER_M)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillText(`${meters}m`, C.LOGICAL_W - 3, 5)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(`${meters}m`, C.LOGICAL_W - 4, 4)

  // 재화
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(`T ${run.thread}`, 4, 15)
  ctx.fillText(`C ${run.coins}`, 44, 15)
}
