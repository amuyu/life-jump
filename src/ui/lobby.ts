import type { SaveData } from '../core/storage'
import type { ZoneName } from '../game/state'
import { zoneAt } from '../game/zones'
import { outfitById } from '../data/outfits'
import { CONSUMABLES } from '../data/shop'
import { ICON_MAPS, ICON_PALETTES } from '../data/pixelmaps'
import { outfitCanvas, spriteCanvas } from './spritePreview'
import * as C from '../constants'

export interface LobbyCallbacks {
  onPlay(): void
  onShop(): void
  /** 소모품 칩 클릭 — 표시 + 로드아웃 진입점. 자동으로 장착하지 않는다. */
  onLoadout(): void
}

const ZONE_LABELS: Readonly<Record<ZoneName, string>> = {
  ground: '땅',
  sky: '하늘',
  space: '우주',
}

function actionButton(
  label: string,
  variant: 'primary' | 'secondary',
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button')
  button.className = `btn button-${variant}`
  button.textContent = label
  button.onclick = onClick
  return button
}

export function renderLobby(
  mount: HTMLElement, save: SaveData, cb: LobbyCallbacks,
): void {
  mount.innerHTML = ''

  const hero = document.createElement('div')
  hero.className = 'lobby-hero'

  // 좌측 — 착용 옷 히어로 프리뷰
  const preview = document.createElement('div')
  preview.className = 'lobby-preview'
  preview.appendChild(outfitCanvas(save.equippedOutfit, 14))
  hero.appendChild(preview)

  // 우측 — 최고 기록 + 착용 옷 + 소모품 칩 + 액션
  const info = document.createElement('div')
  info.className = 'lobby-info'

  const best = Math.floor(save.bestHeight / C.PX_PER_M)
  const zoneLabel = ZONE_LABELS[zoneAt(save.bestHeight)]

  const stat = document.createElement('div')
  stat.innerHTML = `
    <div class="type-body-sm lobby-stat-label">최고 기록</div>
    <div class="type-display-lg lobby-stat-value">${best}m</div>
    <div class="type-body-sm lobby-stat-sub">${save.totalRuns}회 기록 · ${zoneLabel} 구간 도달</div>`
  info.appendChild(stat)

  const outfit = outfitById(save.equippedOutfit)
  const equippedRow = document.createElement('div')
  equippedRow.className = 'lobby-equipped'
  const equippedName = document.createElement('span')
  equippedName.className = 'type-body-md-bold'
  equippedName.textContent = outfit.name
  equippedRow.appendChild(equippedName)
  const equippedBadge = document.createElement('span')
  equippedBadge.className = 'badge badge-success'
  equippedBadge.textContent = '착용 중'
  equippedRow.appendChild(equippedBadge)
  info.appendChild(equippedRow)

  // 소모품 칩 — 이번 판에 적용될 항목을 보여줄 뿐, 클릭하면 로드아웃으로
  // 이동한다. 여기서 재고를 소비하거나 장착 목록을 바꾸지 않는다.
  const consumablesBlock = document.createElement('div')
  consumablesBlock.className = 'lobby-consumables'
  const consumablesLabel = document.createElement('div')
  consumablesLabel.className = 'type-body-sm lobby-consumables-label'
  consumablesLabel.textContent = '이번 판에 적용될 소모품'
  consumablesBlock.appendChild(consumablesLabel)

  const chipRow = document.createElement('div')
  chipRow.className = 'lobby-chip-row'

  const active = CONSUMABLES.filter(
    (c) => save.selectedConsumables.includes(c.id) && save.consumables[c.id] >= 1,
  )

  if (active.length === 0) {
    const empty = document.createElement('button')
    empty.type = 'button'
    empty.className = 'lobby-chip lobby-chip-empty type-caption-bold'
    empty.textContent = '소모품 선택하기'
    empty.onclick = () => cb.onLoadout()
    chipRow.appendChild(empty)
  } else {
    for (const item of active) {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'lobby-chip'
      chip.appendChild(spriteCanvas(ICON_MAPS[item.id], ICON_PALETTES[item.id], 2))
      const label = document.createElement('span')
      label.className = 'type-caption-bold'
      label.textContent = item.name
      chip.appendChild(label)
      chip.onclick = () => cb.onLoadout()
      chipRow.appendChild(chip)
    }
  }
  consumablesBlock.appendChild(chipRow)
  info.appendChild(consumablesBlock)

  const actions = document.createElement('div')
  actions.className = 'lobby-actions'
  actions.appendChild(actionButton('게임 시작', 'primary', () => cb.onPlay()))
  actions.appendChild(actionButton('상점 둘러보기', 'secondary', () => cb.onShop()))
  info.appendChild(actions)

  const hint = document.createElement('div')
  hint.className = 'type-caption lobby-hint'
  hint.textContent = '↑ 또는 Space로 점프. 길게 누르면 더 높이. ← → 로 좌우 이동.'
  info.appendChild(hint)

  hero.appendChild(info)
  mount.appendChild(hero)
}
