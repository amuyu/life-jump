import type { SaveData } from '../core/storage'
import type { ZoneName } from '../game/state'
import { zoneAt } from '../game/zones'
import * as C from '../constants'

const ZONE_LABELS: Readonly<Record<ZoneName, string>> = {
  ground: '땅',
  sky: '하늘',
  space: '우주',
}

interface ZoneRow {
  id: ZoneName
  label: string
  range: string
  note: string
}

const metersOf = (px: number): number => Math.floor(px / C.PX_PER_M)

const ZONES: readonly ZoneRow[] = [
  {
    id: 'ground',
    label: '땅',
    range: `0–${metersOf(C.SKY_START_Y)}m`,
    note: '지상에서 시작하는 첫 구간입니다.',
  },
  {
    id: 'sky',
    label: '하늘',
    range: `${metersOf(C.SKY_START_Y)}–${metersOf(C.SPACE_START_Y)}m`,
    note: '구름과 새가 나타나는 중간 구간입니다.',
  },
  {
    id: 'space',
    label: '우주',
    range: `${metersOf(C.SPACE_START_Y)}m+`,
    note: '별과 행성이 보이는 최종 구간입니다.',
  },
]

/**
 * 구간별 진행도(0~1). bestHeight 하나와 SKY_START_Y·SPACE_START_Y 두 상수만으로
 * 계산한다 — 우주 구간은 상한이 없는 끝없는 구간이라 도달 여부(0 또는 1)로만
 * 표시한다.
 */
function zoneProgress(id: ZoneName, bestHeight: number): number {
  if (id === 'ground') {
    return Math.min(bestHeight, C.SKY_START_Y) / C.SKY_START_Y
  }
  if (id === 'sky') {
    if (bestHeight <= C.SKY_START_Y) return 0
    const span = C.SPACE_START_Y - C.SKY_START_Y
    return Math.min(bestHeight - C.SKY_START_Y, span) / span
  }
  return bestHeight >= C.SPACE_START_Y ? 1 : 0
}

function statTile(value: string, label: string): HTMLElement {
  const tile = document.createElement('div')
  tile.className = 'records-stat-tile'
  tile.innerHTML = `
    <div class="type-heading-sm">${value}</div>
    <div class="type-caption records-stat-label">${label}</div>`
  return tile
}

/** 8칸 막대 차트. recentRuns가 비어 있으면(신규 플레이어) 축을 그리지 않고 안내 문구만 보여준다. */
function renderChart(mount: HTMLElement, save: SaveData): void {
  const panel = document.createElement('div')
  panel.className = 'records-chart-panel'

  const title = document.createElement('div')
  title.className = 'type-body-sm-bold'
  title.textContent = '최근 플레이'
  panel.appendChild(title)

  if (save.recentRuns.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'type-body-sm records-chart-empty'
    empty.textContent = '아직 플레이 기록이 없습니다. 첫 판에 도전해 보세요.'
    panel.appendChild(empty)
    mount.appendChild(panel)
    return
  }

  const chart = document.createElement('div')
  chart.className = 'records-chart'

  const maxRun = Math.max(...save.recentRuns, 1)

  for (const height of save.recentRuns) {
    const col = document.createElement('div')
    col.className = 'records-bar-col'

    const label = document.createElement('span')
    label.className = 'type-caption records-bar-label'
    label.textContent = `${metersOf(height)}m`
    col.appendChild(label)

    const bar = document.createElement('div')
    // 정확히 같은 값만 최고기록으로 강조한다 — 일부러다. 동률이면 여러 막대가
    // 함께 강조될 수 있지만, 그건 정직한 결과다(정말 동률이니까). 위의
    // records-best-card가 어차피 진짜 전체 최고기록을 항상 보여주므로, 이
    // 막대 강조가 틀릴 일은 없다. 다만 신규 플레이어라 bestHeight가 0이면
    // recentRuns[0]도 0이라 이 최소 높이 스텁 막대가 "최고"로 강조되는데,
    // 이 역시 사실과 다르지 않다 — 0m가 지금까지의 최고 기록이 맞다.
    const isBest = height === save.bestHeight
    bar.className = isBest ? 'records-bar records-bar-best' : 'records-bar'
    const pct = Math.max(4, Math.round((height / maxRun) * 100))
    bar.style.height = `${pct}%`
    col.appendChild(bar)

    chart.appendChild(col)
  }

  panel.appendChild(chart)
  mount.appendChild(panel)
}

