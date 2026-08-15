import { describe, it, expect } from 'vitest'
import { spriteCanvas } from '../../src/ui/spritePreview'
import { ITEM_MAPS, ITEM_PALETTES } from '../../src/data/pixelmaps'

// spriteCanvas의 정수-배율 가드(spritePreview.ts:45-47)는 document에 손대기
// 전에 던진다 — bakeSprite(캔버스를 실제로 만드는 곳)를 호출하기 전이다.
// 이 파일의 import 체인 어디에도 최상위 DOM 접근이 없으므로,
// environment: 'node'(이 프로젝트의 전역 vitest 설정)에서도 그대로 검증할 수 있다.
describe('spriteCanvas — 정수 배율 가드', () => {
  it('정수가 아닌 배율은 던진다', () => {
    expect(() => spriteCanvas(ITEM_MAPS.thread, ITEM_PALETTES.thread, 1.5)).toThrow()
  })

  it('0 이하인 배율은 던진다', () => {
    expect(() => spriteCanvas(ITEM_MAPS.thread, ITEM_PALETTES.thread, 0)).toThrow()
    expect(() => spriteCanvas(ITEM_MAPS.thread, ITEM_PALETTES.thread, -2)).toThrow()
  })

  it('정수 배율은 가드의 throw까지 가지 않는다', () => {
    // environment: 'node'라 document가 없어서 가드를 통과한 뒤 bakeSprite의
    // document.createElement에서 어차피 던진다 — 그래서 "안 던진다"가 아니라
    // "가드의 그 에러는 아니다"로 검증한다. toThrow(pattern)을 부정하면
    // (에러 없음) 또는 (다른 에러) 둘 다 통과하므로 이 목적에 정확히 맞는다.
    expect(() => spriteCanvas(ITEM_MAPS.thread, ITEM_PALETTES.thread, 2))
      .not.toThrow(/배율은 양의 정수만 허용된다/)
  })
})
