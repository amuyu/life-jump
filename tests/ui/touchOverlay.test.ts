// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountTouchOverlay, TRACK_HALF } from '../../src/ui/touchOverlay'
import { FOLLOW, type TouchSnapshot } from '../../src/core/touch'
import { HINT_SHOW_MS, HINT_FADE_MS } from '../../src/ui/touchHint'

const idle: TouchSnapshot = { moveAnchor: null, movePoint: null, moveDir: 0, jumpActive: false, lastPointerType: null }

function fakeTouch() {
  let cb: ((s: TouchSnapshot) => void) | null = null
  return {
    subscribe: (fn: (s: TouchSnapshot) => void) => { cb = fn; return () => { cb = null } },
    emit: (s: Partial<TouchSnapshot>) => { cb?.({ ...idle, ...s }) },
    subscribed: () => cb !== null,
  }
}

function setup(opts: { showHint?: boolean; isCoarse?: boolean } = {}) {
  const layer = document.createElement('div')
  document.body.appendChild(layer)
  const touch = fakeTouch()
  const onHintDone = vi.fn()
  const mounted = mountTouchOverlay(layer, touch, {
    showHint: opts.showHint ?? true,
    onHintDone,
    isCoarse: () => opts.isCoarse ?? true,
  })
  const q = <T extends Element>(sel: string) => layer.querySelector<T>(sel)
  return { layer, touch, onHintDone, mounted, q }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = '' })

describe('mountTouchOverlay — 구조', () => {
  it('트랙·점프 글리프·안내를 gameLayer 안에 만든다', () => {
    const { q } = setup()
    expect(q('.touch-overlay')).not.toBeNull()
    expect(q('.touch-track.touch-track-rest .touch-knob')).not.toBeNull()
    expect(q('.touch-track.touch-track-live')).not.toBeNull()
    expect(q('.touch-jump-glyph')).not.toBeNull()
    expect(q('.touch-hint')?.textContent).toBe('왼쪽 밀어서 이동 · 오른쪽 길게 눌러 점프')
  })

  it('unmount 는 DOM 을 제거하고 구독을 해제한다', () => {
    const { layer, touch, mounted } = setup()
    mounted.unmount()
    expect(layer.querySelector('.touch-overlay')).toBeNull()
    expect(touch.subscribed()).toBe(false)
  })
})

describe('mountTouchOverlay — 스냅샷 반영', () => {
  it('moveDir 에 따라 rest 트랙 노브가 좌/중/우로 옮겨지고 활성 클래스가 붙는다', () => {
    const { touch, q } = setup()
    touch.emit({ moveAnchor: { x: 50, y: 500 }, movePoint: { x: 70, y: 500 }, moveDir: 1 })
    const rest = q<HTMLElement>('.touch-track-rest')!
    expect(rest.classList.contains('is-active')).toBe(true)
    expect(q<HTMLElement>('.touch-track-rest .touch-knob')!.style.transform).toBe(`translateX(${TRACK_HALF}px)`)
    touch.emit(idle)
    expect(rest.classList.contains('is-active')).toBe(false)
    expect(q<HTMLElement>('.touch-track-rest .touch-knob')!.style.transform).toBe('translateX(0px)')
  })

  it('live 트랙은 anchor 위치에 뜨고 손가락 오프셋을 ±FOLLOW → ±TRACK_HALF 로 매핑한다', () => {
    const { touch, q } = setup()
    const live = q<HTMLElement>('.touch-track-live')!
    expect(live.hidden).toBe(true)
    touch.emit({ moveAnchor: { x: 120, y: 480 }, movePoint: { x: 120 + FOLLOW / 2, y: 480 }, moveDir: 1 })
    expect(live.hidden).toBe(false)
    expect(live.style.left).toBe('120px')
    expect(live.style.top).toBe('480px')
    expect(q<HTMLElement>('.touch-track-live .touch-knob')!.style.transform).toBe(`translateX(${TRACK_HALF / 2}px)`)
    // FOLLOW 를 넘는 오프셋은 잘린다
    touch.emit({ moveAnchor: { x: 120, y: 480 }, movePoint: { x: 120 + FOLLOW * 3, y: 480 }, moveDir: 1 })
    expect(q<HTMLElement>('.touch-track-live .touch-knob')!.style.transform).toBe(`translateX(${TRACK_HALF}px)`)
  })

  it('jumpActive 가 점프 글리프의 활성 클래스를 토글한다', () => {
    const { touch, q } = setup()
    touch.emit({ jumpActive: true })
    expect(q('.touch-jump-glyph')!.classList.contains('is-active')).toBe(true)
    touch.emit({ jumpActive: false })
    expect(q('.touch-jump-glyph')!.classList.contains('is-active')).toBe(false)
  })
})

