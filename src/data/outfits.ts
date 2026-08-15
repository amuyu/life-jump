import type { Palette } from './pixelmaps'
import { DEFAULT_OUTFIT_ID } from '../core/storage'

export interface Outfit {
  id: string
  name: string
  threadCost: number
  /** 캐릭터 픽셀맵의 'c' 자리에 쓸 색들 */
  palette: Palette
  /** 캐릭터 위에 겹칠 장식. 없으면 null */
  overlay: { map: readonly string[]; palette: Palette } | null
  /**
   * 반짝임 애니메이션 (스펙 9절 — 은하 드레스). 스프라이트는 캐시에 구워지므로
   * 시간에 따라 변하는 연출은 렌더러가 그릴 때 덧그린다.
   */
  sparkle: boolean
}

const EMPTY_ROW = '............'
const blank = (): string[] => Array.from({ length: 16 }, () => EMPTY_ROW)

/** 특정 행들만 채운 12×16 오버레이를 만든다 */
function overlayRows(rows: Record<number, string>): readonly string[] {
  const out = blank()
  for (const [idx, row] of Object.entries(rows)) {
    if (row.length !== EMPTY_ROW.length) {
      throw new Error(`overlay row must be ${EMPTY_ROW.length} chars, got ${row.length}: "${row}"`)
    }
    out[Number(idx)] = row
  }
  return out
}

export const OUTFITS: readonly Outfit[] = [
  {
    id: DEFAULT_OUTFIT_ID,
    name: '기본 티셔츠',
    threadCost: 0,
    palette: { c: '#3498db' },
    overlay: null,
    sparkle: false,
  },
  {
    id: 'striped',
    name: '줄무늬 셔츠',
    threadCost: 5,
    palette: { c: '#ecf0f1' },
    overlay: {
      map: overlayRows({ 9: '.nnnnnnnnnn.', 11: '..nnnnnnnn..' }),
      palette: { n: '#2c3e50' },
    },
    sparkle: false,
  },
  {
    id: 'raincoat',
    name: '노란 우비',
    threadCost: 12,
    palette: { c: '#f1c40f' },
    overlay: {
      // 후드
      map: overlayRows({ 0: '...vvvvvv...', 1: '..vvvvvvvv..', 2: '.vvvvvvvvvv.' }),
      palette: { v: '#e67e22' },
    },
    sparkle: false,
  },
  {
    id: 'overalls',
    name: '멜빵 청바지',
    threadCost: 22,
    palette: { c: '#2980b9' },
    overlay: {
      map: overlayRows({ 8: '..b......b..', 9: '..b......b..' }),
      palette: { b: '#f39c12' },
    },
    sparkle: false,
  },
  {
    id: 'floral',
    name: '꽃무늬 원피스',
    threadCost: 35,
    palette: { c: '#fd79a8' },
    overlay: {
      map: overlayRows({ 10: '..f..f..f...', 12: '.ffffffffff.', 13: '.ffffffffff.' }),
      palette: { f: '#ffeaa7' },
    },
    sparkle: false,
  },
  {
    id: 'hoodie',
    name: '후드티',
    threadCost: 50,
    palette: { c: '#636e72' },
    overlay: {
      map: overlayRows({ 2: '.uuuuuuuuuu.', 3: '.u........u.', 9: '.....uu.....' }),
      palette: { u: '#2d3436' },
    },
    sparkle: false,
  },
  {
    id: 'wizard',
    name: '마법사 로브',
    threadCost: 70,
    palette: { c: '#6c5ce7' },
    overlay: {
      // 고깔모자 + 별 무늬
      map: overlayRows({
        0: '.....ww.....',
        1: '....wwww....',
        2: '...wwwwww...',
        10: '...s...s....',
        12: '.....s......',
      }),
      palette: { w: '#341f97', s: '#feca57' },
    },
    sparkle: false,
  },
  {
    id: 'knight',
    name: '기사 갑옷',
    threadCost: 95,
    palette: { c: '#b2bec3' },
    overlay: {
      map: overlayRows({
        8: '..mmmmmmmm..',
        9: '.m........m.',
        11: '....mmmm....',
      }),
      palette: { m: '#dfe6e9' },
    },
    sparkle: false,
  },
  {
    id: 'spacesuit',
    name: '우주복',
    threadCost: 125,
    palette: { c: '#dfe6e9' },
    overlay: {
      // 헬멧 + 산소통
      map: overlayRows({
        2: '..gggggggg..',
        3: '.g........g.',
        4: '.g........g.',
        9: 'o..........o',
        10: 'o..........o',
      }),
      palette: { g: '#74b9ff', o: '#b2bec3' },
    },
    sparkle: false,
  },
  {
    id: 'galaxy',
    name: '은하 드레스',
    threadCost: 160,
    palette: { c: '#2d3436' },
    overlay: {
      map: overlayRows({
        9: '..k.k...k.k.',
        10: '.k...k.k...k',
        11: '..k.k...k.k.',
        12: '.kkkkkkkkkk.',
        13: '.kkkkkkkkkk.',
      }),
      palette: { k: '#a29bfe' },
    },
    sparkle: true,
  },
]

export const OUTFIT_IDS: ReadonlySet<string> = new Set(OUTFITS.map((o) => o.id))

export function outfitById(id: string): Outfit {
  return OUTFITS.find((o) => o.id === id) ?? OUTFITS[0]!
}

/** 실 개수로 제작 가능한가. 이미 보유한 옷은 실이 충분해도 제작할 수 없다 */
export function canCraft(
  outfit: Outfit, thread: number, owned: readonly string[],
): boolean {
  if (owned.includes(outfit.id)) return false
  return thread >= outfit.threadCost
}
