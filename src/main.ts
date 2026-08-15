import './ui/styles.css'
import { createScreen, fitScreen } from './render/canvas'
import { createRenderer } from './render/drawGame'
import { drawHud } from './render/drawHud'
import { createLoop } from './core/loop'
import { createInput } from './core/input'
import { createRng } from './core/rng'
import { loadSave, writeSave, type SaveData } from './core/storage'
import { createGameState, type GameState } from './game/state'
import { stepGame } from './game/update'
import { CONSUMABLE_IDS, UPGRADES, CONSUMABLES, nextUpgradePrice } from './data/shop'
import { OUTFIT_IDS, outfitById, canCraft } from './data/outfits'
import { pickQuestion, rewardFor } from './game/quiz'
import { startRun as computeStartRun, finishRun as computeFinishRun } from './runFlow'
import { renderLobby } from './ui/lobby'
import { renderShop } from './ui/shop'
import { renderWardrobe } from './ui/wardrobe'
import { renderLoadout } from './ui/loadout'
import { renderResult } from './ui/result'
import { showQuiz } from './ui/quizModal'
import * as C from './constants'

const root = document.getElementById('app')
if (root === null) throw new Error('#app 를 찾을 수 없습니다')

// 게임 캔버스 층과 UI 층을 분리한다
const gameLayer = document.createElement('div')
gameLayer.className = 'game-layer hidden'
root.appendChild(gameLayer)

const uiLayer = document.createElement('div')
root.appendChild(uiLayer)

const screen = createScreen(gameLayer)
const loop = createLoop()
const input = createInput()

let save: SaveData = loadSave({ outfits: OUTFIT_IDS, consumables: CONSUMABLE_IDS })
const renderer = createRenderer(screen, save.equippedOutfit)
let state: GameState | null = null
let rng = createRng(Date.now() >>> 0)
let quizOpen = false

// 실제로 판을 플레이하는 동안에만 키를 가로챈다 — 로비·상점·퀴즈 모달에서는
// Space로 버튼을 누르고 ArrowUp으로 패널을 스크롤할 수 있어야 한다
input.attach(window, () => state !== null && !quizOpen)

window.addEventListener('resize', () => fitScreen(screen))

// 탭 복귀 — 밀린 시간을 버리고 키 상태를 초기화한다 (스펙 4절)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    loop.reset()
    input.reset()
  }
})

const persist = (): void => { writeSave(save) }

function showLobby(): void {
  state = null
  gameLayer.classList.add('hidden')
  renderLobby(uiLayer, save, {
    onPlay: showLoadout,
    onShop: showShop,
    onWardrobe: showWardrobe,
  })
}

function showShop(): void {
  renderShop(uiLayer, save, {
    onBuyUpgrade(id) {
      const upgrade = UPGRADES.find((u) => u.id === id)
      if (upgrade === undefined) return
      const level = save.upgrades[upgrade.id]
      const price = nextUpgradePrice(upgrade, level)
      if (price === null || save.coins < price) return
      save.coins -= price
      save.upgrades[upgrade.id] = level + 1
      persist()
      showShop()
    },
    onBuyConsumable(id) {
      const item = CONSUMABLES.find((c) => c.id === id)
      if (item === undefined || save.coins < item.price) return
      save.coins -= item.price
      save.consumables[item.id] += 1
      persist()
      showShop()
    },
    onClose: showLobby,
  })
}

function showWardrobe(): void {
  renderWardrobe(uiLayer, save, {
    onCraft(id) {
      const outfit = outfitById(id)
      if (!canCraft(outfit, save.thread, save.ownedOutfits)) return
      save.thread -= outfit.threadCost
      save.ownedOutfits.push(outfit.id)
      persist()
      showWardrobe()
    },
    onEquip(id) {
      if (!save.ownedOutfits.includes(id)) return
      save.equippedOutfit = id
      renderer.setOutfit(id)
      persist()
      showWardrobe()
    },
    onClose: showLobby,
  })
}

function showLoadout(): void {
  renderLoadout(uiLayer, save, {
    onToggle(id) {
      const at = save.selectedConsumables.indexOf(id)
      if (at >= 0) {
        save.selectedConsumables.splice(at, 1)
      } else if (save.consumables[id as keyof typeof save.consumables] >= 1) {
        save.selectedConsumables.push(id)
      }
      persist()
      showLoadout()
    },
    onStart: startRun,
    onClose: showLobby,
  })
}

function startRun(): void {
  // 적용분을 먼저 확정한다 — 재고 없는 항목은 효과를 받을 수 없다
  const { mods } = computeStartRun(save)
  persist()

  state = createGameState(mods)
  rng = createRng(Date.now() >>> 0)
  renderer.setOutfit(save.equippedOutfit)

  uiLayer.innerHTML = ''
  gameLayer.classList.remove('hidden')

  loop.reset()
  input.reset()
  lastTime = performance.now()
}

function finishRun(run: GameState['run']): void {
  const { isNewBest } = computeFinishRun(save, run)
  persist()

  gameLayer.classList.add('hidden')
  state = null
  renderResult(uiLayer, run, isNewBest, { onRetry: showLoadout, onLobby: showLobby })
}

function openQuiz(current: GameState): void {
  const pending = current.pendingQuiz
  if (pending === null) return

  quizOpen = true
  const question = pickQuestion(pending.platformY, save.seenQuizIds, rng)
  persist()

  showQuiz(uiLayer, question, (result) => {
    if (result.correct && result.reward !== null) {
      const reward = rewardFor(question.difficulty)
      if (result.reward === 'thread') current.run.thread += reward.thread
      else if (result.reward === 'coin') current.run.coins += reward.coin
      else current.run.energy = Math.min(current.run.maxEnergy, current.run.energy + reward.food)
    }

    // 일시정지 규약 (스펙 8절) — 순서대로
    current.pendingQuiz = null
    current.paused = false
    loop.reset()      // accumulator 폐기 — 없으면 시간이 순간이동한다
    input.reset()     // 키 상태 초기화 — 모달에서 누른 Space가 점프로 이어지지 않는다
    lastTime = performance.now()
    quizOpen = false
  })
}

let lastTime = performance.now()

function frame(now: number): void {
  const delta = (now - lastTime) / 1000
  lastTime = now

  if (state !== null) {
    if (state.pendingQuiz !== null && !quizOpen) {
      openQuiz(state)
    }

    if (!quizOpen) {
      const steps = loop.frame(delta)
      for (let i = 0; i < steps; i++) {
        stepGame(state, input.snapshot(), { rng })
        input.consume()
        if (state.paused || state.run.over) break
      }
    }

    renderer.draw(state)
    drawHud(screen, state)

    if (state.run.over) {
      finishRun(state.run)
    }
  }

  requestAnimationFrame(frame)
}

showLobby()
requestAnimationFrame(frame)
