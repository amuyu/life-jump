import type { PlatformKind, ItemKind } from '../game/state'

export type PixelMap = readonly string[]
export type Palette = Readonly<Record<string, string>>

export function mapSize(map: PixelMap): { w: number; h: number } {
  return { w: map[0]?.length ?? 0, h: map.length }
}

// 12 × 16
export const PLAYER_IDLE: PixelMap = [
  '....hhhh....',
  '...hhhhhh...',
  '..hhhhhhhh..',
  '..hssssssh..',
  '..hsesesesh.',
  '..hssssssh..',
  '...ssssss...',
  '....ssss....',
  '..cccccccc..',
  '.cccccccccc.',
  '.cccccccccc.',
  '..cccccccc..',
  '..cc....cc..',
  '..cc....cc..',
  '..ss....ss..',
  '.sss....sss.',
]

// 점프 중 — 팔을 들고 다리를 모은다
export const PLAYER_JUMP: PixelMap = [
  '....hhhh....',
  '...hhhhhh...',
  '..hhhhhhhh..',
  '..hssssssh..',
  '..hsesesesh.',
  '..hssssssh..',
  '...ssssss...',
  '.s..ssss..s.',
  '.sccccccccs.',
  '..cccccccc..',
  '..cccccccc..',
  '...cccccc...',
  '...cc..cc...',
  '...cc..cc...',
  '...ss..ss...',
  '...ss..ss...',
]

export const SKIN_PALETTE: Palette = {
  h: '#4a3728', // 머리카락
  s: '#f2c9a0', // 피부
  e: '#2b2118', // 눈
}

// 발판은 가로로 타일링한다. 높이 6px 고정.
export const PLATFORM_MAPS: Readonly<Record<PlatformKind, PixelMap>> = {
  normal: [
    'gggggggg',
    'gggggggg',
    'dddddddd',
    'dddddddd',
    'bbbbbbbb',
    'bbbbbbbb',
  ],
  spring: [
    '.mmmmmm.',
    'mmmmmmmm',
    'mmmmmmmm',
    'dddddddd',
    'bbbbbbbb',
    'bbbbbbbb',
  ],
  crumble: [
    'g.gg.ggg',
    'gggg.ggg',
    'd.dddd.d',
    'dddd.ddd',
    'b.bb.bbb',
    'bbb.bbbb',
  ],
  moving: [
    'aaaaaaaa',
    'aaaaaaaa',
    'llllllll',
    'llllllll',
    'bbbbbbbb',
    'bbbbbbbb',
  ],
}

export const PLATFORM_PALETTES: Readonly<Record<PlatformKind, Palette>> = {
  normal: { g: '#6ab04c', d: '#8b5a2b', b: '#5c3a1c' },
  spring: { m: '#f0932b', d: '#8b5a2b', b: '#5c3a1c' },
  crumble: { g: '#9c8b6a', d: '#7a6a4f', b: '#544736' },
  moving: { a: '#7ed6df', l: '#4a9fb0', b: '#2f6b78' },
}

// 아이템 — 전부 8×8 이하
export const ITEM_MAPS: Readonly<Record<ItemKind, PixelMap>> = {
  thread: [
    '..tttt..',
    '.tttttt.',
    'tt.tt.tt',
    'tttttttt',
    'tt.tt.tt',
    '.tttttt.',
    '..tttt..',
    '...ll...',
  ],
  coin: [
    '..cccc..',
    '.chhhhc.',
    'chhcchhc',
    'chhcchhc',
    'chhcchhc',
    'chhcchhc',
    '.chhhhc.',
    '..cccc..',
  ],
  food: [
    '...ss...',
    '..rrrr..',
    '.rrrrrr.',
    'rrrrrrrr',
    'rrrrrrrr',
    'rrrrrrrr',
    '.rrrrrr.',
    '..rrrr..',
  ],
  quiz: [
    '..qqqq..',
    '.qq..qq.',
    '.....qq.',
    '...qqq..',
    '..qq....',
    '..qq....',
    '........',
    '..qq....',
  ],
}

export const ITEM_PALETTES: Readonly<Record<ItemKind, Palette>> = {
  thread: { t: '#e84393', l: '#c2185b' },
  coin: { c: '#f9ca24', h: '#f0932b' },
  food: { r: '#eb4d4b', s: '#6ab04c' },
  quiz: { q: '#a29bfe' },
}
