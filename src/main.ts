import './ui/styles.css'
import { createScreen, fitScreen } from './render/canvas'
import { createRenderer } from './render/drawGame'
import { drawHud } from './render/drawHud'
import { createLoop } from './core/loop'
import { createInput } from './core/input'
import { createTouch } from './core/touch'
import { mountTouchOverlay, type MountedTouchOverlay } from './ui/touchOverlay'
import { setSwipeBack } from './toss/screen'
import { createRng } from './core/rng'
import { loadSave, writeSave, CONSUMABLE_MAX, type SaveData } from './core/storage'
import { createGameState, type GameState, type RunState } from './game/state'
import { stepGame } from './game/update'
import { grantFood } from './game/items'
import { CONSUMABLE_IDS, UPGRADES, CONSUMABLES, nextUpgradePrice } from './data/shop'
import { OUTFIT_IDS, outfitById, canCraft } from './data/outfits'
import { pickQuestion, rewardFor } from './game/quiz'
import { startRun as computeStartRun, finishRun as computeFinishRun } from './runFlow'
import { renderShell, type Tab } from './ui/shell'
import { renderLobby } from './ui/lobby'
import { renderShop } from './ui/shop'
import { renderWardrobe } from './ui/wardrobe'
import { renderLoadout } from './ui/loadout'
import { renderResult } from './ui/result'
import { renderRecords } from './ui/records'
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
// 터치 컨트롤러는 판 중에만 gameLayer 에 붙는다. 존 경계는 gameLayer 폭(= 뷰포트 폭)의 절반.
const touch = createTouch(input, () => ({ width: gameLayer.clientWidth }))
let detachTouch: (() => void) | null = null
let overlay: MountedTouchOverlay | null = null
// 안내를 이미 내렸으면 매 프레임 dismissHint 를 부르지 않기 위한 로컬 플래그 (dismissHint 자체도 멱등)
let hintDismissed = false

let save: SaveData = loadSave({ outfits: OUTFIT_IDS, consumables: CONSUMABLE_IDS })
const renderer = createRenderer(screen, save.equippedOutfit)
let state: GameState | null = null
let rng = createRng(Date.now() >>> 0)
let quizOpen = false

// 셸의 활성 탭. 로드아웃은 탭이 아니라 로비에서 진입하는 서브뷰라서
// 별도 상태로 관리한다 — 탭을 벗어나지 않고도 로비 위에 겹쳐 그려진다.
let tab: Tab = 'lobby'
let showingLoadout = false
let lastResult: { run: RunState; isNewBest: boolean } | null = null

// 실제로 판을 플레이하는 동안에만 키를 가로챈다 — 로비·상점·퀴즈 모달에서는
// Space로 버튼을 누르고 ArrowUp으로 패널을 스크롤할 수 있어야 한다
input.attach(window, () => state !== null && !quizOpen)

window.addEventListener('resize', () => fitScreen(screen))

// 탭 복귀 — 밀린 시간을 버리고 키 상태를 초기화한다 (스펙 4절)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    loop.reset()
    input.reset()
    // reset 이 아니라 clear — 숨겨진 동안 OS 가 터치를 가져갔다. 추적 중이던 포인터는
    // 전부 stale 이고 up 이 안 올 수 있다. 늦게 오더라도 목록에 없어 무시된다.
    touch.clear()
  }
})

const persist = (): void => { writeSave(save) }

// 판을 떠날 때의 정리 — 판 중이 아닐 때 불려도 안전하도록 null 가드로 멱등하게 둔다.
// detach 가 내부에서 clear 하므로 눌린 채 끝난 손가락이 다음 판의 존을 점유하지 않는다.
function leaveRun(): void {
  detachTouch?.()
  detachTouch = null
  overlay?.unmount()
  overlay = null
  void setSwipeBack(true)
}

