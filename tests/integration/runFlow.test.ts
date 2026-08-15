import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defaultSave, writeSave, loadSave, RECENT_RUNS_MAX, type ValidIds } from '../../src/core/storage'
import { CONSUMABLE_IDS } from '../../src/data/shop'
import { OUTFIT_IDS } from '../../src/data/outfits'
import { createGameState, type RunState } from '../../src/game/state'
import { startRun, finishRun } from '../../src/runFlow'
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

/**
 * main.ts의 startRun()과 같은 절차를 재현한다 — 다만 실제 판 시작 로직
 * (consumeSelected → modifiersFrom)은 src/runFlow.ts의 startRun을 그대로
 * 호출한다. 이 파일 안에서 재선언하지 않는다.
 */
function runStart(save: ReturnType<typeof defaultSave>) {
  const { mods } = startRun(save)               // 1~2. 차감 + 적용분만 반영 (실제 코드)
  writeSave(save)                                // 3. 함께 저장
  return createGameState(mods)                   // 4. 상태 생성
}

describe('판 시작 절차', () => {
  it('장착 효과가 적용되고 재고가 1개만 차감된다', () => {
    const save = defaultSave()
    save.consumables.cushion = 2
    save.selectedConsumables = ['cushion']

    const state = runStart(save)

    expect(state.run.cushionAvailable).toBe(true)
    expect(save.consumables.cushion).toBe(1)
  })

  it('재고 0인 항목이 장착 목록에 남아 있어도 효과를 받지 못한다 (무료 적용 차단)', () => {
    const save = defaultSave()
    save.consumables.feather = 0
    save.consumables.rocket = 0
    save.selectedConsumables = ['feather', 'rocket']   // 손상된 저장

    const state = runStart(save)

    expect(state.run.gravity).toBe(C.GRAVITY)          // 깃털 효과 없음
    expect(state.run.maxHeight).toBe(0)                // 로켓 부츠 효과 없음
  })

  it('재고 있는 항목만 골라 효과를 준다', () => {
    const save = defaultSave()
    save.consumables.feather = 1
    save.consumables.rocket = 0
    save.selectedConsumables = ['feather', 'rocket']

    const state = runStart(save)

    expect(state.run.gravity).toBe(900)                // 깃털은 적용
    expect(state.run.maxHeight).toBe(0)                // 로켓 부츠는 미적용
  })

  it('시작 직후 새로고침해도 재고가 복원되지 않는다', () => {
    const save = defaultSave()
    save.consumables.rocket = 1
    save.selectedConsumables = ['rocket']

    runStart(save)
    const reloaded = loadSave(VALID)

    expect(reloaded.consumables.rocket).toBe(0)
    expect(reloaded.selectedConsumables).toEqual([])
  })

  it('로켓 부츠를 쓰면 100m에서 시작하고 점수에 포함된다', () => {
    const save = defaultSave()
    save.consumables.rocket = 1
    save.selectedConsumables = ['rocket']

    const state = runStart(save)

    expect(state.run.maxHeight).toBe(100 * C.PX_PER_M)
  })

  it('업그레이드가 시작 상태에 반영된다', () => {
    const save = defaultSave()
    save.upgrades.jump = 3
    save.upgrades.energy = 2

    const state = runStart(save)

    expect(state.run.jumpVelocity).toBe(540)
    expect(state.run.maxEnergy).toBe(5)
    expect(state.run.energy).toBe(5)
  })

  it('재고 0인데 장착된 손상 저장으로 시작해도 음수가 되지 않는다', () => {
    const save = defaultSave()
    save.consumables.feather = 0
    save.selectedConsumables = ['feather']

    runStart(save)

    expect(save.consumables.feather).toBe(0)
    expect(save.selectedConsumables).toEqual([])
  })
})

/** 결산에 필요한 필드만 채운 완전한 RunState를 만든다 (형변환 없이) */
function makeRun(fields: { maxHeight: number; thread: number; coins: number }): RunState {
  return {
    time: 0,
    maxHeight: fields.maxHeight,
    energy: 3,
    maxEnergy: 3,
    invulnerableUntil: 0,
    cushionAvailable: false,
    doubleJumpEnabled: false,
    gravity: C.GRAVITY,
    jumpVelocity: C.JUMP_V,
    moveSpeed: C.MOVE_SPEED,
    magnetRadius: 0,
    thread: fields.thread,
    coins: fields.coins,
    over: true,
  }
}

/**
 * main.ts의 finishRun()과 같은 결산을 재현한다 — 실제 결산 로직은
 * src/runFlow.ts의 finishRun을 그대로 호출한다.
 */
function runFinish(save: ReturnType<typeof defaultSave>, fields: { maxHeight: number; thread: number; coins: number }) {
  finishRun(save, makeRun(fields))
  writeSave(save)
}

describe('판 종료 결산', () => {
  it('획득한 재화가 누적된다', () => {
    const save = defaultSave()
    save.thread = 10
    save.coins = 20

    runFinish(save, { maxHeight: 500, thread: 7, coins: 13 })

    expect(save.thread).toBe(17)
    expect(save.coins).toBe(33)
  })

  it('최고기록을 갱신한다', () => {
    const save = defaultSave()
    runFinish(save, { maxHeight: 5000, thread: 0, coins: 0 })
    expect(save.bestHeight).toBe(5000)
  })

  it('기록이 낮으면 갱신하지 않는다', () => {
    const save = defaultSave()
    save.bestHeight = 9000
    runFinish(save, { maxHeight: 3000, thread: 0, coins: 0 })
    expect(save.bestHeight).toBe(9000)
  })

  it('결산 결과가 저장에 남는다', () => {
    const save = defaultSave()
    runFinish(save, { maxHeight: 4200, thread: 5, coins: 9 })

    const reloaded = loadSave(VALID)
    expect(reloaded.bestHeight).toBe(4200)
    expect(reloaded.thread).toBe(5)
    expect(reloaded.coins).toBe(9)
    expect(reloaded.totalRuns).toBe(1)
  })

  it('여러 판을 이어 해도 재화가 계속 쌓인다', () => {
    let save = defaultSave()
    for (let i = 0; i < 5; i++) {
      runFinish(save, { maxHeight: 1000 * i, thread: 4, coins: 6 })
      save = loadSave(VALID)
    }
    expect(save.thread).toBe(20)
    expect(save.coins).toBe(30)
    expect(save.totalRuns).toBe(5)
  })

  it('판을 마치면 recentRuns에 이번 판 높이가 px로 추가된다', () => {
    const save = defaultSave()
    runFinish(save, { maxHeight: 4200, thread: 0, coins: 0 })
    expect(save.recentRuns).toEqual([4200])

    const reloaded = loadSave(VALID)
    expect(reloaded.recentRuns).toEqual([4200])
  })

  it('recentRuns는 RECENT_RUNS_MAX를 넘지 않는다', () => {
    let save = defaultSave()
    for (let i = 0; i < RECENT_RUNS_MAX + 5; i++) {
      runFinish(save, { maxHeight: 100 * (i + 1), thread: 0, coins: 0 })
      save = loadSave(VALID)
    }
    expect(save.recentRuns).toHaveLength(RECENT_RUNS_MAX)
    // 가장 오래된 값이 앞, 최신 값이 뒤 — 마지막 판(가장 큰 높이)이 배열 끝에 있다
    expect(save.recentRuns[save.recentRuns.length - 1]).toBe(100 * (RECENT_RUNS_MAX + 5))
  })
})
