import { describe, it, expect } from 'vitest'
import { createInput } from '../../src/core/input'

describe('createInput', () => {
  it('좌우 키 상태를 추적한다', () => {
    const input = createInput()
    input.handleKeyDown('ArrowLeft')
    expect(input.snapshot().left).toBe(true)
    input.handleKeyUp('ArrowLeft')
    expect(input.snapshot().left).toBe(false)
  })

  it('jumpPressed는 keydown 직후 한 번만 참이다', () => {
    const input = createInput()
    input.handleKeyDown('Space')
    expect(input.snapshot().jumpPressed).toBe(true)
    input.consume()
    expect(input.snapshot().jumpPressed).toBe(false)
  })

  it('키를 누른 채로 있어도 jumpPressed가 다시 참이 되지 않는다', () => {
    const input = createInput()
    input.handleKeyDown('Space')
    input.consume()
    input.handleKeyDown('Space') // 브라우저 키 반복
    expect(input.snapshot().jumpPressed).toBe(false)
  })

  it('뗐다 다시 누르면 jumpPressed가 참이 된다', () => {
    const input = createInput()
    input.handleKeyDown('Space')
    input.consume()
    input.handleKeyUp('Space')
    input.handleKeyDown('Space')
    expect(input.snapshot().jumpPressed).toBe(true)
  })

  it('jumpHeld는 누르고 있는 동안 참이다', () => {
    const input = createInput()
    input.handleKeyDown('ArrowUp')
    input.consume()
    expect(input.snapshot().jumpHeld).toBe(true)
    input.handleKeyUp('ArrowUp')
    expect(input.snapshot().jumpHeld).toBe(false)
  })

  it('reset()은 눌린 키를 전부 뗀 것으로 만든다', () => {
    const input = createInput()
    input.handleKeyDown('ArrowLeft')
    input.handleKeyDown('Space')
    input.reset()
    const s = input.snapshot()
    expect(s.left).toBe(false)
    expect(s.jumpHeld).toBe(false)
    expect(s.jumpPressed).toBe(false)
  })

  it('reset() 후 키가 눌린 채여도 다시 뗐다 눌러야 jumpPressed가 참이 된다', () => {
    // 스펙 8절 규칙 4 (반드시 지킬 것): 모달이 닫힌 뒤 이미 눌려 있던 키는
    // 점프를 발동시키면 안 된다. 브라우저의 키 반복 keydown은 새 누름과
    // 구분되지 않으므로, reset() 시점에 눌려 있었다면 실제 keyup을 볼
    // 때까지 점프를 막아야 한다.
    const input = createInput()
    input.handleKeyDown('Space')
    input.reset()

    // 모달이 닫히고 브라우저가 keydown 반복을 보내는 상황 — 점프하면 안 된다
    input.handleKeyDown('Space')
    expect(input.snapshot().jumpPressed).toBe(false)
    expect(input.snapshot().jumpHeld).toBe(false)

    // 반복이 몇 번을 더 와도 마찬가지다
    input.handleKeyDown('Space')
    expect(input.snapshot().jumpPressed).toBe(false)

    // 실제로 뗐다 다시 누르면 그때 발동한다
    input.handleKeyUp('Space')
    input.handleKeyDown('Space')
    expect(input.snapshot().jumpPressed).toBe(true)
    expect(input.snapshot().jumpHeld).toBe(true)
  })

  it('reset() 시점에 점프키가 눌려 있지 않았으면 다음 누름이 바로 점프한다', () => {
    // 판 시작·탭 복귀에서도 reset()이 불린다. 무조건 막으면 복귀 후 첫 점프를
    // 삼켜버린다 — 막을 것은 "눌린 채로 넘어온 키"뿐이다.
    const input = createInput()
    input.reset()
    input.handleKeyDown('Space')
    expect(input.snapshot().jumpPressed).toBe(true)
  })

  it('막힌 상태에서도 좌우 키는 계속 동작한다', () => {
    const input = createInput()
    input.handleKeyDown('Space')
    input.reset()
    input.handleKeyDown('ArrowRight')
    expect(input.snapshot().right).toBe(true)
  })

  it('attach는 플레이 중일 때만 preventDefault를 부른다', () => {
    const input = createInput()
    const handlers: Record<string, (e: unknown) => void> = {}
    const target = {
      addEventListener: (type: string, fn: (e: unknown) => void) => { handlers[type] = fn },
      removeEventListener: () => {},
    }

    let capturing = false
    input.attach(target, () => capturing)

    let prevented = 0
    const press = (code: string) =>
      handlers['keydown']!({ code, preventDefault: () => { prevented += 1 } })

    press('Space')
    expect(prevented).toBe(0)   // 로비 — DOM 버튼이 Space를 받아야 한다

    capturing = true
    press('ArrowUp')
    expect(prevented).toBe(1)   // 플레이 중 — 스크롤을 막는다

    capturing = false
    press('KeyZ')
    expect(prevented).toBe(1)   // 모르는 키는 어느 쪽이든 건드리지 않는다
  })

  it('Space와 ArrowUp 모두 점프키다', () => {
    const a = createInput()
    a.handleKeyDown('Space')
    expect(a.snapshot().jumpHeld).toBe(true)

    const b = createInput()
    b.handleKeyDown('ArrowUp')
    expect(b.snapshot().jumpHeld).toBe(true)
  })

  it('키보드와 터치는 소스별 상태를 가지며 OR로 합쳐진다', () => {
    // 키보드 ←를 누른 채 마우스/터치로 이동 존을 눌렀다 떼도 ←는 살아 있어야 한다.
    // 마지막 호출이 이기는 단일 불리언이면 데스크탑에서 마우스 클릭 한 번에 키가 풀린다.
    const input = createInput()
    input.handleKeyDown('ArrowLeft')
    input.press('left', 'touch')
    input.release('left', 'touch')
    expect(input.snapshot().left).toBe(true)
    input.handleKeyUp('ArrowLeft')
    expect(input.snapshot().left).toBe(false)
  })

  it('터치 held 중 키보드 up이 와도 터치 쪽은 유지된다', () => {
    const input = createInput()
    input.press('right', 'touch')
    input.handleKeyDown('ArrowRight')
    input.handleKeyUp('ArrowRight')
    expect(input.snapshot().right).toBe(true)
    input.release('right', 'touch')
    expect(input.snapshot().right).toBe(false)
  })

  it('점프 엣지는 합산 held가 false→true일 때만 선다', () => {
    const input = createInput()
    input.handleKeyDown('Space')
    input.consume()
    input.press('jump', 'touch')     // Space 누른 채 점프 존 클릭 — 새 엣지가 아니다
    expect(input.snapshot().jumpPressed).toBe(false)
    expect(input.snapshot().jumpHeld).toBe(true)
    input.handleKeyUp('Space')
    expect(input.snapshot().jumpHeld).toBe(true)   // 터치가 아직 잡고 있다
    input.release('jump', 'touch')
    expect(input.snapshot().jumpHeld).toBe(false)
  })

  it('reset()의 jumpBlocked는 키보드에만 적용된다', () => {
    // 터치는 pointerdown이 반복되지 않으므로 block이 필요 없다 — 터치 컨트롤러가
    // 존 점유(suppressed)로 따로 막는다. 여기서는 input이 터치를 막지 않는지만 본다.
    const input = createInput()
    input.handleKeyDown('Space')
    input.reset()
    input.handleKeyDown('Space')                    // 키 반복 — 막힌다
    expect(input.snapshot().jumpPressed).toBe(false)
    input.press('jump', 'touch')                    // 새 손가락 — 엣지
    expect(input.snapshot().jumpPressed).toBe(true)
    expect(input.snapshot().jumpHeld).toBe(true)
  })

  it('reset()은 두 소스를 모두 뗀 것으로 만든다', () => {
    const input = createInput()
    input.press('left', 'touch')
    input.press('jump', 'touch')
    input.handleKeyDown('ArrowRight')
    input.reset()
    const s = input.snapshot()
    expect(s.left).toBe(false)
    expect(s.right).toBe(false)
    expect(s.jumpHeld).toBe(false)
    expect(s.jumpPressed).toBe(false)
  })
})