describe('mountTouchOverlay — 표시 조건', () => {
  it('coarse 가 아니면 글리프를 숨기고 키보드 문구를 쓴다', () => {
    const { q } = setup({ isCoarse: false })
    expect(q('.touch-overlay')!.classList.contains('touch-overlay-glyphs-hidden')).toBe(true)
    expect(q('.touch-hint')?.textContent).toBe('← → 이동 · Space 길게 눌러 점프')
  })

  it('숨긴 상태에서 touch 포인터 스냅샷이 오면 글리프를 보인다', () => {
    const { touch, q } = setup({ isCoarse: false })
    touch.emit({ lastPointerType: 'mouse', jumpActive: true })
    expect(q('.touch-overlay')!.classList.contains('touch-overlay-glyphs-hidden')).toBe(true)
    touch.emit({ lastPointerType: 'touch', jumpActive: true })
    expect(q('.touch-overlay')!.classList.contains('touch-overlay-glyphs-hidden')).toBe(false)
  })
})

describe('mountTouchOverlay — 안내', () => {
  it('마운트 직후 shown, dismissHint 로 fading, 0.3초 뒤 제거 + onHintDone 한 번', () => {
    const { q, mounted, onHintDone } = setup()
    expect(q('.touch-hint')!.classList.contains('touch-hint-shown')).toBe(true)
    mounted.dismissHint()
    expect(q('.touch-hint')!.classList.contains('touch-hint-fading')).toBe(true)
    mounted.dismissHint()
    vi.advanceTimersByTime(HINT_FADE_MS)
    expect(q('.touch-hint')).toBeNull()
    expect(onHintDone).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(HINT_SHOW_MS)
    expect(onHintDone).toHaveBeenCalledTimes(1)
  })

  it('활성 포인터가 보이면 오버레이가 스스로 안내를 내린다 — 이동 존 down 직후(dir=0)도 포함', () => {
    // 이동 존을 처음 누르면 12px 밀기 전까지 InputState 는 전부 false 다. main 의 스냅샷
    // 검사만으로는 "화면을 눌렀는데 안내가 안 내려가는" 구간이 생기므로 오버레이가
    // moveAnchor/jumpActive 를 직접 본다.
    const { touch, q, onHintDone } = setup()
    touch.emit({ moveAnchor: { x: 50, y: 500 }, movePoint: { x: 50, y: 500 }, moveDir: 0 })
    expect(q('.touch-hint')!.classList.contains('touch-hint-fading')).toBe(true)
    vi.advanceTimersByTime(HINT_FADE_MS)
    expect(onHintDone).toHaveBeenCalledTimes(1)
  })

  it('jumpActive 스냅샷도 안내를 내린다', () => {
    const { touch, q } = setup()
    touch.emit({ jumpActive: true })
    expect(q('.touch-hint')!.classList.contains('touch-hint-fading')).toBe(true)
  })

  it('1.5초가 지나면 스스로 페이드한다', () => {
    const { q, onHintDone } = setup()
    vi.advanceTimersByTime(HINT_SHOW_MS)
    expect(q('.touch-hint')!.classList.contains('touch-hint-fading')).toBe(true)
    vi.advanceTimersByTime(HINT_FADE_MS)
    expect(onHintDone).toHaveBeenCalledTimes(1)
  })

  it('showHint=false 면 안내 DOM 이 없고 dismissHint 는 no-op, onHintDone 은 안 불린다', () => {
    const { q, mounted, onHintDone } = setup({ showHint: false })
    expect(q('.touch-hint')).toBeNull()
    mounted.dismissHint()
    vi.advanceTimersByTime(HINT_SHOW_MS + HINT_FADE_MS)
    expect(onHintDone).not.toHaveBeenCalled()
  })

  it('unmount 는 진행 중 타이머를 정리하고 onHintDone 을 부르지 않는다', () => {
    const { mounted, onHintDone } = setup()
    mounted.unmount()
    vi.advanceTimersByTime(HINT_SHOW_MS + HINT_FADE_MS)
    expect(onHintDone).not.toHaveBeenCalled()
  })
})
