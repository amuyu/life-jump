import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  parseSave, defaultSave, loadSave, writeSave,
  SAVE_KEY, SAVE_VERSION, UPGRADE_MAX, CONSUMABLE_MAX, DEFAULT_OUTFIT_ID,
  type ValidIds,
} from '../../src/core/storage'

const VALID: ValidIds = {
  outfits: new Set([DEFAULT_OUTFIT_ID, 'striped', 'raincoat', 'galaxy']),
  consumables: new Set(['rocket', 'feather', 'cushion', 'doubleJump']),
}

/** 메모리 localStorage 흉내 */
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

describe('parseSave — 1단계 파싱', () => {
  it('null이면 기본값을 돌려준다', () => {
    expect(parseSave(null, VALID)).toEqual(defaultSave())
  })

  it('파싱 불가 문자열이면 기본값을 돌려준다', () => {
    expect(parseSave('{{{ not json', VALID)).toEqual(defaultSave())
  })

  it('배열이나 원시값이어도 크래시하지 않는다', () => {
    expect(parseSave('[]', VALID)).toEqual(defaultSave())
    expect(parseSave('42', VALID)).toEqual(defaultSave())
    expect(parseSave('"hi"', VALID)).toEqual(defaultSave())
    expect(parseSave('null', VALID)).toEqual(defaultSave())
  })
})

describe('parseSave — 3단계 깊은 병합 (진행도 보존)', () => {
  it('필드가 일부 빠져도 전체를 초기화하지 않는다', () => {
    const partial = JSON.stringify({ version: SAVE_VERSION, coins: 500, thread: 120 })
    const out = parseSave(partial, VALID)

    expect(out.coins).toBe(500)
    expect(out.thread).toBe(120)
    expect(out.bestHeight).toBe(0)          // 기본값으로 채워짐
    expect(out.upgrades).toEqual(defaultSave().upgrades)
  })

  it('중첩 객체의 일부 키만 있어도 나머지를 채운다', () => {
    const partial = JSON.stringify({
      version: SAVE_VERSION,
      upgrades: { jump: 2 },
      consumables: { cushion: 3 },
    })
    const out = parseSave(partial, VALID)

    expect(out.upgrades.jump).toBe(2)
    expect(out.upgrades.energy).toBe(0)
    expect(out.consumables.cushion).toBe(3)
    expect(out.consumables.rocket).toBe(0)
  })

  it('보유 옷 목록이 보존된다', () => {
    const partial = JSON.stringify({
      version: SAVE_VERSION,
      ownedOutfits: [DEFAULT_OUTFIT_ID, 'striped', 'galaxy'],
    })
    expect(parseSave(partial, VALID).ownedOutfits).toEqual(
      [DEFAULT_OUTFIT_ID, 'striped', 'galaxy'],
    )
  })
})

