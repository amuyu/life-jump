import type { RunState } from '../game/state'
import type { PixelMap, Palette } from '../data/pixelmaps'
import { ITEM_MAPS, ITEM_PALETTES } from '../data/pixelmaps'
import { spriteCanvas } from './spritePreview'
import * as C from '../constants'

export interface ResultCallbacks {
  onRetry(): void
  onLobby(): void
}

function actionButton(
  label: string, variant: 'primary' | 'secondary', onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button')
  button.className = `btn button-${variant}`
  button.textContent = label
  button.onclick = onClick
  return button
}

function statCard(map: PixelMap, palette: Palette, amount: number, label: string): HTMLElement {
  const card = document.createElement('div')
  card.className = 'result-stat'
  card.appendChild(spriteCanvas(map, palette, 3))
  const text = document.createElement('div')
  text.innerHTML = `
    <div class="type-body-md-bold">+${amount}</div>
    <div class="type-caption result-stat-label">${label}</div>`
  card.appendChild(text)
  return card
}

/**
 * 게임 레이어(마지막 프레임이 얼어붙은 캔버스) 위에 뜨는 모달로 그린다.
 * gameLayer를 숨기는 것은 main.ts의 몫이다 — 여기서는 오버레이만 그린다.
 */
export function renderResult(
  mount: HTMLElement, run: RunState, isNewBest: boolean, cb: ResultCallbacks,
): void {
  mount.innerHTML = ''

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'

  const box = document.createElement('div')
  box.className = 'panel result-panel'
  overlay.appendChild(box)

  const tag = document.createElement('div')
  tag.className = 'type-caption-bold result-tag'
  tag.textContent = isNewBest ? '신기록!' : '기록'
  box.appendChild(tag)

  const meters = Math.floor(run.maxHeight / C.PX_PER_M)
  const height = document.createElement('div')
  height.className = 'type-display-lg result-height'
  height.textContent = `${meters}m`
  box.appendChild(height)

  const stats = document.createElement('div')
  stats.className = 'result-stats'
  stats.appendChild(statCard(ITEM_MAPS.thread, ITEM_PALETTES.thread, run.thread, '실'))
  stats.appendChild(statCard(ITEM_MAPS.coin, ITEM_PALETTES.coin, run.coins, '코인'))
  box.appendChild(stats)

  const note = document.createElement('p')
  note.className = 'type-caption result-note'
  // "잃은 것은 높이뿐"은 최고기록도 날아간 것처럼 읽힌다 — bestHeight와 recentRuns는
  // finishRun에서 저장된다. 죽은 직후야말로 기록이 남았다고 알려줘야 할 순간이다.
  note.textContent = '이번 판은 종료되지만 획득한 재화와 최고기록은 보존됩니다.'
  box.appendChild(note)

  const actions = document.createElement('div')
  actions.className = 'result-actions'
  actions.appendChild(actionButton('다시 도전', 'primary', () => cb.onRetry()))
  actions.appendChild(actionButton('로비로', 'secondary', () => cb.onLobby()))
  box.appendChild(actions)

  mount.appendChild(overlay)
}
