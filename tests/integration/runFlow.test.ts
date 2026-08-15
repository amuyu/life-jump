import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defaultSave, writeSave, loadSave, SAVE_KEY, type ValidIds } from '../../src/core/storage'
import { modifiersFrom, consumeSelected, CONSUMABLE_IDS } from '../../src/data/shop'
import { OUTFIT_IDS } from '../../src/data/outfits'
import { createGameState } from '../../src/game/state'
import * as C from '../../src/constants'

const VALID: ValidIds = { outfits: OUTFIT_IDS, consumables: CONSUMABLE_IDS }

function mockStorage(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

beforeEach(() => { mockStorage() })

/** main.ts의 startRun()과 같은 절차 */
function startRun(save: ReturnType<typeof defaultSave>) {
  const applied = consumeSelected(save)        // 1. 차감하고 적용분을 받는다
  const mods = modifiersFrom(save, applied)    // 2. 적용분만 효과에 반영
  writeSave(save)                              // 3. 함께 저장
  return createGameState(mods)                 // 4. 상태 생성
}

describe('판 시작 절차', () => {
  it('장착 효과가 적용되고 재고가 1개만 차감된다', () => {
    const save = defaultSave()
    save.consumables.cushion = 2
    save.selectedConsumables = ['cushion']

    const state = startRun(save)

    expect(state.run.cushionAvailable).toBe(true)
    expect(save.consumables.cushion).toBe(1)
  })

  it('재고 0인 항목이 장착 목록에 남아 있어도 효과를 받지 못한다 (무료 적용 차단)', () => {
    const save = defaultSave()
    save.consumables.feather = 0
    save.consumables.rocket = 0
    save.selectedConsumables = ['feather', 'rocket']   // 손상된 저장

    const state = startRun(save)

    expect(state.run.gravity).toBe(C.GRAVITY)          // 깃털 효과 없음
    expect(state.run.maxHeight).toBe(0)                // 로켓 부츠 효과 없음
  })

  it('재고 있는 항목만 골라 효과를 준다', () => {
    const save = defaultSave()
    save.consumables.feather = 1
    save.consumables.rocket = 0
    save.selectedConsumables = ['feather', 'rocket']

    const state = startRun(save)

    expect(state.run.gravity).toBe(900)                // 깃털은 적용
    expect(state.run.maxHeight).toBe(0)                // 로켓 부츠는 미적용
  })

  it('시작 직후 새로고침해도 재고가 복원되지 않는다', () => {
    const save = defaultSave()
    save.consumables.rocket = 1
    save.selectedConsumables = ['rocket']

    startRun(save)
    const reloaded = loadSave(VALID)

    expect(reloaded.consumables.rocket).toBe(0)
    expect(reloaded.selectedConsumables).toEqual([])
  })

  it('로켓 부츠를 쓰면 100m에서 시작하고 점수에 포함된다', () => {
    const save = defaultSave()
    save.consumables.rocket = 1
    save.selectedConsumables = ['rocket']

    const state = startRun(save)

    expect(state.run.maxHeight).toBe(100 * C.PX_PER_M)
  })

  it('업그레이드가 시작 상태에 반영된다', () => {
    const save = defaultSave()
    save.upgrades.jump = 3
    save.upgrades.energy = 2

    const state = startRun(save)

    expect(state.run.jumpVelocity).toBe(540)
    expect(state.run.maxEnergy).toBe(5)
    expect(state.run.energy).toBe(5)
  })

  it('재고 0인데 장착된 손상 저장으로 시작해도 음수가 되지 않는다', () => {
    const save = defaultSave()
    save.consumables.feather = 0
    save.selectedConsumables = ['feather']

    startRun(save)

    expect(save.consumables.feather).toBe(0)
    expect(save.selectedConsumables).toEqual([])
  })
})

/** main.ts의 finishRun()과 같은 결산 */
function finishRun(save: ReturnType<typeof defaultSave>, run: { maxHeight: number; thread: number; coins: number }) {
  save.thread += run.thread
  save.coins += run.coins
  save.totalRuns += 1
  if (run.maxHeight > save.bestHeight) save.bestHeight = run.maxHeight
  writeSave(save)
}

describe('판 종료 결산', () => {
  it('획득한 재화가 누적된다', () => {
    const save = defaultSave()
    save.thread = 10
    save.coins = 20

    finishRun(save, { maxHeight: 500, thread: 7, coins: 13 })

    expect(save.thread).toBe(17)
    expect(save.coins).toBe(33)
  })

  it('최고기록을 갱신한다', () => {
    const save = defaultSave()
    finishRun(save, { maxHeight: 5000, thread: 0, coins: 0 })
    expect(save.bestHeight).toBe(5000)
  })

  it('기록이 낮으면 갱신하지 않는다', () => {
    const save = defaultSave()
    save.bestHeight = 9000
    finishRun(save, { maxHeight: 3000, thread: 0, coins: 0 })
    expect(save.bestHeight).toBe(9000)
  })

  it('결산 결과가 저장에 남는다', () => {
    const save = defaultSave()
    finishRun(save, { maxHeight: 4200, thread: 5, coins: 9 })

    const reloaded = loadSave(VALID)
    expect(reloaded.bestHeight).toBe(4200)
    expect(reloaded.thread).toBe(5)
    expect(reloaded.coins).toBe(9)
    expect(reloaded.totalRuns).toBe(1)
  })

  it('여러 판을 이어 해도 재화가 계속 쌓인다', () => {
    let save = defaultSave()
    for (let i = 0; i < 5; i++) {
      finishRun(save, { maxHeight: 1000 * i, thread: 4, coins: 6 })
      save = loadSave(VALID)
    }
    expect(save.thread).toBe(20)
    expect(save.coins).toBe(30)
    expect(save.totalRuns).toBe(5)
  })
})
