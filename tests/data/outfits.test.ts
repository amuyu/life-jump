import { describe, it, expect } from 'vitest'
import { OUTFITS, OUTFIT_IDS, outfitById, canCraft } from '../../src/data/outfits'
import { DEFAULT_OUTFIT_ID } from '../../src/core/storage'
import { PLAYER_IDLE, PLAYER_JUMP } from '../../src/data/pixelmaps'

describe('OUTFITS', () => {
  it('정확히 10벌이다', () => {
    expect(OUTFITS.length).toBe(10)
  })

  it('id가 유일하다', () => {
    expect(new Set(OUTFITS.map((o) => o.id)).size).toBe(10)
  })

  it('첫 옷은 기본 옷이며 무료다', () => {
    expect(OUTFITS[0]!.id).toBe(DEFAULT_OUTFIT_ID)
    expect(OUTFITS[0]!.threadCost).toBe(0)
  })

  it('실 비용이 오름차순이다', () => {
    for (let i = 1; i < OUTFITS.length; i++) {
      expect(OUTFITS[i]!.threadCost).toBeGreaterThan(OUTFITS[i - 1]!.threadCost)
    }
  })

  it('최고가가 160실이다 (스펙 9절)', () => {
    expect(OUTFITS[OUTFITS.length - 1]!.threadCost).toBe(160)
  })

  it('모든 옷의 팔레트가 c 문자를 정의한다', () => {
    for (const o of OUTFITS) {
      expect(o.palette['c'], o.id).toBeDefined()
    }
  })

  it('이름이 비어 있지 않다', () => {
    for (const o of OUTFITS) {
      expect(o.name.length, o.id).toBeGreaterThan(0)
    }
  })

  it('OUTFIT_IDS가 모든 id를 담는다', () => {
    expect(OUTFIT_IDS.size).toBe(10)
    for (const o of OUTFITS) expect(OUTFIT_IDS.has(o.id)).toBe(true)
  })
})

describe('장식 레이어', () => {
  it('오버레이 맵의 크기가 캐릭터와 같다', () => {
    for (const o of OUTFITS) {
      if (o.overlay === null) continue
      expect(o.overlay.map.length, o.id).toBe(PLAYER_IDLE.length)
      for (const row of o.overlay.map) {
        expect(row.length, o.id).toBe(PLAYER_IDLE[0]!.length)
      }
    }
  })

  it('오버레이에 쓰인 문자가 전부 팔레트에 있다', () => {
    for (const o of OUTFITS) {
      if (o.overlay === null) continue
      for (const ch of new Set(o.overlay.map.join(''))) {
        if (ch === '.') continue
        expect(o.overlay.palette[ch], `${o.id} 문자 '${ch}'`).toBeDefined()
      }
    }
  })

  it('점프 스프라이트도 같은 크기다 (오버레이 재사용 가능)', () => {
    expect(PLAYER_JUMP.length).toBe(PLAYER_IDLE.length)
    expect(PLAYER_JUMP[0]!.length).toBe(PLAYER_IDLE[0]!.length)
  })
})

describe('outfitById', () => {
  it('id로 찾는다', () => {
    expect(outfitById(DEFAULT_OUTFIT_ID).id).toBe(DEFAULT_OUTFIT_ID)
  })

  it('없는 id면 기본 옷을 돌려준다 (크래시 대신 복구)', () => {
    expect(outfitById('없는옷').id).toBe(DEFAULT_OUTFIT_ID)
  })
})

describe('canCraft', () => {
  const paid = OUTFITS[1]!

  it('실이 충분하고 미보유면 제작 가능', () => {
    expect(canCraft(paid, paid.threadCost, [DEFAULT_OUTFIT_ID])).toBe(true)
  })

  it('실이 모자라면 불가', () => {
    expect(canCraft(paid, paid.threadCost - 1, [DEFAULT_OUTFIT_ID])).toBe(false)
  })

  it('이미 보유했으면 불가', () => {
    expect(canCraft(paid, 9999, [DEFAULT_OUTFIT_ID, paid.id])).toBe(false)
  })
})
