import './ui/styles.css'
import { createScreen, fitScreen } from './render/canvas'
import { createRenderer } from './render/drawGame'
import { drawHud } from './render/drawHud'
import { createLoop } from './core/loop'
import { createInput } from './core/input'
import { createRng } from './core/rng'
import { createGameState, defaultModifiers } from './game/state'
import { stepGame } from './game/update'
import { DEFAULT_OUTFIT_ID } from './core/storage'

const mount = document.getElementById('app')
if (mount === null) throw new Error('#app 를 찾을 수 없습니다')

const screen = createScreen(mount)
const renderer = createRenderer(screen, DEFAULT_OUTFIT_ID)
const loop = createLoop()
const input = createInput()
input.attach(window)

window.addEventListener('resize', () => fitScreen(screen))

// 탭 복귀 시 밀린 시간을 버린다 (스펙 4절)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    loop.reset()
    input.reset()
  }
})

const deps = { rng: createRng(Date.now() >>> 0) }
let state = createGameState(defaultModifiers())
let lastTime = performance.now()

function frame(now: number): void {
  const delta = (now - lastTime) / 1000
  lastTime = now

  const steps = loop.frame(delta)
  for (let i = 0; i < steps; i++) {
    stepGame(state, input.snapshot(), deps)
    input.consume()
  }

  renderer.draw(state)
  drawHud(screen, state)

  if (state.run.over) {
    // Task 22에서 결과 화면으로 대체한다
    state = createGameState(defaultModifiers())
  }

  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
