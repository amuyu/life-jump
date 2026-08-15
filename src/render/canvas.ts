import * as C from '../constants'

export interface Screen {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
}

function bestScale(): number {
  const sx = Math.floor(window.innerWidth / C.LOGICAL_W)
  const sy = Math.floor(window.innerHeight / C.LOGICAL_H)
  return Math.max(1, Math.min(sx, sy))
}

export function createScreen(mount: HTMLElement): Screen {
  const canvas = document.createElement('canvas')
  canvas.width = C.LOGICAL_W
  canvas.height = C.LOGICAL_H
  canvas.style.imageRendering = 'pixelated'
  canvas.style.display = 'block'
  mount.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('2D 컨텍스트를 만들 수 없습니다')
  ctx.imageSmoothingEnabled = false

  const screen: Screen = { canvas, ctx }
  fitScreen(screen)
  return screen
}

export function fitScreen(screen: Screen): void {
  const scale = bestScale()
  // 내부 해상도는 논리 크기 그대로 두고 CSS로만 확대한다 — 정수 배율 + pixelated
  screen.canvas.style.width = `${C.LOGICAL_W * scale}px`
  screen.canvas.style.height = `${C.LOGICAL_H * scale}px`
  screen.ctx.imageSmoothingEnabled = false
}
