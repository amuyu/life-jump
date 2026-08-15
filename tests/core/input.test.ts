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
    const input = createInput()
    input.handleKeyDown('Space')
    input.reset()
    // 모달이 닫히고 브라우저가 keydown 반복을 보내는 상황
    input.handleKeyDown('Space')
    expect(input.snapshot().jumpPressed).toBe(true)
  })

  it('Space와 ArrowUp 모두 점프키다', () => {
    const a = createInput()
    a.handleKeyDown('Space')
    expect(a.snapshot().jumpHeld).toBe(true)

    const b = createInput()
    b.handleKeyDown('ArrowUp')
    expect(b.snapshot().jumpHeld).toBe(true)
  })
})
