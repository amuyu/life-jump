import { describe, it, expect } from 'vitest'
import { promoMessage } from '../../src/ui/shell'
import { defaultSave } from '../../src/core/storage'
import type { SaveData } from '../../src/core/storage'

// OUTFITS 비용 순서 (src/data/outfits.ts): basic-tee(0) < striped(5) <
// raincoat(12) < overalls(22) < floral(35) < hoodie(50) < wizard(70) <
// knight(95) < spacesuit(125) < galaxy(160). basic-tee는 항상 기본 보유.
const ALL_IDS = [
  'basic-tee', 'striped', 'raincoat', 'overalls', 'floral',
  'hoodie', 'wizard', 'knight', 'spacesuit', 'galaxy',
]

function makeSave(overrides: Partial<SaveData>): SaveData {
  return { ...defaultSave(), ...overrides }
}

describe('promoMessage', () => {
  it('실이 부족하면 부족분을 "더 모으면"으로 명시한다 (총 비용이 아니다)', () => {
    // 리뷰에서 지적된 버그 재현 케이스: thread 3, 줄무늬 셔츠(비용 5) 목표.
    // "실 2개면 만들 수 있어요"는 "2개만 있으면 충분하다"는 거짓 문장이 된다 —
    // 부족분(2)임을 "더 모으면"으로 밝혀야 참이 된다.
    const save = makeSave({ thread: 3, ownedOutfits: ['basic-tee'] })
    expect(promoMessage(save)).toBe('실 2개만 더 모으면 줄무늬 셔츠를 만들 수 있어요.')
  })

  it('프레시 세이브(실 0)에서도 같은 형태의 문구를 낸다', () => {
    const save = makeSave({ thread: 0, ownedOutfits: ['basic-tee'] })
    expect(promoMessage(save)).toBe('실 5개만 더 모으면 줄무늬 셔츠를 만들 수 있어요.')
  })

  it('실이 비용과 정확히 같으면(경계값) "지금 바로" 만들 수 있다고 안내한다', () => {
    const save = makeSave({ thread: 5, ownedOutfits: ['basic-tee'] })
    expect(promoMessage(save)).toBe('지금 바로 줄무늬 셔츠를 만들 수 있어요.')
  })

  it('실이 비용보다 많으면, 이미 보유한 싼 옷들을 건너뛰고 다음으로 싼 미보유 옷을 고른다', () => {
    // 이 테스트가 실제로 고정하는 것: basic-tee/striped/raincoat/overalls를 이미
    // 보유한 상태에서 다음 목표가 floral(35)로 넘어간다는 "건너뛰기" 동작이다.
    //
    // 주의 — 이 테스트만으로는 선택 로직이 "미보유 중 최소 비용"을 고르는지,
    // 단순히 "배열의 첫 미보유 항목"을 고르는지 구별하지 못한다: OUTFITS가
    // threadCost 오름차순으로 정렬되어 있어(tests/data/outfits.test.ts가 이를
    // 고정한다) 이 데이터에서는 두 전략이 항상 같은 답을 낸다. 최소값 선택
    // 로직(src/ui/shell.ts의 min-reduce)은 스스로 방어적으로 짠 것이고, 그 정렬
    // 의존 여부를 이 테스트가 증명하지는 않는다.
    const save = makeSave({
      thread: 40,
      ownedOutfits: ['basic-tee', 'striped', 'raincoat', 'overalls'],
    })
    expect(promoMessage(save)).toBe('지금 바로 꽃무늬 원피스를 만들 수 있어요.')
  })

  it('받침 없는 이름(후드티)에는 "를"을 붙인다 — 지금 바로 상태', () => {
    const save = makeSave({
      thread: 50,
      ownedOutfits: ['basic-tee', 'striped', 'raincoat', 'overalls', 'floral'],
    })
    expect(promoMessage(save)).toBe('지금 바로 후드티를 만들 수 있어요.')
  })

  it('받침 있는 이름(기사 갑옷)에는 "을"을 붙인다 — 부족분 상태', () => {
    const save = makeSave({
      thread: 50,
      ownedOutfits: ['basic-tee', 'striped', 'raincoat', 'overalls', 'floral', 'hoodie', 'wizard'],
    })
    // knight(기사 갑옷) 비용 95, 부족분 45
    expect(promoMessage(save)).toBe('실 45개만 더 모으면 기사 갑옷을 만들 수 있어요.')
  })

  it('받침 있는 이름(우주복)에는 "을"을 붙인다 — 지금 바로 상태', () => {
    const save = makeSave({
      thread: 200,
      ownedOutfits: [
        'basic-tee', 'striped', 'raincoat', 'overalls', 'floral',
        'hoodie', 'wizard', 'knight',
      ],
    })
    expect(promoMessage(save)).toBe('지금 바로 우주복을 만들 수 있어요.')
  })

  it('모든 옷을 보유하면 배너를 감춘다 (null)', () => {
    const save = makeSave({ thread: 999, ownedOutfits: [...ALL_IDS] })
    expect(promoMessage(save)).toBeNull()
  })
})
