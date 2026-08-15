import type { PixelMap, Palette } from '../data/pixelmaps'
import { PLAYER_IDLE, SKIN_PALETTE } from '../data/pixelmaps'
import { outfitById } from '../data/outfits'
import { bakeSprite, spriteCache } from '../render/sprites'

/**
 * 1× 스프라이트 캐시 — 픽셀은 여기서 딱 한 번만 찍는다 (스펙 13절).
 * 이 모듈 안의 모든 프리뷰 호출이 이 캐시 하나를 공유한다. 게임 루프의
 * createRenderer가 만드는 캐시(옷 교체 시 clear됨)와는 별개의 인스턴스다 —
 * DOM 프리뷰는 outfitId가 아니라 실제 맵·팔레트 내용으로 키를 잡으므로
 * 옷을 갈아입어도 무효화할 필요가 없다.
 */
const cache = spriteCache()

const paletteKey = (palette: Palette): string =>
  Object.keys(palette).sort().map((ch) => `${ch}=${palette[ch]}`).join(',')

const mapKey = (map: PixelMap): string => map.join('|')

/**
 * 맵+팔레트(+오버레이)의 실제 내용으로 캐시 키를 만든다. outfitId 같은 식별자가
 * 아니라 내용 자체를 키로 삼으므로, 같은 픽셀이 나올 두 호출은 항상 같은 키로
 * 만나고 — 옷을 입힌 캐릭터와 맨몸 캐릭터처럼 내용이 다른 두 스프라이트는
 * 절대 같은 키로 충돌하지 않는다.
 */
function bakeKey(
  map: PixelMap, palette: Palette, overlay?: { map: PixelMap; palette: Palette },
): string {
  const base = `${mapKey(map)}::${paletteKey(palette)}`
  if (overlay === undefined) return base
  return `${base}::+${mapKey(overlay.map)}::${paletteKey(overlay.palette)}`
}

/**
 * 픽셀맵을 정수 배율로 구운 <canvas> 를 돌려준다.
 *
 * 1× 스프라이트는 spriteCache에 한 번만 굽고(bakeSprite), 이후 호출은 그 캐시된
 * 스프라이트를 새 캔버스에 drawImage 한 번으로 확대해 복사한다 — 매 렌더마다
 * 픽셀을 다시 찍지 않는다.
 */
export function spriteCanvas(
  map: PixelMap, palette: Palette, scale: number,
  overlay?: { map: PixelMap; palette: Palette },
): HTMLCanvasElement {
  if (!Number.isInteger(scale) || scale <= 0) {
    throw new Error(`배율은 양의 정수만 허용된다: ${scale}`)
  }

  const baked = cache.get(bakeKey(map, palette, overlay), () => {
    const base = bakeSprite(map, palette)
    if (overlay === undefined) return base
    const deco = bakeSprite(overlay.map, overlay.palette)
    const ctx = base.getContext('2d')
    if (ctx !== null) {
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(deco, 0, 0)
    }
    return base
  })

  const out = document.createElement('canvas')
  out.width = baked.width * scale
  out.height = baked.height * scale
  out.style.imageRendering = 'pixelated'

  const ctx = out.getContext('2d')
  if (ctx === null) throw new Error('프리뷰 캔버스 2D 컨텍스트 생성 실패')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(baked, 0, 0, out.width, out.height)

  return out
}

/** 옷을 입은 캐릭터 프리뷰 — 게임 루프의 playerSprite 합성 규칙과 동일하게 맞춘다. */
export function outfitCanvas(outfitId: string, scale: number): HTMLCanvasElement {
  const outfit = outfitById(outfitId)
  const palette: Palette = { ...SKIN_PALETTE, ...outfit.palette }
  return spriteCanvas(PLAYER_IDLE, palette, scale, outfit.overlay ?? undefined)
}