function render(): void {
  // 결과 화면은 셸(탭바/재화) 없이, 마지막으로 그려진 게임 프레임 위에 뜨는
  // 모달로 그린다 — 그래서 여기서는 gameLayer를 숨기지 않고 그냥 반환한다.
  if (lastResult !== null) {
    renderResult(uiLayer, lastResult.run, lastResult.isNewBest, {
      onRetry: enterLoadout,
      onLobby: goToLobby,
    })
    return
  }

  gameLayer.classList.add('hidden')

  const body = renderShell(uiLayer, save, tab, {
    onTab(next) {
      tab = next
      showingLoadout = false
      render()
    },
  })

  if (showingLoadout) {
    renderLoadout(body, save, {
      onToggle(id) {
        const at = save.selectedConsumables.indexOf(id)
        if (at >= 0) {
          save.selectedConsumables.splice(at, 1)
        } else if (save.consumables[id as keyof typeof save.consumables] >= 1) {
          save.selectedConsumables.push(id)
        }
        persist()
        render()
      },
      onStart: startRun,
      onClose: goToLobby,
    })
    return
  }

  switch (tab) {
    case 'lobby':
      renderLobby(body, save, {
        onPlay: enterLoadout,
        onShop() { tab = 'shop'; render() },
        // 소모품 칩은 표시 + 로드아웃 진입점일 뿐이다 — 여기서 아무것도
        // 자동으로 장착하지 않는다. 실제 장착/해제는 loadout의 onToggle이 한다.
        onLoadout: enterLoadout,
      })
      break
    case 'shop':
      renderShop(body, save, {
        onBuyUpgrade(id) {
          const upgrade = UPGRADES.find((u) => u.id === id)
          if (upgrade === undefined) return
          const level = save.upgrades[upgrade.id]
          const price = nextUpgradePrice(upgrade, level)
          if (price === null || save.coins < price) return
          save.coins -= price
          save.upgrades[upgrade.id] = level + 1
          persist()
          render()
        },
        onBuyConsumable(id) {
          const item = CONSUMABLES.find((c) => c.id === id)
          if (item === undefined || save.coins < item.price) return
          // 로드 시 재고를 CONSUMABLE_MAX로 자르므로, 상한을 넘겨 사면 코인만
          // 날리고 다음 로드에서 재고가 사라진다. 두 쪽이 같은 상수를 본다.
          if (save.consumables[item.id] >= CONSUMABLE_MAX) return
          save.coins -= item.price
          save.consumables[item.id] += 1
          persist()
          render()
        },
      })
      break
    case 'wardrobe':
      renderWardrobe(body, save, {
        onCraft(id) {
          const outfit = outfitById(id)
          if (!canCraft(outfit, save.thread, save.ownedOutfits)) return
          save.thread -= outfit.threadCost
          save.ownedOutfits.push(outfit.id)
          persist()
          render()
        },
        onEquip(id) {
          if (!save.ownedOutfits.includes(id)) return
          save.equippedOutfit = id
          renderer.setOutfit(id)
          persist()
          render()
        },
      })
      break
    case 'records':
      renderRecords(body, save)
      break
  }
}

// 탭 진입점 — 판이 실행 중이 아닐 때만 호출되는 경로들이지만, 방어적으로
// state를 항상 비운다. 그래야 나중에 어떤 경로가 판 도중 이 함수를 부르더라도
// 화면 아래에서 루프가 조용히 계속 돌지 않는다.
function goToLobby(): void {
  leaveRun()
  state = null
  tab = 'lobby'
  showingLoadout = false
  lastResult = null
  render()
}

function enterLoadout(): void {
  leaveRun()
  state = null
  tab = 'lobby'
  showingLoadout = true
  lastResult = null
  render()
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

  detachTouch = touch.attach(gameLayer)   // 내부에서 clear — touch.reset() 은 따로 부르지 않는다
  hintDismissed = false
  overlay = mountTouchOverlay(gameLayer, touch, {
    showHint: !save.controlsHintSeen,
    onHintDone() {
      save.controlsHintSeen = true
      persist()
    },
  })
  void setSwipeBack(false)

  loop.reset()
  input.reset()
  lastTime = performance.now()
}

function finishRun(run: GameState['run']): void {
  const { isNewBest } = computeFinishRun(save, run)
  persist()

  // gameLayer는 일부러 숨기지 않는다 — 결과 화면은 마지막으로 그려진 프레임
  // 위에 뜨는 모달이다. render()가 lastResult를 보고 셸을 건너뛴다.
  leaveRun()
  state = null
  lastResult = { run, isNewBest }
  render()
}

function openQuiz(current: GameState): void {
  const pending = current.pendingQuiz
  if (pending === null) return

  quizOpen = true
  const question = pickQuestion(pending.platformY, save.seenQuizIds, rng)
  persist()

  showQuiz(uiLayer, question, rng, (result) => {
    if (result.correct && result.reward !== null) {
      const reward = rewardFor(question.difficulty)
      if (result.reward === 'thread') current.run.thread += reward.thread
      else if (result.reward === 'coin') current.run.coins += reward.coin
      // 에너지가 가득이면 코인으로 — 아이템 경로와 같은 규칙을 쓴다
      else grantFood(current.run, reward.food)
    }

    // 일시정지 규약 (스펙 8절) — 순서대로
    current.pendingQuiz = null
    current.paused = false
    loop.reset()      // accumulator 폐기 — 없으면 시간이 순간이동한다
    input.reset()     // 키 상태 초기화 — 모달에서 누른 Space가 점프로 이어지지 않는다
    touch.reset()     // 손가락은 아직 화면에 있다 — suppressed 로 두고 액션만 해제 (순서 무관)
    lastTime = performance.now()
    quizOpen = false
  })
}

let lastTime = performance.now()

function frame(now: number): void {
  const delta = (now - lastTime) / 1000
  lastTime = now

  if (state !== null) {
    if (overlay !== null && !hintDismissed) {
      const s = input.snapshot()
      if (s.left || s.right || s.jumpHeld || s.jumpPressed) {
        hintDismissed = true
        overlay.dismissHint()
      }
    }

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

render()
requestAnimationFrame(frame)
