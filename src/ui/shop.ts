import type { SaveData } from '../core/storage'
import { UPGRADES, CONSUMABLES, nextUpgradePrice } from '../data/shop'

export interface ShopCallbacks {
  onBuyUpgrade(id: string): void
  onBuyConsumable(id: string): void
  onClose(): void
}

export function renderShop(
  mount: HTMLElement, save: SaveData, cb: ShopCallbacks,
): void {
  mount.innerHTML = ''

  const panel = document.createElement('div')
  panel.className = 'panel'
  panel.innerHTML = `
    <div class="panel-header">
      <h2>상점</h2><span class="currency">코인 ${save.coins}</span>
    </div>
    <h3 class="section">영구 업그레이드</h3>`

  const upgrades = document.createElement('div')
  upgrades.className = 'item-list'

  for (const u of UPGRADES) {
    const level = save.upgrades[u.id]
    const price = nextUpgradePrice(u, level)

    const row = document.createElement('div')
    row.className = 'item-row'
    row.innerHTML = `
      <span class="item-name">${u.name} <small>Lv${level}/${u.prices.length}</small></span>
      <span class="item-cost">${price === null ? '만렙' : `${price}C`}</span>`

    const button = document.createElement('button')
    button.textContent = price === null ? '완료' : '구매'
    button.disabled = price === null || save.coins < price
    if (price !== null) button.onclick = () => cb.onBuyUpgrade(u.id)
    row.appendChild(button)

    const desc = document.createElement('span')
    desc.className = 'item-desc'
    desc.textContent = u.desc
    row.appendChild(desc)

    upgrades.appendChild(row)
  }
  panel.appendChild(upgrades)

  const h3 = document.createElement('h3')
  h3.className = 'section'
  h3.textContent = '소모품'
  panel.appendChild(h3)

  const consumables = document.createElement('div')
  consumables.className = 'item-list'

  for (const c of CONSUMABLES) {
    const row = document.createElement('div')
    row.className = 'item-row'
    row.innerHTML = `
      <span class="item-name">${c.name} <small>보유 ${save.consumables[c.id]}</small></span>
      <span class="item-cost">${c.price}C</span>`

    const button = document.createElement('button')
    button.textContent = '구매'
    button.disabled = save.coins < c.price
    button.onclick = () => cb.onBuyConsumable(c.id)
    row.appendChild(button)

    const desc = document.createElement('span')
    desc.className = 'item-desc'
    desc.textContent = c.desc
    row.appendChild(desc)

    consumables.appendChild(row)
  }
  panel.appendChild(consumables)

  const close = document.createElement('button')
  close.className = 'wide'
  close.textContent = '돌아가기'
  close.onclick = () => cb.onClose()
  panel.appendChild(close)

  mount.appendChild(panel)
}
