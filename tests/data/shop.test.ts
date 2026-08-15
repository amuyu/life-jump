import { describe, it, expect } from 'vitest'
import {
  UPGRADES, CONSUMABLES, CONSUMABLE_IDS,
  nextUpgradePrice, modifiersFrom, consumeSelected,
} from '../../src/data/shop'
import { defaultSave, UPGRADE_MAX } from '../../src/core/storage'
import * as C from '../../src/constants'

describe('상점 정의', () => {
  it('업그레이드 4종, 소모품 4종이다', () => {
    expect(UPGRADES.length).toBe(4)
    expect(CONSUMABLES.length).toBe(4)
  })

  it('업그레이드 가격 단계 수가 UPGRADE_MAX와 일치한다', () => {
    for (const u of UPGRADES) {
      expect(u.prices.length, u.id).toBe(UPGRADE_MAX[u.id])
    }
  })

  it('업그레이드 가격이 레벨마다 오른다', () => {
    for (const u of UPGRADES) {
      for (let i = 1; i < u.prices.length; i++) {
        expect(u.prices[i]!, u.id).toBeGreaterThan(u.prices[i - 1]!)
      }
    }
  })

  it('가격대가 15~250에 분포한다 (스펙 10절)', () => {
    const all = [...CONSUMABLES.map((c) => c.price), ...UPGRADES.flatMap((u) => [...u.prices])]
    expect(Math.min(...all)).toBe(15)
    expect(Math.max(...all)).toBe(250)
  })

  it('CONSUMABLE_IDS가 모든 소모품 id를 담는다', () => {
    expect(CONSUMABLE_IDS.size).toBe(4)
    for (const c of CONSUMABLES) expect(CONSUMABLE_IDS.has(c.id)).toBe(true)
  })

  it('설명이 비어 있지 않다', () => {
    for (const x of [...UPGRADES, ...CONSUMABLES]) {
      expect(x.desc.length, x.id).toBeGreaterThan(0)
    }
  })
})

describe('nextUpgradePrice', () => {
  it('레벨 0이면 첫 가격', () => {
    const jump = UPGRADES.find((u) => u.id === 'jump')!
    expect(nextUpgradePrice(jump, 0)).toBe(30)
  })

  it('만렙이면 null', () => {
    const jump = UPGRADES.find((u) => u.id === 'jump')!
    expect(nextUpgradePrice(jump, UPGRADE_MAX.jump)).toBeNull()
  })
})

describe('modifiersFrom — 영구 업그레이드', () => {
  it('업그레이드가 없으면 기본값이다', () => {
    const m = modifiersFrom(defaultSave(), [])
    expect(m.jumpVelocity).toBe(C.JUMP_V)
    expect(m.maxEnergy).toBe(3)
    expect(m.moveSpeed).toBe(C.MOVE_SPEED)
    expect(m.magnetRadius).toBe(0)
    expect(m.gravity).toBe(C.GRAVITY)
    expect(m.startHeight).toBe(0)
  })

  it('점프력 만렙이면 540이다', () => {
    const save = defaultSave()
    save.upgrades.jump = 3
    expect(modifiersFrom(save, []).jumpVelocity).toBe(540)
  })

  it('에너지 만렙이면 5칸이다', () => {
    const save = defaultSave()
    save.upgrades.energy = 2
    expect(modifiersFrom(save, []).maxEnergy).toBe(5)
  })

  it('공중 조향 만렙이면 130이다', () => {
    const save = defaultSave()
    save.upgrades.air = 2
    expect(modifiersFrom(save, []).moveSpeed).toBe(130)
  })

  it('자석 만렙이면 반경 40이다', () => {
    const save = defaultSave()
    save.upgrades.magnet = 2
    expect(modifiersFrom(save, []).magnetRadius).toBe(40)
  })
})

