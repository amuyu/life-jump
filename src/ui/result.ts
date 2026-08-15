import type { RunState } from '../game/state'
import * as C from '../constants'

export interface ResultCallbacks {
  onRetry(): void
  onLobby(): void
}

export function renderResult(
  mount: HTMLElement, run: RunState, isNewBest: boolean, cb: ResultCallbacks,
): void {
  mount.innerHTML = ''

  const panel = document.createElement('div')
  panel.className = 'panel'

  const meters = Math.floor(run.maxHeight / C.PX_PER_M)
  panel.innerHTML = `
    <h2>${isNewBest ? '신기록!' : '기록'}</h2>
    <p class="big-score">${meters}m</p>
    <div class="stats">
      <div><span>얻은 실</span><strong>${run.thread}</strong></div>
      <div><span>얻은 코인</span><strong>${run.coins}</strong></div>
    </div>`

  const retry = document.createElement('button')
  retry.className = 'wide primary'
  retry.textContent = '다시 도전'
  retry.onclick = () => cb.onRetry()
  panel.appendChild(retry)

  const lobby = document.createElement('button')
  lobby.className = 'wide'
  lobby.textContent = '로비로'
  lobby.onclick = () => cb.onLobby()
  panel.appendChild(lobby)

  mount.appendChild(panel)
}