export function renderRecords(mount: HTMLElement, save: SaveData): void {
  mount.innerHTML = ''

  const panel = document.createElement('div')
  panel.className = 'panel panel-wide'

  const header = document.createElement('div')
  header.className = 'records-header'
  header.innerHTML = `
    <h2 class="type-heading-lg">기록</h2>
    <p class="type-body-sm records-sub">최고 기록과 구간 도달 현황입니다.</p>`
  panel.appendChild(header)

  // ── 최고 기록 카드 + 통계 4칸 ─────────────────────────────────
  const top = document.createElement('div')
  top.className = 'records-top'

  const bestCard = document.createElement('div')
  bestCard.className = 'records-best-card'
  const bestMeters = metersOf(save.bestHeight)
  const zoneLabel = ZONE_LABELS[zoneAt(save.bestHeight)]
  bestCard.innerHTML = `
    <div class="type-body-sm records-best-label">최고 기록</div>
    <div class="type-display-lg records-best-value">${bestMeters}m</div>
    <div class="type-body-sm records-best-sub">${zoneLabel} 구간 도달 · 총 ${save.totalRuns}회 플레이</div>`
  top.appendChild(bestCard)

  const statGrid = document.createElement('div')
  statGrid.className = 'records-stat-grid'

  const upgradeSum = Object.values(save.upgrades).reduce((sum, v) => sum + v, 0)
  // 다른 모든 px→m 표시(metersOf, lobby.ts, result.ts)는 floor를 쓴다 — 여기도
  // 맞춰야 12,845px 평균이 옆의 12,845px 한 판 기록과 다른 숫자(1285m vs
  // 1284m)로 보이는 일이 없다. PX_PER_M로는 정확히 한 번만 나눈다.
  const avgLabel = save.recentRuns.length === 0
    ? '–'
    : `${metersOf(
        save.recentRuns.reduce((sum, v) => sum + v, 0) / save.recentRuns.length,
      )}m`

  statGrid.appendChild(statTile(`${save.totalRuns}회`, '기록된 플레이'))
  statGrid.appendChild(statTile(`${save.ownedOutfits.length}벌`, '제작한 옷'))
  statGrid.appendChild(statTile(`${upgradeSum}`, '업그레이드 합계'))
  statGrid.appendChild(statTile(avgLabel, '평균 높이'))

  top.appendChild(statGrid)
  panel.appendChild(top)

  // ── 최근 플레이 막대 차트 ─────────────────────────────────────
  renderChart(panel, save)

  // ── 구간 진행 바 3개 ────────────────────────────────────────
  const zoneGrid = document.createElement('div')
  zoneGrid.className = 'records-zone-grid'

  for (const z of ZONES) {
    const pct = Math.round(zoneProgress(z.id, save.bestHeight) * 100)

    const card = document.createElement('div')
    card.className = 'records-zone-card'
    card.innerHTML = `
      <div class="records-zone-top">
        <span class="type-body-md-bold">${z.label}</span>
        <span class="type-caption records-zone-range">${z.range}</span>
      </div>
      <div class="zone-bar-track">
        <div class="zone-bar-fill zone-bar-fill-${z.id}" style="width: ${pct}%"></div>
      </div>
      <div class="type-caption records-zone-note">${z.note}</div>`
    zoneGrid.appendChild(card)
  }
  panel.appendChild(zoneGrid)

  mount.appendChild(panel)
}
