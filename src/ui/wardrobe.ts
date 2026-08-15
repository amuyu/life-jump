import type { SaveData } from '../core/storage'
import { OUTFITS, canCraft } from '../data/outfits'
import { ITEM_MAPS, ITEM_PALETTES } from '../data/pixelmaps'
import { outfitCanvas, spriteCanvas } from './spritePreview'

export interface WardrobeCallbacks {
  onCraft(outfitId: string): void
  onEquip(outfitId: string): void
}

/**
 * 옷 프리뷰 캔버스를 옷 id별로 들고 있다가 재렌더 시 그대로 옮겨(appendChild)
 * 재사용한다. outfitCanvas 자체는 1× 스프라이트를 내용 기준으로 캐싱해 주지만,
 * 여기서 만든 <canvas> DOM 노드를 매 render()마다 새로 만들면 열 벌 전부에
 * drawImage를 다시 태우게 된다 — 착용/제작 클릭마다 그리드 전체가 재렌더되므로
 * 이 캐시가 없으면 매번 열 번씩 다시 굽는 셈이다. 옷 하나는 한 렌더에 카드
 * 하나에만 나타나므로(같은 id가 동시에 두 곳에 필요할 일이 없으므로) 노드를
 * 옮겨 재사용해도 안전하다.
 */
const previewCache = new Map<string, HTMLCanvasElement>()
function cachedOutfitPreview(id: string): HTMLCanvasElement {
  let canvas = previewCache.get(id)
  if (canvas === undefined) {
    canvas = outfitCanvas(id, 7)
    previewCache.set(id, canvas)
  }
  return canvas
}

function actionButton(
  label: string,
  variant: 'primary' | 'secondary',
  disabled: boolean,
  onClick?: () => void,
): HTMLButtonElement {
  const button = document.createElement('button')
  const classes = ['btn', `button-${variant}`]
  // primary/secondary 각각 짝이 되는 -disabled 클래스를 붙인다 — 붙이지 않으면
  // (components.css) disabled 버튼이 살아있는 버튼과 픽셀 단위로 똑같아 보인다.
  if (disabled && variant === 'primary') classes.push('button-primary-disabled')
  if (disabled && variant === 'secondary') classes.push('button-secondary-disabled')
  button.className = classes.join(' ')
  button.textContent = label
  button.disabled = disabled
  if (onClick !== undefined) button.onclick = onClick
  return button
}

export function renderWardrobe(
  mount: HTMLElement, save: SaveData, cb: WardrobeCallbacks,
): void {
  mount.innerHTML = ''

  const panel = document.createElement('div')
  panel.className = 'panel panel-wide'

  const header = document.createElement('div')
  header.className = 'wardrobe-header'
  header.innerHTML = `
    <div>
      <h2 class="type-heading-lg">옷장</h2>
      <p class="type-body-sm wardrobe-sub">실을 모아 옷을 만드세요. 한 번 만든 옷은 영구 보유합니다.</p>
    </div>
    <span class="type-body-sm wardrobe-count">${save.ownedOutfits.length} / ${OUTFITS.length}벌 보유</span>`
  panel.appendChild(header)

  const grid = document.createElement('div')
  grid.className = 'outfit-grid'

  for (const outfit of OUTFITS) {
    const owned = save.ownedOutfits.includes(outfit.id)
    const equipped = save.equippedOutfit === outfit.id
    const craftable = canCraft(outfit, save.thread, save.ownedOutfits)

    const card = document.createElement('div')
    card.className = 'outfit-card'

    const preview = document.createElement('div')
    preview.className = equipped ? 'outfit-preview outfit-preview-equipped' : 'outfit-preview'
    preview.appendChild(cachedOutfitPreview(outfit.id))
    if (equipped) {
      const badge = document.createElement('span')
      badge.className = 'badge badge-success outfit-badge'
      badge.textContent = '착용 중'
      preview.appendChild(badge)
    }
    card.appendChild(preview)

    const info = document.createElement('div')
    info.className = 'outfit-info'

    const name = document.createElement('div')
    name.className = 'type-body-sm-bold'
    name.textContent = outfit.name
    info.appendChild(name)

    const costRow = document.createElement('div')
    costRow.className = 'outfit-cost-row'
    if (owned) {
      const ownedLabel = document.createElement('span')
      ownedLabel.className = 'type-caption outfit-cost-owned'
      ownedLabel.textContent = '보유'
      costRow.appendChild(ownedLabel)
    } else {
      costRow.appendChild(spriteCanvas(ITEM_MAPS.thread, ITEM_PALETTES.thread, 2))
      const cost = document.createElement('span')
      cost.className = craftable ? 'type-caption' : 'type-caption outfit-cost-short'
      cost.textContent = `실 ${outfit.threadCost}`
      costRow.appendChild(cost)
    }
    info.appendChild(costRow)
    card.appendChild(info)

    let button: HTMLButtonElement
    if (equipped) {
      button = actionButton('착용 중', 'secondary', true)
    } else if (owned) {
      button = actionButton('착용하기', 'primary', false, () => cb.onEquip(outfit.id))
    } else {
      button = actionButton('제작하기', 'primary', !craftable, () => cb.onCraft(outfit.id))
    }
    button.classList.add('outfit-action')
    card.appendChild(button)

    grid.appendChild(card)
  }
  panel.appendChild(grid)

  mount.appendChild(panel)
}
