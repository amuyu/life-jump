import { describe, it, expect, vi } from 'vitest'
import { createHintController, HINT_SHOW_MS, HINT_FADE_MS, type HintPhase } from '../../src/ui/touchHint'

/** 수동으로 진행시키는 타이머 */
function fakeTimers() {
  let now = 0
  let seq = 0
  const pending = new Map<number, { at: number; fn: () => void }>()
  return {
    timers: {
      setTimeout: (fn: () => void, ms: number) => { const id = ++seq; pending.set(id, { at: now + ms, fn }); return id },
      clearTimeout: (h: unknown) => { pending.delete(h as number) },
    },
    advance(ms: number) {
      now += ms
      for (const [id, t] of [...pending.entries()].sort((a, b) => a[1].at - b[1].at)) {
        if (t.at <= now) { pending.delete(id); t.fn() }
      }
    },
    pendingCount: () => pending.size,
  }
}

function setup(enabled = true) {
  const ft = fakeTimers()
  const phases: HintPhase[] = []
  const onDone = vi.fn()
  const hint = createHintController({ enabled, onPhase: (p) => { phases.push(p) }, onDone, timers: ft.timers })
  return { ft, phases, onDone, hint }
}

describe('createHintController', () => {
  it('start 후 1.5초가 지나면 fading, 0.3초 뒤 done + onDone 한 번', () => {
    const { ft, phases, onDone, hint } = setup()
    hint.start()
    expect(hint.phase).toBe('shown')
    ft.advance(HINT_SHOW_MS - 1)
    expect(hint.phase).toBe('shown')
    ft.advance(1)
    expect(hint.phase).toBe('fading')
    ft.advance(HINT_FADE_MS)
    expect(hint.phase).toBe('done')
    expect(phases).toEqual(['shown', 'fading', 'done'])
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('dismiss는 shown 타이머를 취소하고 즉시 fading 으로 — 멱등', () => {
    const { ft, onDone, hint } = setup()
    hint.start()
    ft.advance(200)
    hint.dismiss()
    expect(hint.phase).toBe('fading')
    hint.dismiss()                       // 두 번째 — 아무 일도 없다
    ft.advance(HINT_SHOW_MS)             // 원래 show 타이머 시각을 지나도 중복 fade 없음
    expect(hint.phase).toBe('done')
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(ft.pendingCount()).toBe(0)
  })

  it('done 뒤의 dismiss 는 no-op', () => {
    const { ft, onDone, hint } = setup()
    hint.start()
    hint.dismiss()
    ft.advance(HINT_FADE_MS)
    hint.dismiss()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('enabled=false 면 처음부터 done 이고 start/dismiss 가 아무 것도 하지 않는다', () => {
    const { ft, phases, onDone, hint } = setup(false)
    expect(hint.phase).toBe('done')
    hint.start()
    hint.dismiss()
    ft.advance(HINT_SHOW_MS + HINT_FADE_MS)
    expect(phases).toEqual([])
    expect(onDone).not.toHaveBeenCalled()
  })

  it('dispose 는 타이머를 정리하고 onDone 을 부르지 않는다', () => {
    const { ft, onDone, hint } = setup()
    hint.start()
    hint.dispose()
    expect(hint.phase).toBe('done')
    expect(ft.pendingCount()).toBe(0)
    ft.advance(HINT_SHOW_MS + HINT_FADE_MS)
    expect(onDone).not.toHaveBeenCalled()
  })

  it('start 를 두 번 불러도 타이머는 하나다', () => {
    const { ft, hint } = setup()
    hint.start()
    hint.start()
    expect(ft.pendingCount()).toBe(1)
  })
})
