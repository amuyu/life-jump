import type { SaveData } from '../core/storage'
import { UPGRADE_MAX, CONSUMABLE_MAX } from '../core/storage'
import { UPGRADES, CONSUMABLES, nextUpgradePrice } from '../data/shop'
import { ICON_MAPS, ICON_PALETTES, ITEM_MAPS, ITEM_PALETTES } from '../data/pixelmaps'
import { spriteCanvas } from './spritePreview'

export interface ShopCallbacks {
  onBuyUpgrade(id: string): void
  onBuyConsumable(id: string): void
}

function actionButton(
  label: string, disabled: boolean, onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button')
  const classes = ['btn', 'button-primary']
  if (disabled) classes.push('button-primary-disabled')
  button.className = classes.join(' ')
  button.textContent = label
  button.disabled = disabled
  button.onclick = onClick
  return button
}

/** ● (달성) ○ (미달성) 레벨 점 — 점의 개수는 항상 데이터가 주는 만렙 값을 따른다 */
function levelDots(level: number, max: number): HTMLElement {
  const wrap = document.createElement('span')
  wrap.className = 'level-dots'
  for (let i = 0; i < max; i++) {
    const dot = document.createElement('span')
    dot.className = i < level ? 'level-dot level-dot-filled' : 'level-dot'
    wrap.appendChild(dot)
  }
  return wrap
}

function coinRow(price: number): HTMLElement {
  const row = document.createElement('div')
  row.className = 'upgrade-price'
  row.appendChild(spriteCanvas(ITEM_MAPS.coin, ITEM_PALETTES.coin, 2))
  const text = document.createElement('span')
  text.className = 'type-body-sm-bold'
  text.textContent = `${price}`
  row.appendChild(text)
  return row
}

export function renderShop(
  mount: HTMLElement, save: SaveData, cb: ShopCallbacks,
): void {
  mount.innerHTML = ''

  const panel = document.createElement('div')
  panel.className = 'panel panel-wide'

  const header = document.createElement('div')
  header.className = 'shop-header'
  header.innerHTML = `
    <h2 class="type-heading-lg">상점</h2>
    <p class="type-body-sm shop-sub">영구 업그레이드는 계속 남고, 소모품은 다음 한 판에만 적용됩니다.</p>`
  panel.appendChild(header)

  const upgradeList = document.createElement('div')
  upgradeList.className = 'upgrade-list'

  for (const u of UPGRADES) {
    const level = save.upgrades[u.id]
    const max = UPGRADE_MAX[u.id]
    const price = nextUpgradePrice(u, level)

    const card = document.createElement('div')
    card.className = 'upgrade-card'

    const iconBox = document.createElement('div')
    iconBox.className = 'upgrade-icon'
    iconBox.appendChild(spriteCanvas(ICON_MAPS[u.id], ICON_PALETTES[u.id], 4))
    card.appendChild(iconBox)

    const info = document.createElement('div')
    info.className = 'upgrade-info'
    info.innerHTML = `
      <div class="type-body-md-bold">${u.name}</div>
      <div class="type-body-sm upgrade-desc">${u.desc}</div>`
    card.appendChild(info)

    const levelBox = document.createElement('div')
    levelBox.className = 'upgrade-level'
    levelBox.appendChild(levelDots(level, max))
    const levelLabel = document.createElement('span')
    levelLabel.className = 'type-caption upgrade-level-label'
    levelLabel.textContent = `Lv ${level}/${max}`
    levelBox.appendChild(levelLabel)
    card.appendChild(levelBox)

    if (price !== null) {
      card.appendChild(coinRow(price))
      card.appendChild(actionButton('구매', save.coins < price, () => cb.onBuyUpgrade(u.id)))
    } else {
      const maxed = document.createElement('span')
      maxed.className = 'badge badge-success'
      maxed.textContent = '만렙'
      card.appendChild(maxed)
    }

    upgradeList.appendChild(card)
  }
  panel.appendChild(upgradeList)

  const consumablesHeading = document.createElement('h3')
  consumablesHeading.className = 'type-heading-sm shop-section-heading'
  consumablesHeading.textContent = '소모품'
  panel.appendChild(consumablesHeading)

  const consumableGrid = document.createElement('div')
  consumableGrid.className = 'consumable-grid'

  for (const c of CONSUMABLES) {
    const stock = save.consumables[c.id]

    const card = document.createElement('div')
    card.className = 'consumable-card'

    const iconBox = document.createElement('div')
    iconBox.className = 'consumable-icon'
    iconBox.appendChild(spriteCanvas(ICON_MAPS[c.id], ICON_PALETTES[c.id], 6))
    card.appendChild(iconBox)

    const info = document.createElement('div')
    info.className = 'consumable-info'
    info.innerHTML = `
      <div class="consumable-info-top">
        <span class="type-body-md-bold">${c.name}</span>
        <span class="type-caption consumable-stock">보유 ${stock}</span>
      </div>
      <div class="type-body-sm upgrade-desc">${c.desc}</div>`
    card.appendChild(info)

    const footer = document.createElement('div')
    footer.className = 'consumable-footer'
    footer.appendChild(coinRow(c.price))
    // main.ts의 구매 콜백은 재고가 CONSUMABLE_MAX면 조용히 되돌아간다. 버튼이
    // 그걸 모르면 눌러도 아무 일이 없는 것처럼 보인다 — 위 업그레이드 섹션이
    // 만렙에서 배지로 바꾸는 것과 같은 이유로 여기서도 상태를 드러낸다.
    // 업그레이드와 달리 재고는 쓰면 줄어드니 배지가 아니라 비활성 버튼으로 둔다.
    const maxed = stock >= CONSUMABLE_MAX
    footer.appendChild(actionButton(
      maxed ? '최대 보유' : '구매',
      maxed || save.coins < c.price,
      () => cb.onBuyConsumable(c.id),
    ))
    card.appendChild(footer)

    consumableGrid.appendChild(card)
  }
  panel.appendChild(consumableGrid)

  mount.appendChild(panel)
}
