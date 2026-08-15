import type { PixelMap, Palette } from '../data/pixelmaps'
import { mapSize } from '../data/pixelmaps'

export type Sprite = HTMLCanvasElement

export function bakeSprite(map: PixelMap, palette: Palette): Sprite {
  const { w, h } = mapSize(map)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('오프스크린 2D 컨텍스트 생성 실패')
  ctx.imageSmoothingEnabled = false

  for (let y = 0; y < h; y++) {
    const row = map[y]!
    for (let x = 0; x < w; x++) {
      const ch = row[x]!
      if (ch === '.') continue
      const color = palette[ch]
      if (color === undefined) continue // 정의되지 않은 문자는 건너뛴다
      ctx.fillStyle = color
      ctx.fillRect(x, y, 1, 1)
    }
  }
  return canvas
}

export function spriteCache() {
  const store = new Map<string, Sprite>()
  return {
    get(key: string, build: () => Sprite): Sprite {
      const hit = store.get(key)
      if (hit !== undefined) return hit
      const made = build()
      store.set(key, made)
      return made
    },
    clear(): void {
      store.clear()
    },
  }
}
