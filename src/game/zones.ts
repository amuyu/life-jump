import type { ZoneName } from './state'
import * as C from '../constants'

export interface Rgb { r: number; g: number; b: number }

export interface ZoneVisual {
  zone: ZoneName
  top: Rgb
  bottom: Rgb
  cloudAlpha: number
  starAlpha: number
  /** 새 — 하늘 구간의 요소 (스펙 6절) */
  birdAlpha: number
  /** 운석·행성 — 우주 구간의 "가끔" 요소 (스펙 6절) */
  spaceObjectAlpha: number
}

interface Key {
  y: number
  top: Rgb
  bottom: Rgb
  cloud: number
  star: number
  bird: number
  object: number
}

// 높이별 키프레임. 색은 이 목록만으로 결정되므로 구간 경계와 무관하게 연속이다.
const KEYS: Key[] = [
  { y: 0,     top: { r: 135, g: 206, b: 250 }, bottom: { r: 200, g: 235, b: 255 }, cloud: 0.5, star: 0,    bird: 0,    object: 0 },
  { y: 3000,  top: { r: 90,  g: 160, b: 235 }, bottom: { r: 150, g: 205, b: 250 }, cloud: 1.0, star: 0,    bird: 0.35, object: 0 },
  { y: 6000,  top: { r: 120, g: 90,  b: 190 }, bottom: { r: 240, g: 150, b: 100 }, cloud: 0.7, star: 0.15, bird: 1,    object: 0.15 },
  { y: 9000,  top: { r: 40,  g: 35,  b: 95  }, bottom: { r: 90,  g: 60,  b: 130 }, cloud: 0.25, star: 0.5, bird: 0.3,  object: 0.6 },
  { y: 14000, top: { r: 8,   g: 8,   b: 24  }, bottom: { r: 20,  g: 18,  b: 50  }, cloud: 0,   star: 0.85, bird: 0,    object: 0.9 },
  { y: 20000, top: { r: 0,   g: 0,   b: 6   }, bottom: { r: 6,   g: 4,   b: 20  }, cloud: 0,   star: 1,    bird: 0,    object: 1 },
]

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

const lerpRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: Math.round(lerp(a.r, b.r, t)),
  g: Math.round(lerp(a.g, b.g, t)),
  b: Math.round(lerp(a.b, b.b, t)),
})

export function zoneAt(y: number): ZoneName {
  if (y >= C.SPACE_START_Y) return 'space'
  if (y >= C.SKY_START_Y) return 'sky'
  return 'ground'
}

const atKey = (y: number, k: Key): ZoneVisual => ({
  zone: zoneAt(y),
  top: k.top,
  bottom: k.bottom,
  cloudAlpha: k.cloud,
  starAlpha: k.star,
  birdAlpha: k.bird,
  spaceObjectAlpha: k.object,
})

export function zoneVisual(y: number): ZoneVisual {
  const first = KEYS[0]!
  const last = KEYS[KEYS.length - 1]!

  if (y <= first.y) return atKey(y, first)
  if (y >= last.y) return atKey(y, last)

  for (let i = 1; i < KEYS.length; i++) {
    const hi = KEYS[i]!
    if (y > hi.y) continue
    const lo = KEYS[i - 1]!
    const t = (y - lo.y) / (hi.y - lo.y)
    return {
      zone: zoneAt(y),
      top: lerpRgb(lo.top, hi.top, t),
      bottom: lerpRgb(lo.bottom, hi.bottom, t),
      cloudAlpha: lerp(lo.cloud, hi.cloud, t),
      starAlpha: lerp(lo.star, hi.star, t),
      birdAlpha: lerp(lo.bird, hi.bird, t),
      spaceObjectAlpha: lerp(lo.object, hi.object, t),
    }
  }

  // 도달 불가 — 위 루프가 항상 반환한다
  return atKey(y, last)
}