describe('parseSave — 4단계 유효성 보정', () => {
  it('음수 재화를 0으로 만든다', () => {
    const raw = JSON.stringify({ version: SAVE_VERSION, coins: -50, thread: -1 })
    const out = parseSave(raw, VALID)
    expect(out.coins).toBe(0)
    expect(out.thread).toBe(0)
  })

  it('NaN·Infinity·문자열 숫자를 0으로 만든다', () => {
    const raw = '{"version":1,"coins":"많음","thread":null,"bestHeight":1e999}'
    const out = parseSave(raw, VALID)
    expect(out.coins).toBe(0)
    expect(out.thread).toBe(0)
    expect(Number.isFinite(out.bestHeight)).toBe(true)
  })

  it('업그레이드 레벨을 최대치로 자른다', () => {
    const raw = JSON.stringify({
      version: SAVE_VERSION,
      upgrades: { jump: 99, energy: -3, air: 1, magnet: 7 },
    })
    const out = parseSave(raw, VALID)
    expect(out.upgrades.jump).toBe(UPGRADE_MAX.jump)
    expect(out.upgrades.energy).toBe(0)
    expect(out.upgrades.air).toBe(1)
    expect(out.upgrades.magnet).toBe(UPGRADE_MAX.magnet)
  })

  it('알 수 없는 옷 ID를 제거한다', () => {
    const raw = JSON.stringify({
      version: SAVE_VERSION,
      ownedOutfits: [DEFAULT_OUTFIT_ID, 'striped', 'hack_outfit'],
    })
    expect(parseSave(raw, VALID).ownedOutfits).toEqual([DEFAULT_OUTFIT_ID, 'striped'])
  })

  it('기본 옷은 항상 보유 목록에 있다', () => {
    const raw = JSON.stringify({ version: SAVE_VERSION, ownedOutfits: [] })
    expect(parseSave(raw, VALID).ownedOutfits).toContain(DEFAULT_OUTFIT_ID)
  })

  it('보유하지 않은 옷을 착용 중이면 기본 옷으로 되돌린다', () => {
    const raw = JSON.stringify({
      version: SAVE_VERSION,
      ownedOutfits: [DEFAULT_OUTFIT_ID],
      equippedOutfit: 'galaxy',
    })
    expect(parseSave(raw, VALID).equippedOutfit).toBe(DEFAULT_OUTFIT_ID)
  })

  it('알 수 없는 소모품 ID를 장착 목록에서 제거한다', () => {
    const raw = JSON.stringify({
      version: SAVE_VERSION,
      selectedConsumables: ['cushion', 'nonsense'],
    })
    expect(parseSave(raw, VALID).selectedConsumables).toEqual(['cushion'])
  })

  it('중복된 장착 항목을 제거한다', () => {
    const raw = JSON.stringify({
      version: SAVE_VERSION,
      selectedConsumables: ['cushion', 'cushion', 'rocket'],
    })
    expect(parseSave(raw, VALID).selectedConsumables).toEqual(['cushion', 'rocket'])
  })

  it('소모품 재고를 정수로 만들고 음수를 0으로 만든다', () => {
    const raw = JSON.stringify({
      version: SAVE_VERSION,
      consumables: { rocket: 2.7, feather: -5, cushion: 1, doubleJump: 0 },
    })
    const out = parseSave(raw, VALID)
    expect(out.consumables.rocket).toBe(2)
    expect(out.consumables.feather).toBe(0)
  })

  it('소모품 재고를 CONSUMABLE_MAX로 자른다', () => {
    // 구매 쪽(main.ts)도 같은 상수로 막는다 — 어긋나면 상한 위로 산 만큼이
    // 다음 로드에서 조용히 사라진다.
    const raw = JSON.stringify({
      version: SAVE_VERSION,
      consumables: { rocket: 500, feather: 0, cushion: 0, doubleJump: 0 },
    })
    expect(parseSave(raw, VALID).consumables.rocket).toBe(CONSUMABLE_MAX)
  })

  it('seenQuizIds가 배열이 아니면 빈 배열로 만든다', () => {
    const raw = JSON.stringify({ version: SAVE_VERSION, seenQuizIds: 'oops' })
    expect(parseSave(raw, VALID).seenQuizIds).toEqual([])
  })
})

describe('loadSave — 5단계 재저장', () => {
  it('보정된 결과를 즉시 다시 저장한다', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, coins: -10 }))
    loadSave(VALID)

    const rewritten = JSON.parse(localStorage.getItem(SAVE_KEY) as string)
    expect(rewritten.coins).toBe(0)
    expect(rewritten.upgrades).toBeDefined()
  })

  it('저장이 없으면 기본값을 쓰고 저장한다', () => {
    const out = loadSave(VALID)
    expect(out).toEqual(defaultSave())
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull()
  })

  it('write → load 왕복이 값을 보존한다', () => {
    const data = defaultSave()
    data.coins = 777
    data.thread = 88
    data.bestHeight = 12345
    data.ownedOutfits = [DEFAULT_OUTFIT_ID, 'raincoat']
    data.equippedOutfit = 'raincoat'
    writeSave(data)

    expect(loadSave(VALID)).toEqual(data)
  })

  it('localStorage 쓰기가 실패해도 예외를 던지지 않는다', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError') },
      removeItem: () => {},
      clear: () => {},
    })
    expect(() => writeSave(defaultSave())).not.toThrow()
    expect(() => loadSave(VALID)).not.toThrow()
  })
})
