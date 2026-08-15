import type { SaveData } from '../core/storage'
import * as C from '../constants'

export interface LobbyCallbacks {
  onPlay(): void
  onShop(): void
  onWardrobe(): void
}

export function renderLobby(
  mount: HTMLElement, save: SaveData, cb: LobbyCallbacks,
): void {
  mount.innerHTML = ''

  const panel = document.createElement('div')
  panel.className = 'panel'

  const best = Math.floor(save.bestHeight / C.PX_PER_M)
  panel.innerHTML = `
    <h1 class="logo">LIFE JUMP</h1>
    <p class="tagline">땅에서 우주까지, 계속 올라가세요</p>
    <div class="stats">
      <div><span>최고 기록</span><strong>${best}m</strong></div>
      <div><span>도전 횟수</span><strong>${save.totalRuns}</strong></div>
      <div><span>실</span><strong>${save.thread}</strong></div>
      <div><span>코인</span><strong>${save.coins}</strong></div>
    </div>`

  const play = document.createElement('button')
  play.className = 'wide primary'
  play.textContent = '게임 시작'
  play.onclick = () => cb.onPlay()
  panel.appendChild(play)

  const shop = document.createElement('button')
  shop.className = 'wide'
  shop.textContent = '상점'
  shop.onclick = () => cb.onShop()
  panel.appendChild(shop)

  const wardrobe = document.createElement('button')
  wardrobe.className = 'wide'
  wardrobe.textContent = '옷장'
  wardrobe.onclick = () => cb.onWardrobe()
  panel.appendChild(wardrobe)

  mount.appendChild(panel)
}
