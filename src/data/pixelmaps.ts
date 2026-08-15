import type { PlatformKind, ItemKind } from '../game/state'
import type { UpgradeId, ConsumableId } from './shop'

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


// 상점 아이콘 — 업그레이드 4종 + 소모품 4종, 전부 아이템과 같은 8×8 규약을 따른다.
// IconKind는 data/shop.ts의 UpgradeId/ConsumableId와 동일한 문자열이므로 그대로 재사용한다.
export type IconKind = UpgradeId | ConsumableId

export const ICON_MAPS: Readonly<Record<IconKind, PixelMap>> = {
  // 점프력 강화 — 위쪽을 가리키는 화살촉
  jump: [
    '...xx...',
    '..xxxx..',
    '.xxxxxx.',
    'xx.xx.xx',
    '...xx...',
    '...xx...',
    '..xxxx..',
    '..xxxx..',
  ],
  // 에너지 확장 — 둥근 에너지 구슬
  energy: [
    '..xxxx..',
    '.xxxxxx.',
    'xxxxxxxx',
    'xxxxxxxx',
    'xxxxxxxx',
    'xxxxxxxx',
    '.xxxxxx.',
    '..xxxx..',
  ],
  // 공중 조향 — 좌우로 벌어지는 화살표
  air: [
    '........',
    '..a...a.',
    '.aa...aa',
    'aaaaaaaa',
    'aaaaaaaa',
    '.aa...aa',
    '..a...a.',
    '........',
  ],
  // 자석 — 말굽 자석, 끝은 빨간 극
  magnet: [
    '.xxxxxx.',
    'xx....xx',
    'xx....xx',
    'xx....xx',
    'xx....xx',
    'xx....xx',
    'rr....rr',
    'rr....rr',
  ],
  // 로켓 부츠 — 부츠 아래로 뿜는 불꽃
  rocket: [
    '..xxxx..',
    '..xxxx..',
    '..xxxx..',
    '..xxxx..',
    'xxxxxxx.',
    'xxxxxxx.',
    '..ffff..',
    '..f..f..',
  ],
  // 깃털 — 대각선으로 눕힌 깃털
  feather: [
    '.......x',
    '......xx',
    '.....xxx',
    '....xxx.',
    '...xxx..',
    '..xxx...',
    '.xxx....',
    'xx......',
  ],
  // 방석 — 테두리와 속을 나눈 둥근 쿠션
  cushion: [
    '.xxxxxx.',
    'xxxxxxxx',
    'xwwwwwwx',
    'xwwwwwwx',
    'xwwwwwwx',
    'xwwwwwwx',
    'xxxxxxxx',
    '.xxxxxx.',
  ],
  // 더블 점프 — 위아래로 겹친 화살표 두 개
  doubleJump: [
    '...xx...',
    '..xxxx..',
    '.xx..xx.',
    '........',
    '...xx...',
    '..xxxx..',
    '.xx..xx.',
    'xx....xx',
  ],
}

export const ICON_PALETTES: Readonly<Record<IconKind, Palette>> = {
  jump: { x: '#f39c12' },
  energy: { x: '#e74c3c' },
  air: { a: '#3498db' },
  magnet: { x: '#7f8c8d', r: '#e74c3c' },
  rocket: { x: '#7f8c8d', f: '#e67e22' },
  feather: { x: '#81ecec' },
  cushion: { x: '#c96a92', w: '#e88fb0' },
  doubleJump: { x: '#0984e3' },
}
