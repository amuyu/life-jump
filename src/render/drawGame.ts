import type { GameState, Platform } from '../game/state'
import type { Screen } from './canvas'
import { bakeSprite, spriteCache, type Sprite } from './sprites'
import {
  PLAYER_IDLE, PLAYER_JUMP, SKIN_PALETTE,
  PLATFORM_MAPS, PLATFORM_PALETTES,
  ITEM_MAPS, ITEM_PALETTES, mapSize,
} from '../data/pixelmaps'
import { outfitById } from '../data/outfits'
import type { Outfit } from '../data/outfits'
import { zoneVisual, type Rgb } from '../game/zones'
import * as C from '../constants'

export interface Renderer {
  draw(state: GameState): void
  /** 착용 옷을 바꾼다 — 스프라이트 캐시를 비운다 */
  setOutfit(id: string): void
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
const BIRDS = makeSpecks(7, 41)

// 운석·행성은 "가끔"이어야 하므로(스펙 6절) 한 화면이 아니라 네 화면 높이의
// 띠에 흩뿌린다 — 한 화면에 하나 보일까 말까 한 밀도가 된다.
const SPACE_BAND = C.LOGICAL_H * 4
const SPACE_OBJECTS = makeSpecks(5, 71)
const PLANET_COLORS = ['#e17055', '#00b894', '#0984e3', '#fdcb6e', '#a29bfe']

/**
 * 땅의 잔디 두께. normal 발판 픽셀맵의 'g' 행 수에서 파생시킨다 — 땅은 발판과
 * 같은 재질로 보여야 하므로, 픽셀맵을 고치면 땅도 따라 바뀌어야 한다.
 */
const GRASS_H = PLATFORM_MAPS.normal.filter((row) => row.includes('g')).length

/** 오버레이에서 색이 칠해진 칸들 — 반짝임이 앉을 자리 */
function decoratedCells(outfit: Outfit): Array<{ x: number; y: number }> {
  if (!outfit.sparkle || outfit.overlay === null) return []
  const out: Array<{ x: number; y: number }> = []
  outfit.overlay.map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '.') out.push({ x, y })
    }
  })
  return out
}

