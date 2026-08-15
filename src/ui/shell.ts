import type { SaveData } from '../core/storage'
import { OUTFITS, type Outfit } from '../data/outfits'

export type Tab = 'lobby' | 'wardrobe' | 'shop' | 'records'

export interface ShellCallbacks {
  onTab(tab: Tab): void
}

/** 한글 받침 유무에 따라 목적격 조사(을/를)를 고른다. 완성형 한글이 아니면 '를'로 fallback. */
function withObjectParticle(name: string): string {
  const last = name.charCodeAt(name.length - 1)
  const isHangulSyllable = last >= 0xac00 && last <= 0xd7a3
  const hasBatchim = isHangulSyllable && (last - 0xac00) % 28 !== 0
  return `${name}${hasBatchim ? '을' : '를'}`
}

/**
 * OUTFITS와 save.thread에 대한 순수 함수 — 다음 목표(가장 싼 미보유 옷)를 고르고
 * 배너 문구를 만든다. 리디자인에서 유일하게 플레이어에게 목표를 제시하는 요소라
 * 상태를 명시적으로 나눈다:
 *   - 전부 보유했다 → null (더 이상 보여줄 목표가 없다. 감춘다)
 *   - 이미 실이 충분하다 → 지금 만들 수 있다고 알린다 ("실 N개면"은 N=0일 때
 *     말이 안 되므로 별도 문구를 쓴다)
 *   - 아직 모자라다 → 모의 화면 그대로, 남은 실 개수로 "얼마나 가까운지"를 보여준다
 */
export function promoMessage(save: SaveData): string | null {
  let target: Outfit | null = null
  for (const outfit of OUTFITS) {
    if (save.ownedOutfits.includes(outfit.id)) continue
    if (target === null || outfit.threadCost < target.threadCost) target = outfit
  }
  if (target === null) return null

  const name = withObjectParticle(target.name)
  const remaining = target.threadCost - save.thread
  if (remaining <= 0) return `지금 바로 ${name} 만들 수 있어요.`
  return `실 ${remaining}개면 ${name} 만들 수 있어요.`
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

  const promo = promoMessage(save)
  if (promo !== null) {
    const banner = document.createElement('div')
    banner.className = 'promo-banner'
    const text = document.createElement('span')
    text.textContent = promo
    banner.appendChild(text)
    const link = document.createElement('a')
    link.href = '#'
    link.textContent = '옷장 보기'
    link.onclick = (e) => {
      e.preventDefault()
      cb.onTab('wardrobe')
    }
    banner.appendChild(link)
    shell.appendChild(banner)
  }

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