describe('modifiersFrom — 적용된 소모품', () => {
  it('깃털은 중력을 900으로 낮춘다', () => {
    expect(modifiersFrom(defaultSave(), ['feather']).gravity).toBe(900)
  })

  it('로켓 부츠는 시작 높이를 1000px(100m)로 만든다', () => {
    expect(modifiersFrom(defaultSave(), ['rocket']).startHeight).toBe(100 * C.PX_PER_M)
  })

  it('방석과 더블 점프가 플래그로 반영된다', () => {
    const m = modifiersFrom(defaultSave(), ['cushion', 'doubleJump'])
    expect(m.cushionAvailable).toBe(true)
    expect(m.doubleJumpEnabled).toBe(true)
  })

  it('save.selectedConsumables를 직접 넘길 수 없다 (컴파일 타임 가드)', () => {
    const save = defaultSave()
    // @ts-expect-error string[] 는 readonly ConsumableId[] 에 대입할 수 없다.
    // 누군가 파라미터를 string[] 으로 되돌리면 이 지시자가 "불필요한 에러 억제"가 되어
    // tsc --noEmit 이 실패한다 — 계약이 깨진 것을 컴파일 단계에서 알 수 있다.
    modifiersFrom(save, save.selectedConsumables)
  })

  it('save.selectedConsumables를 읽지 않는다 (무료 적용 차단)', () => {
    const save = defaultSave()
    save.selectedConsumables = ['feather', 'rocket', 'cushion', 'doubleJump']
    save.consumables.feather = 0    // 재고 없음

    const m = modifiersFrom(save, [])   // 적용된 것이 없다

    expect(m.gravity).toBe(C.GRAVITY)
    expect(m.startHeight).toBe(0)
    expect(m.cushionAvailable).toBe(false)
    expect(m.doubleJumpEnabled).toBe(false)
  })
})

describe('consumeSelected — 5단계 (스펙 10절)', () => {
  it('재고가 정확히 1개만 차감된다', () => {
    const save = defaultSave()
    save.consumables.cushion = 3
    save.selectedConsumables = ['cushion']

    consumeSelected(save)

    expect(save.consumables.cushion).toBe(2)
  })

  it('적용된 id 목록을 돌려준다', () => {
    const save = defaultSave()
    save.consumables.cushion = 1
    save.consumables.feather = 1
    save.selectedConsumables = ['cushion', 'feather']

    expect(consumeSelected(save).sort()).toEqual(['cushion', 'feather'])
  })

  it('마지막 하나를 쓰면 장착 목록에서 제거된다', () => {
    const save = defaultSave()
    save.consumables.cushion = 1
    save.selectedConsumables = ['cushion']

    consumeSelected(save)

    expect(save.consumables.cushion).toBe(0)
    expect(save.selectedConsumables).toEqual([])
  })

  it('재고가 남으면 장착 목록에 유지된다', () => {
    const save = defaultSave()
    save.consumables.cushion = 2
    save.selectedConsumables = ['cushion']

    consumeSelected(save)

    expect(save.selectedConsumables).toEqual(['cushion'])
  })

  it('재고 0인데 장착된 손상 데이터를 조용히 무시하고 목록에서 뺀다', () => {
    const save = defaultSave()
    save.consumables.rocket = 0
    save.selectedConsumables = ['rocket']

    const applied = consumeSelected(save)

    expect(applied).toEqual([])
    expect(save.consumables.rocket).toBe(0)     // 음수가 되지 않는다
    expect(save.selectedConsumables).toEqual([])
  })

  it('재고 있는 항목과 없는 항목이 섞여도 있는 것만 적용한다', () => {
    const save = defaultSave()
    save.consumables.cushion = 1
    save.consumables.rocket = 0
    save.selectedConsumables = ['cushion', 'rocket']

    expect(consumeSelected(save)).toEqual(['cushion'])
    expect(save.selectedConsumables).toEqual([])
  })

  it('두 번 호출해도 재고가 음수가 되지 않는다', () => {
    const save = defaultSave()
    save.consumables.feather = 1
    save.selectedConsumables = ['feather']

    consumeSelected(save)
    consumeSelected(save)

    expect(save.consumables.feather).toBe(0)
  })

  it('장착이 없으면 아무것도 하지 않는다', () => {
    const save = defaultSave()
    save.consumables.cushion = 5
    expect(consumeSelected(save)).toEqual([])
    expect(save.consumables.cushion).toBe(5)
  })
})
