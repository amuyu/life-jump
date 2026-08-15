import type { SaveData } from '../core/storage'
import { OUTFITS, canCraft } from '../data/outfits'

export interface WardrobeCallbacks {
  onCraft(outfitId: string): void
  onEquip(outfitId: string): void
  onClose(): void
}

export function renderWardrobe(
  mount: HTMLElement, save: SaveData, cb: WardrobeCallbacks,
): void {
  mount.innerHTML = ''

  const panel = document.createElement('div')
  panel.className = 'panel'

  const header = document.createElement('div')
  header.className = 'panel-header'
  header.innerHTML = `<h2>옷장</h2><span class="currency">실 ${save.thread}</span>`
  panel.appendChild(header)

  const list = document.createElement('div')
  list.className = 'item-list'

  for (const outfit of OUTFITS) {
    const owned = save.ownedOutfits.includes(outfit.id)
    const equipped = save.equippedOutfit === outfit.id
    const craftable = canCraft(outfit, save.thread, save.ownedOutfits)

    const row = document.createElement('div')
    row.className = 'item-row'

    const swatch = document.createElement('span')
    swatch.className = 'swatch'
    swatch.style.background = outfit.palette['c'] ?? '#888'
    row.appendChild(swatch)

    const label = document.createElement('span')
    label.className = 'item-name'
    label.textContent = outfit.name
    row.appendChild(label)

    const cost = document.createElement('span')
    cost.className = 'item-cost'
    cost.textContent = owned ? '보유' : `실 ${outfit.threadCost}`
    row.appendChild(cost)

    const button = document.createElement('button')
    if (equipped) {
      button.textContent = '착용 중'
      button.disabled = true
    } else if (owned) {
      button.textContent = '입기'
      button.onclick = () => cb.onEquip(outfit.id)
    } else {
      button.textContent = '만들기'
      button.disabled = !craftable
      button.onclick = () => cb.onCraft(outfit.id)
    }
    row.appendChild(button)

    list.appendChild(row)
  }

  panel.appendChild(list)

  const close = document.createElement('button')
  close.className = 'wide'
  close.textContent = '돌아가기'
  close.onclick = () => cb.onClose()
  panel.appendChild(close)

  mount.appendChild(panel)
}