export function createRenderer(screen: Screen, outfitId: string): Renderer {
  const cache = spriteCache()
  let outfit: Outfit = outfitById(outfitId)
  let sparkleCells = decoratedCells(outfit)

  const platformTile = (kind: Platform['kind']): Sprite =>
    cache.get(`plat:${kind}`, () =>
      bakeSprite(PLATFORM_MAPS[kind], PLATFORM_PALETTES[kind]))

  const itemSprite = (kind: keyof typeof ITEM_MAPS): Sprite =>
    cache.get(`item:${kind}`, () =>
      bakeSprite(ITEM_MAPS[kind], ITEM_PALETTES[kind]))

  const playerSprite = (jumping: boolean): Sprite =>
    cache.get(`player:${outfit.id}:${jumping ? 'jump' : 'idle'}`, () => {
      const base = bakeSprite(jumping ? PLAYER_JUMP : PLAYER_IDLE, {
        ...SKIN_PALETTE,
        ...outfit.palette,
      })
      if (outfit.overlay === null) return base

      // 장식을 캐릭터 위에 덧그린다
      const deco = bakeSprite(outfit.overlay.map, outfit.overlay.palette)
      const ctx = base.getContext('2d')
      if (ctx !== null) {
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(deco, 0, 0)
      }
      return base
    })

  /** 하늘 구간의 새 (스펙 6절). 구름과 같은 패럴랙스 위에 좌우로 난다 */
  const drawBirds = (state: GameState, alpha: number): void => {
    const ctx = screen.ctx
    ctx.fillStyle = '#39394d'
    for (const b of BIRDS) {
      const y = ((b.y + state.camera.y * b.speed) % C.LOGICAL_H + C.LOGICAL_H) % C.LOGICAL_H
      const sy = Math.round(C.LOGICAL_H - y)
      const drift = b.x + state.run.time * (7 + b.size * 5)
      const x = Math.round(((drift % C.LOGICAL_W) + C.LOGICAL_W) % C.LOGICAL_W)

      // 날갯짓 — 위/아래 두 자세를 오간다
      const up = Math.sin(state.run.time * 7 + b.x) > 0 ? 1 : 0
      ctx.globalAlpha = alpha * 0.8
      ctx.fillRect(x, sy, 1, 1)
      ctx.fillRect(x - 2, sy - up, 2, 1)
      ctx.fillRect(x + 1, sy - up, 2, 1)
    }
    ctx.globalAlpha = 1
  }

  /** 우주 구간에 가끔 지나가는 운석·행성 (스펙 6절) */
  const drawSpaceObjects = (state: GameState, alpha: number): void => {
    const ctx = screen.ctx
    ctx.globalAlpha = alpha
    SPACE_OBJECTS.forEach((o, i) => {
      // 네 화면 높이의 띠 안에서 순환한다
      const raw = o.y * 4 + state.camera.y * o.speed * 0.5
      const y = ((raw % SPACE_BAND) + SPACE_BAND) % SPACE_BAND
      const sy = Math.round(C.LOGICAL_H - y)
      if (sy < -24 || sy > C.LOGICAL_H + 24) return

      if (i % 2 === 0) {
        // 행성 — 고리를 두른 원반
        const x = Math.round(o.x)
        ctx.fillStyle = PLANET_COLORS[i % PLANET_COLORS.length]!
        ctx.fillRect(x + 2, sy, 7, 11)
        ctx.fillRect(x, sy + 2, 11, 7)
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.fillRect(x - 2, sy + 4, 15, 1)
      } else {
        // 운석 — 대각선 꼬리를 끌고 지나간다
        const drift = o.x + state.run.time * 16
        const x = Math.round(((drift % (C.LOGICAL_W + 40)) + C.LOGICAL_W + 40) % (C.LOGICAL_W + 40)) - 20
        ctx.fillStyle = '#ffeaa7'
        ctx.fillRect(x, sy, 2, 2)
        ctx.fillStyle = 'rgba(255,234,167,0.45)'
        for (let t = 1; t <= 5; t++) ctx.fillRect(x - t * 2, sy - t, 2, 1)
      }
    })
    ctx.globalAlpha = 1
  }

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

    if (v.spaceObjectAlpha > 0.01) drawSpaceObjects(state, v.spaceObjectAlpha)

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

    // 새는 구름보다 앞(위)에 그린다 — 구름 사이를 나는 것처럼 보인다
    if (v.birdAlpha > 0.01) drawBirds(state, v.birdAlpha)

    // 시작 지점(월드 y=0) 아래는 땅 — normal 발판과 같은 팔레트를 써서 같은 재질로
    // 보이게 한다. 같은 좌표 변환을 쓰므로 카메라가 올라가 화면 밖으로 나가면
    // (worldGroundY >= LOGICAL_H) 별도 처리 없이 자연히 그려지지 않는다.
    // 별·구름 뒤가 아니라 맨 마지막에 그린다 — 땅은 불투명한 전경이므로 별·구름이
    // 그 위(화면상 앞)에 겹쳐 보이면 안 된다.
    const worldGroundY = Math.round(C.LOGICAL_H - (0 - state.camera.y))
    if (worldGroundY < C.LOGICAL_H) {
      const groundPalette = PLATFORM_PALETTES.normal
      const grassY = Math.max(0, worldGroundY)
      ctx.fillStyle = groundPalette['g']!
      ctx.fillRect(0, grassY, C.LOGICAL_W, Math.min(GRASS_H, C.LOGICAL_H - grassY))

      const dirtY = Math.max(0, worldGroundY + GRASS_H)
      if (dirtY < C.LOGICAL_H) {
        ctx.fillStyle = groundPalette['d']!
        ctx.fillRect(0, dirtY, C.LOGICAL_W, C.LOGICAL_H - dirtY)
      }
    }
  }

  const drawPlatforms = (state: GameState): void => {
    const ctx = screen.ctx
    for (const p of state.platforms) {
      const sy = Math.round(C.LOGICAL_H - (p.y - state.camera.y))
      if (sy < -C.PLATFORM_THICKNESS || sy > C.LOGICAL_H) continue

      const tile = platformTile(p.kind)
      const tw = mapSize(PLATFORM_MAPS[p.kind]).w
      const x0 = Math.round(p.x)

      if (p.dead) {
        // 되살아나는 중 — 남은 시간에 비례해 진해진다. 아무것도 안 그리면
        // 막힌 플레이어가 기다릴 이유를 알 수 없다. crumbleAt은 파괴 시각이다.
        const progress = p.crumbleAt === null
          ? 0
          : Math.min(1, (state.run.time - p.crumbleAt) / C.CRUMBLE_RESPAWN)
        ctx.globalAlpha = 0.15 + 0.45 * progress
      } else if (p.crumbleAt !== null) {
        // 곧 부서지는 발판은 깜빡인다
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(state.run.time * 25))
      }

      for (let dx = 0; dx < p.width; dx += tw) {
        const w = Math.min(tw, p.width - dx)
        ctx.drawImage(tile, 0, 0, w, C.PLATFORM_THICKNESS,
          x0 + dx, sy, w, C.PLATFORM_THICKNESS)
      }
      ctx.globalAlpha = 1

      // 부서진 발판의 아이템은 collectItems도 건너뛴다 — 되살아날 때 같이 돌아온다
      if (p.item !== null && !p.dead) {
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
    const sx = Math.round(p.x)
    const sy = Math.round(C.LOGICAL_H - (p.y - state.camera.y)) - C.PLAYER_H
    ctx.drawImage(sprite, sx, sy)

    // 반짝임 애니메이션 (스펙 9절 — 은하 드레스). 스프라이트는 캐시에 구워지므로
    // 캐시를 다시 굽는 대신 그 위에 픽셀 몇 개를 덧그린다.
    if (sparkleCells.length > 0) {
      ctx.fillStyle = '#ffffff'
      const base = Math.floor(state.run.time * 7)
      for (let k = 0; k < 3; k++) {
        const idx = (base + k * 5) % sparkleCells.length
        const cell = sparkleCells[idx]!
        ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(state.run.time * 9 + idx))
        ctx.fillRect(sx + cell.x, sy + cell.y, 1, 1)
      }
      ctx.globalAlpha = 1
    }
  }

  return {
    draw(state: GameState): void {
      drawBackground(state)
      drawPlatforms(state)
      drawPlayer(state)
    },
    setOutfit(id: string): void {
      outfit = outfitById(id)
      sparkleCells = decoratedCells(outfit)
      cache.clear()
    },
  }
}
