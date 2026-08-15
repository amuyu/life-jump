import { describe, it, expect } from 'vitest'
import {
  PLAYER_IDLE, PLAYER_JUMP, SKIN_PALETTE,
  PLATFORM_MAPS, PLATFORM_PALETTES,
  ITEM_MAPS, ITEM_PALETTES,
  ICON_MAPS, ICON_PALETTES, mapSize,
} from '../../src/data/pixelmaps'
import * as C from '../../src/constants'

const ALL_MAPS: Array<[string, readonly string[]]> = [
  ['PLAYER_IDLE', PLAYER_IDLE],
  ['PLAYER_JUMP', PLAYER_JUMP],
  ...Object.entries(PLATFORM_MAPS),
  ...Object.entries(ITEM_MAPS),
  ...Object.entries(ICON_MAPS),
]

const ALL_PALETTES: Array<[string, Record<string, string>]> = [
  ['SKIN_PALETTE', SKIN_PALETTE],
  ...Object.entries(PLATFORM_PALETTES),
  ...Object.entries(ITEM_PALETTES),
  ...Object.entries(ICON_PALETTES),
]

describe('픽셀맵 정합성', () => {
  it('모든 맵의 각 행 길이가 같다', () => {
    for (const [name, map] of ALL_MAPS) {
      const w = map[0]!.length
      for (let i = 0; i < map.length; i++) {
        expect(map[i]!.length, `${name} 행 ${i}`).toBe(w)
      }
    }
  })

  it('빈 맵이 없다', () => {
    for (const [name, map] of ALL_MAPS) {
      expect(map.length, name).toBeGreaterThan(0)
      expect(map[0]!.length, name).toBeGreaterThan(0)
    }
  })

  it('mapSize가 실제 크기를 돌려준다', () => {
    expect(mapSize(PLAYER_IDLE)).toEqual({
      w: PLAYER_IDLE[0]!.length,
      h: PLAYER_IDLE.length,
    })
  })

  // spritePreview.ts의 bakeKey는 맵 행을 '|'로, 팔레트 항목을 'ch=color'꼴로
  // ','로 이어 캐시 키를 만든다. 맵 행에 '|'가 들어가거나 팔레트 값에
  // ','·'='·':'가 들어가면 서로 다른 두 스프라이트가 같은 키로 충돌해
  // 엉뚱한 스프라이트가 캐시에서 튀어나올 수 있다 — 지금 데이터는 안전하지만
  // 그 전제를 여기서 고정해 둔다.
  it('맵 행에 bakeKey 구분자(|)가 없다', () => {
    for (const [name, map] of ALL_MAPS) {
      for (let i = 0; i < map.length; i++) {
        expect(map[i]!.includes('|'), `${name} 행 ${i}`).toBe(false)
      }
    }
  })

  it('팔레트 값에 bakeKey 구분자(, = :)가 없다', () => {
    for (const [name, palette] of ALL_PALETTES) {
      for (const [ch, color] of Object.entries(palette)) {
        const label = `${name}['${ch}']`
        expect(color.includes(','), label).toBe(false)
        expect(color.includes('='), label).toBe(false)
        expect(color.includes(':'), label).toBe(false)
      }
    }
  })
})

describe('플레이어 스프라이트', () => {
  it('크기가 PLAYER_W × PLAYER_H와 일치한다', () => {
    expect(mapSize(PLAYER_IDLE)).toEqual({ w: C.PLAYER_W, h: C.PLAYER_H })
    expect(mapSize(PLAYER_JUMP)).toEqual({ w: C.PLAYER_W, h: C.PLAYER_H })
  })

  it('옷 자리(c)가 존재한다 — 옷 시스템이 여기를 칠한다', () => {
    expect(PLAYER_IDLE.join('')).toContain('c')
    expect(PLAYER_JUMP.join('')).toContain('c')
  })

  it('쓰인 문자가 전부 팔레트에 정의되어 있다 (c 제외)', () => {
    const used = new Set([...PLAYER_IDLE.join(''), ...PLAYER_JUMP.join('')])
    for (const ch of used) {
      if (ch === '.' || ch === 'c') continue
      expect(SKIN_PALETTE[ch], `문자 '${ch}'`).toBeDefined()
    }
  })
})

describe('발판 스프라이트', () => {
  // "네 종류가 모두 정의되어 있다"는 검사가 있었으나 Record<PlatformKind, …>가
  // 이미 타입 단계에서 보장하므로 절대 실패할 수 없었다. 아래 검사들은 모든
  // 항목을 실제로 순회하므로 누락은 여기서 걸린다.

  it('높이가 PLATFORM_THICKNESS와 일치한다', () => {
    for (const [kind, map] of Object.entries(PLATFORM_MAPS)) {
      expect(mapSize(map).h, kind).toBe(C.PLATFORM_THICKNESS)
    }
  })

  it('쓰인 문자가 전부 팔레트에 정의되어 있다', () => {
    for (const [kind, map] of Object.entries(PLATFORM_MAPS)) {
      const palette = PLATFORM_PALETTES[kind as keyof typeof PLATFORM_PALETTES]
      for (const ch of new Set(map.join(''))) {
        if (ch === '.') continue
        expect(palette[ch], `${kind} 문자 '${ch}'`).toBeDefined()
      }
    }
  })
})

describe('아이템 스프라이트', () => {
  // 위와 같은 이유로 Record<ItemKind, …> 존재 검사는 지웠다.

  it('발판 위에 올려도 답답하지 않게 8×8 이하다', () => {
    for (const [kind, map] of Object.entries(ITEM_MAPS)) {
      const { w, h } = mapSize(map)
      expect(w, kind).toBeLessThanOrEqual(8)
      expect(h, kind).toBeLessThanOrEqual(8)
    }
  })

  it('쓰인 문자가 전부 팔레트에 정의되어 있다', () => {
    for (const [kind, map] of Object.entries(ITEM_MAPS)) {
      const palette = ITEM_PALETTES[kind as keyof typeof ITEM_PALETTES]
      for (const ch of new Set(map.join(''))) {
        if (ch === '.') continue
        expect(palette[ch], `${kind} 문자 '${ch}'`).toBeDefined()
      }
    }
  })
})

describe('상점 아이콘 스프라이트', () => {
  it('모든 아이콘이 정확히 8×8이다', () => {
    for (const [kind, map] of Object.entries(ICON_MAPS)) {
      const { w, h } = mapSize(map)
      expect(w, kind).toBe(8)
      expect(h, kind).toBe(8)
    }
  })

  it('쓰인 문자가 전부 팔레트에 정의되어 있다', () => {
    for (const [kind, map] of Object.entries(ICON_MAPS)) {
      const palette = ICON_PALETTES[kind as keyof typeof ICON_PALETTES]
      for (const ch of new Set(map.join(''))) {
        if (ch === '.') continue
        expect(palette[ch], `${kind} 문자 '${ch}'`).toBeDefined()
      }
    }
  })
})
