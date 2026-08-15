import type { SaveData } from '../core/storage'
import { CONSUMABLES } from '../data/shop'

export interface LoadoutCallbacks {
  onToggle(id: string): void
  onStart(): void
  onClose(): void
}

export function renderLoadout(
  mount: HTMLElement, save: SaveData, cb: LoadoutCallbacks,
): void {
  mount.innerHTML = ''

  const panel = document.createElement('div')
  panel.className = 'panel'
  panel.innerHTML = `<div class="panel-header"><h2>출발 준비</h2></div>`

  const list = document.createElement('div')
  list.className = 'item-list'

  for (const c of CONSUMABLES) {
    const stock = save.consumables[c.id]
    const selected = save.selectedConsumables.includes(c.id)

    const row = document.createElement('div')
    row.className = 'item-row'
    row.innerHTML = `
      <span class="item-name">${c.name} <small>보유 ${stock}</small></span>
      <span class="item-cost">${c.desc}</span>`

    const button = document.createElement('button')
    button.textContent = selected ? '장착됨' : '장착'
    if (selected) button.className = 'selected'
    // 재고 0이면 장착할 수 없다 — consumeSelected가 이중 방어한다
    button.disabled = stock < 1 && !selected
    button.onclick = () => cb.onToggle(c.id)
    row.appendChild(button)

    list.appendChild(row)
  }
  panel.appendChild(list)

  const start = document.createElement('button')
  start.className = 'wide'
  start.textContent = '출발!'
  start.onclick = () => cb.onStart()
  panel.appendChild(start)

  const back = document.createElement('button')
  back.className = 'wide'
  back.textContent = '돌아가기'
  back.onclick = () => cb.onClose()
  panel.appendChild(back)

  mount.appendChild(panel)
}
