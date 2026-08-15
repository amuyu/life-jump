import type { SaveData } from '../core/storage'

export type Tab = 'lobby' | 'wardrobe' | 'shop' | 'records'

export interface ShellCallbacks {
  onTab(tab: Tab): void
}

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'lobby', label: '로비' },
  { id: 'wardrobe', label: '옷장' },
  { id: 'shop', label: '상점' },
  { id: 'records', label: '기록' },
]

/**
 * 헤더(워드마크 + 재화 필)와 탭바를 그리고, 화면이 그려질 본문 컨테이너를 돌려준다.
 * 매 render() 마다 새로 그리므로 재화 표시는 항상 최신 save를 반영한다.
 */
export function renderShell(
  mount: HTMLElement, save: SaveData, active: Tab, cb: ShellCallbacks,
): HTMLElement {
  mount.innerHTML = ''

  const shell = document.createElement('div')
  shell.className = 'shell'

  const header = document.createElement('div')
  header.className = 'shell-header'

  const wordmark = document.createElement('div')
  wordmark.className = 'wordmark'
  wordmark.innerHTML = `
    <span class="wordmark-title">Life Jump</span>
    <span class="wordmark-sub">끝없이 올라가는 수직 플랫포머</span>`
  header.appendChild(wordmark)

  const pills = document.createElement('div')
  pills.className = 'currency-pills'
  pills.innerHTML = `
    <span class="currency-pill">실 ${save.thread}</span>
    <span class="currency-pill">코인 ${save.coins}</span>`
  header.appendChild(pills)

  shell.appendChild(header)

  const tabBar = document.createElement('div')
  tabBar.className = 'tab-bar'
  for (const t of TABS) {
    const btn = document.createElement('button')
    btn.className = t.id === active ? 'button-pill-tab button-pill-tab-active' : 'button-pill-tab'
    btn.textContent = t.label
    btn.onclick = () => cb.onTab(t.id)
    tabBar.appendChild(btn)
  }
  shell.appendChild(tabBar)

  const body = document.createElement('div')
  body.className = 'shell-body'
  shell.appendChild(body)

  mount.appendChild(shell)
  return body
}
