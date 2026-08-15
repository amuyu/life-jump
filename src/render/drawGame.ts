import type { GameState, Platform } from '../game/state'
import type { Screen } from './canvas'
import { bakeSprite, spriteCache, type Sprite } from './sprites'
import {
  PLAYER_IDLE, PLAYER_JUMP, SKIN_PALETTE,
  PLATFORM_MAPS, PLATFORM_PALETTES,
  ITEM_MAPS, ITEM_PALETTES, mapSize,
} from '../data/pixelmaps'
import { zoneVisual, type Rgb } from '../game/zones'
import * as C from '../constants'

export interface Renderer {
  draw(state: GameState): void
  /** 착용 옷이 바뀌면 호출 — 스프라이트 캐시를 비운다 */
  invalidate(): void
}

const rgb = (c: Rgb): string => `rgb(${c.r},${c.g},${c.b})`

/** 배경 별·구름은 카메라보다 느리게 흐른다 (패럴랙스) */
interface Speck { x: number; y: number; size: number; speed: number }

function makeSpecks(count: number, seedStep: number): Speck[] {
  const out: Speck[] = []
  // 결정론적 배치 — 배경이라 시드 RNG를 쓰지 않고 고정 패턴을 쓴다
  for (let i = 0; i < count; i++) {
    const a = (i * seedStep) % 997
    out.push({
      x: (a * 37) % C.LOGICAL_W,
      y: (a * 53) % C.LOGICAL_H,
      size: (a % 3 === 0) ? 2 : 1,
      speed: 0.15 + ((a % 5) / 20),
    })
  }
  return out
}

const STARS = makeSpecks(60, 13)
const CLOUDS = makeSpecks(14, 29)

export function createRenderer(screen: Screen): Renderer {
  const cache = spriteCache()

  const platformTile = (kind: Platform['kind']): Sprite =>
    cache.get(`plat:${kind}`, () =>
      bakeSprite(PLATFORM_MAPS[kind], PLATFORM_PALETTES[kind]))

  const itemSprite = (kind: keyof typeof ITEM_MAPS): Sprite =>
    cache.get(`item:${kind}`, () =>
      bakeSprite(ITEM_MAPS[kind], ITEM_PALETTES[kind]))

  // Task 19에서 옷 팔레트를 합쳐 키를 확장한다
  const playerSprite = (jumping: boolean): Sprite =>
    cache.get(`player:${jumping ? 'jump' : 'idle'}`, () =>
      bakeSprite(jumping ? PLAYER_JUMP : PLAYER_IDLE, {
        ...SKIN_PALETTE,
        c: '#3498db',    // 기본 티셔츠 — Task 19가 착용 옷으로 대체한다
      }))

  const drawBackground = (state: GameState): void => {
    const ctx = screen.ctx
    const v = zoneVisual(state.camera.y + C.LOGICAL_H / 2)

    const grad = ctx.createLinearGradient(0, 0, 0, C.LOGICAL_H)
    grad.addColorStop(0, rgb(v.top))
    grad.addColorStop(1, rgb(v.bottom))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, C.LOGICAL_W, C.LOGICAL_H)

    if (v.starAlpha > 0.01) {
      ctx.fillStyle = '#ffffff'
      for (const s of STARS) {
        // 반짝임 — 위치 기반이라 프레임마다 흔들리지 않는다
        const twinkle = 0.6 + 0.4 * Math.sin(state.run.time * 2 + s.x)
        ctx.globalAlpha = v.starAlpha * twinkle
        const y = ((s.y + state.camera.y * s.speed) % C.LOGICAL_H + C.LOGICAL_H) % C.LOGICAL_H
        ctx.fillRect(Math.round(s.x), Math.round(C.LOGICAL_H - y), s.size, s.size)
      }
      ctx.globalAlpha = 1
    }

    if (v.cloudAlpha > 0.01) {
      ctx.fillStyle = '#ffffff'
      ctx.globalAlpha = v.cloudAlpha * 0.5
      for (const c of CLOUDS) {
        const y = ((c.y + state.camera.y * c.speed) % C.LOGICAL_H + C.LOGICAL_H) % C.LOGICAL_H
        const sy = Math.round(C.LOGICAL_H - y)
        ctx.fillRect(Math.round(c.x), sy, 22, 5)
        ctx.fillRect(Math.round(c.x) + 5, sy - 3, 13, 4)
      }
      ctx.globalAlpha = 1
    }
  }

  const drawPlatforms = (state: GameState): void => {
    const ctx = screen.ctx
    for (const p of state.platforms) {
      if (p.dead) continue

      const sy = Math.round(C.LOGICAL_H - (p.y - state.camera.y))
      if (sy < -C.PLATFORM_THICKNESS || sy > C.LOGICAL_H) continue

      const tile = platformTile(p.kind)
      const tw = mapSize(PLATFORM_MAPS[p.kind]).w
      const x0 = Math.round(p.x)

      // 곧 부서지는 발판은 깜빡인다
      if (p.crumbleAt !== null) {
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(state.run.time * 25))
      }

      for (let dx = 0; dx < p.width; dx += tw) {
        const w = Math.min(tw, p.width - dx)
        ctx.drawImage(tile, 0, 0, w, C.PLATFORM_THICKNESS,
          x0 + dx, sy, w, C.PLATFORM_THICKNESS)
      }
      ctx.globalAlpha = 1

      if (p.item !== null) {
        const sprite = itemSprite(p.item)
        const { w, h } = mapSize(ITEM_MAPS[p.item])
        const bob = Math.round(Math.sin(state.run.time * 3 + p.id) * 1.5)
        ctx.drawImage(
          sprite,
          Math.round(p.x + p.width / 2 - w / 2),
          sy - h - 2 + bob,
        )
      }
    }
  }

  const drawPlayer = (state: GameState): void => {
    const ctx = screen.ctx
    const p = state.player

    // 무적 중에는 깜빡인다
    if (state.run.time < state.run.invulnerableUntil) {
      if (Math.floor(state.run.time * 12) % 2 === 0) return
    }

    const sprite = playerSprite(!p.onGround)
    const sy = Math.round(C.LOGICAL_H - (p.y - state.camera.y)) - C.PLAYER_H
    ctx.drawImage(sprite, Math.round(p.x), sy)
  }

  return {
    draw(state: GameState): void {
      drawBackground(state)
      drawPlatforms(state)
      drawPlayer(state)
    },
    invalidate(): void {
      cache.clear()
    },
  }
}
