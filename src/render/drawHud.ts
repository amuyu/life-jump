import type { GameState } from '../game/state'
import type { Screen } from './canvas'
import * as C from '../constants'
import { ITEM_MAPS, ITEM_PALETTES } from '../data/pixelmaps'
import { bakeSprite, spriteCache, type Sprite } from './sprites'

const HEART_W = 9

// 재화 라벨은 발판에서 줍는 아이템 스프라이트를 그대로 쓴다 — 플레이어가 이미 본
// 그림이라 따로 익힐 게 없다. 'T'/'C' 같은 머리글자는 한국어 화면에서 단서가 없다.
// 모듈 레벨 캐시지만 실·코인 스프라이트는 옷차림과 무관해 평생 바뀌지 않는다.
// bakeSprite는 cache.get 안에서만 불리므로 import 시점에 document를 건드리지 않는다.
const iconCache = spriteCache()
const currencyIcon = (kind: 'thread' | 'coin'): Sprite =>
  iconCache.get(`hud:${kind}`, () => bakeSprite(ITEM_MAPS[kind], ITEM_PALETTES[kind]))

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

  // 재화 — 아이콘 + 숫자. 하늘색 배경에서 흰 글자가 얇아 보여서 높이 표시와
  // 같은 1px 그림자를 깔아 대비를 맞춘다.
  ctx.textAlign = 'left'
  const drawCurrency = (kind: 'thread' | 'coin', x: number, value: number): void => {
    ctx.drawImage(currencyIcon(kind), x, 14)
    const textX = x + 10
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillText(`${value}`, textX + 1, 16)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`${value}`, textX, 15)
  }
  drawCurrency('thread', 4, run.thread)
  drawCurrency('coin', 44, run.coins)
}
