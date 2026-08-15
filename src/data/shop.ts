import type { SaveData } from '../core/storage'
import type { RunModifiers } from '../game/state'
import { defaultModifiers } from '../game/state'
import * as C from '../constants'

export type UpgradeId = 'jump' | 'energy' | 'air' | 'magnet'
export type ConsumableId = 'rocket' | 'feather' | 'cushion' | 'doubleJump'

export interface Upgrade {
  id: UpgradeId
  name: string
  desc: string
  /** 레벨별 가격. prices[0]은 Lv0→Lv1 비용 */
  prices: readonly number[]
}

export interface Consumable {
  id: ConsumableId
  name: string
  desc: string
  price: number
}

export const UPGRADES: readonly Upgrade[] = [
  { id: 'jump',   name: '점프력 강화', desc: '점프 속도 +20 (레벨당)', prices: [30, 70, 150] },
  { id: 'energy', name: '에너지 확장', desc: '최대 에너지 +1',         prices: [100, 250] },
  { id: 'air',    name: '공중 조향',   desc: '좌우 이동 속도 +20',     prices: [40, 90] },
  { id: 'magnet', name: '자석',        desc: '아이템 흡수 반경 +20',   prices: [60, 140] },
]

export const CONSUMABLES: readonly Consumable[] = [
  { id: 'rocket',     name: '로켓 부츠',  desc: '100m 지점에서 출발',        price: 25 },
  { id: 'feather',    name: '깃털',       desc: '중력이 약해져 오래 뜬다',   price: 15 },
  { id: 'cushion',    name: '방석',       desc: '첫 낙하 1회를 막아준다',    price: 20 },
  { id: 'doubleJump', name: '더블 점프',  desc: '공중에서 한 번 더 점프',    price: 35 },
]

export const CONSUMABLE_IDS: ReadonlySet<string> = new Set(CONSUMABLES.map((c) => c.id))

export function nextUpgradePrice(u: Upgrade, level: number): number | null {
  return u.prices[level] ?? null
}

/**
 * 게임 시작 수정자를 만든다.
 * 업그레이드는 save에서 읽지만, 소모품 효과는 appliedConsumables에서만 읽는다.
 *
 * 두 번째 인자는 readonly ConsumableId[] 로 좁혀져 있다. save.selectedConsumables는
 * string[] 이므로 대입되지 않아, 잘못된 호출이 컴파일 단계에서 걸린다.
 */
export function modifiersFrom(
  save: SaveData, appliedConsumables: readonly ConsumableId[],
): RunModifiers {
  const m = defaultModifiers()

  // 영구 업그레이드
  m.jumpVelocity = C.JUMP_V + save.upgrades.jump * 20
  m.maxEnergy = 3 + save.upgrades.energy
  m.moveSpeed = C.MOVE_SPEED + save.upgrades.air * 20
  m.magnetRadius = save.upgrades.magnet * 20

  // 소모품 — 실제로 차감된 것만 반영한다. save.selectedConsumables를 읽지 않는다.
  const on = new Set(appliedConsumables)
  if (on.has('feather')) m.gravity = 900
  if (on.has('rocket')) m.startHeight = 100 * C.PX_PER_M
  if (on.has('cushion')) m.cushionAvailable = true
  if (on.has('doubleJump')) m.doubleJumpEnabled = true

  return m
}

/**
 * 게임 시작 시 소모품을 원자적으로 처리한다 (스펙 10절 5단계).
 * save를 제자리에서 변경하고, 실제 적용된 id 목록을 돌려준다.
 */
export function consumeSelected(save: SaveData): ConsumableId[] {
  const applied: ConsumableId[] = []

  // 1단계: 재고 ≥ 1인 항목만 추린다
  for (const id of save.selectedConsumables) {
    if (!CONSUMABLE_IDS.has(id)) continue
    const key = id as ConsumableId
    if (save.consumables[key] >= 1) applied.push(key)
  }

  // 2단계: 적용 대상만 차감
  for (const id of applied) {
    save.consumables[id] -= 1
  }

  // 3단계: 재고가 0이 된 항목과 애초에 무효했던 항목을 목록에서 제거
  save.selectedConsumables = save.selectedConsumables.filter((id) => {
    if (!CONSUMABLE_IDS.has(id)) return false
    return save.consumables[id as ConsumableId] >= 1
  })

  // 4단계(저장)는 호출자가 writeSave로 수행한다
  // 5단계(run.* 반영)는 호출자가 modifiersFrom(save, applied)로 수행한다
  return applied
}
