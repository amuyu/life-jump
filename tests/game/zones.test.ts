import { describe, it, expect } from 'vitest'
import { zoneAt, zoneVisual } from '../../src/game/zones'
import * as C from '../../src/constants'

describe('zoneAt', () => {
  it('낮은 곳은 ground', () => {
    expect(zoneAt(0)).toBe('ground')
    expect(zoneAt(2999)).toBe('ground')
  })

  it('중간은 sky', () => {
    expect(zoneAt(3000)).toBe('sky')
    expect(zoneAt(8999)).toBe('sky')
  })

  it('높은 곳은 space', () => {
    expect(zoneAt(9000)).toBe('space')
    expect(zoneAt(50000)).toBe('space')
  })

  it('음수 높이도 ground로 처리한다', () => {
    expect(zoneAt(-100)).toBe('ground')
  })
})

describe('zoneVisual — 연속성 (이 태스크의 존재 이유)', () => {
  const dist = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) =>
    Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b)

  it('구간 경계에서 색이 튀지 않는다', () => {
    for (const boundary of [C.SKY_START_Y, C.SPACE_START_Y]) {
      const before = zoneVisual(boundary - 1)
      const after = zoneVisual(boundary + 1)
      expect(dist(before.top, after.top), `${boundary} top`).toBeLessThan(3)
      expect(dist(before.bottom, after.bottom), `${boundary} bottom`).toBeLessThan(3)
    }
  })

  it('전 구간에 걸쳐 색 변화가 매끄럽다', () => {
    let prev = zoneVisual(0)
    for (let y = 10; y <= 20000; y += 10) {
      const cur = zoneVisual(y)
      expect(dist(prev.top, cur.top), `y=${y}`).toBeLessThan(6)
      prev = cur
    }
  })

  it('알파값도 경계에서 튀지 않는다', () => {
    for (const boundary of [C.SKY_START_Y, C.SPACE_START_Y]) {
      const before = zoneVisual(boundary - 1)
      const after = zoneVisual(boundary + 1)
      expect(Math.abs(before.cloudAlpha - after.cloudAlpha)).toBeLessThan(0.02)
      expect(Math.abs(before.starAlpha - after.starAlpha)).toBeLessThan(0.02)
    }
  })
})

describe('zoneVisual — 값 범위', () => {
  it('RGB가 0~255 안에 있다', () => {
    for (let y = 0; y <= 30000; y += 137) {
      const v = zoneVisual(y)
      for (const c of [v.top, v.bottom]) {
        for (const ch of [c.r, c.g, c.b]) {
          expect(ch).toBeGreaterThanOrEqual(0)
          expect(ch).toBeLessThanOrEqual(255)
        }
      }
    }
  })

  it('알파가 0~1 안에 있다', () => {
    for (let y = 0; y <= 30000; y += 137) {
      const v = zoneVisual(y)
      expect(v.cloudAlpha).toBeGreaterThanOrEqual(0)
      expect(v.cloudAlpha).toBeLessThanOrEqual(1)
      expect(v.starAlpha).toBeGreaterThanOrEqual(0)
      expect(v.starAlpha).toBeLessThanOrEqual(1)
    }
  })
})

describe('zoneVisual — 방향성', () => {
  it('올라갈수록 어두워진다', () => {
    const low = zoneVisual(0).top
    const mid = zoneVisual(6000).top
    const high = zoneVisual(15000).top
    const lum = (c: { r: number; g: number; b: number }) => c.r + c.g + c.b
    expect(lum(mid)).toBeLessThan(lum(low))
    expect(lum(high)).toBeLessThan(lum(mid))
  })

  it('구름은 옅어지고 별은 진해진다', () => {
    expect(zoneVisual(15000).cloudAlpha).toBeLessThan(zoneVisual(1000).cloudAlpha)
    expect(zoneVisual(15000).starAlpha).toBeGreaterThan(zoneVisual(1000).starAlpha)
  })

  it('우주 최상단은 구름이 없고 별이 가득하다', () => {
    const v = zoneVisual(30000)
    expect(v.cloudAlpha).toBe(0)
    expect(v.starAlpha).toBe(1)
  })
})
