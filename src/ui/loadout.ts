import type { SaveData } from '../core/storage'
import { CONSUMABLES } from '../data/shop'
import { ICON_MAPS, ICON_PALETTES } from '../data/pixelmaps'
import { spriteCanvas } from './spritePreview'

export interface LoadoutCallbacks {
  onToggle(id: string): void
  onStart(): void
  onClose(): void
}

function toggleButton(
  selected: boolean, disabled: boolean, onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button')
  // button-primary-disabled은 button-primary와 짝을 이루도록 만들어진 클래스라
  // (components.css) button-secondary와 같이 붙이면 동률 specificity에서
  // 소스 순서로 승부가 갈려 배경·글자색이 조용히 secondary 쪽으로 새 버린다.
  // 그래서 비활성 상태는 항상 primary 베이스를 쓴다.
  const classes = ['btn', selected || disabled ? 'button-primary' : 'button-secondary']
  if (disabled) classes.push('button-primary-disabled')
  button.className = classes.join(' ')
  button.textContent = selected ? '장착됨' : '장착'
  button.disabled = disabled
  button.onclick = onClick
  return button
}

export function renderLoadout(
  mount: HTMLElement, save: SaveData, cb: LoadoutCallbacks,
): void {
  mount.innerHTML = ''

  const panel = document.createElement('div')
  panel.className = 'panel panel-wide'

  const header = document.createElement('div')
  header.className = 'loadout-header'
  header.innerHTML = `
    <h2 class="type-heading-lg">출발 준비</h2>
    <p class="type-body-sm loadout-sub">소모품을 장착하면 다음 한 판에만 적용됩니다.</p>`
  panel.appendChild(header)

  const list = document.createElement('div')
  list.className = 'loadout-list'

  for (const c of CONSUMABLES) {
    const stock = save.consumables[c.id]
    const selected = save.selectedConsumables.includes(c.id)

    const row = document.createElement('div')
    row.className = 'upgrade-card'

    const iconBox = document.createElement('div')
    iconBox.className = 'upgrade-icon'
    iconBox.appendChild(spriteCanvas(ICON_MAPS[c.id], ICON_PALETTES[c.id], 4))
    row.appendChild(iconBox)

    const info = document.createElement('div')
    info.className = 'upgrade-info'
    info.innerHTML = `
      <div class="type-body-md-bold">${c.name} <span class="type-caption loadout-stock">보유 ${stock}</span></div>
      <div class="type-body-sm upgrade-desc">${c.desc}</div>`
    row.appendChild(info)

    // 재고 0이면 장착할 수 없다 — consumeSelected가 이중 방어한다
    row.appendChild(toggleButton(selected, stock < 1 && !selected, () => cb.onToggle(c.id)))

    list.appendChild(row)
  }
  panel.appendChild(list)

  const footer = document.createElement('div')
  footer.className = 'loadout-footer'

  const start = document.createElement('button')
  start.className = 'btn button-primary'
  start.textContent = '출발!'
  start.onclick = () => cb.onStart()
  footer.appendChild(start)

  const back = document.createElement('button')
  back.className = 'btn button-secondary'
  back.textContent = '돌아가기'
  back.onclick = () => cb.onClose()
  footer.appendChild(back)

  panel.appendChild(footer)
  mount.appendChild(panel)
}
