export const HINT_SHOW_MS = 1500
export const HINT_FADE_MS = 300

export type HintPhase = 'idle' | 'shown' | 'fading' | 'done'

/** 테스트에서 가짜 타이머를 주입하기 위한 최소 표면 */
export interface HintTimers {
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export interface HintController {
  /** idle → shown. HINT_SHOW_MS 뒤 자동으로 dismiss() */
  start(): void
  /** shown → fading → (HINT_FADE_MS) done, onDone 은 딱 한 번. 그 밖의 상태에서는 no-op */
  dismiss(): void
  /** 타이머 정리 + done. onDone 을 부르지 않는다 (언마운트용) */
  dispose(): void
  readonly phase: HintPhase
}

const realTimers: HintTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
}

/**
 * 첫 판 조작 안내의 상태 기계. DOM 을 모른다 — 오버레이가 onPhase 로 클래스를 바꾸고
 * main 이 onDone 으로 save 를 갱신한다.
 */
export function createHintController(opts: {
  enabled: boolean
  onPhase(phase: HintPhase): void
  onDone(): void
  timers?: HintTimers
}): HintController {
  const timers = opts.timers ?? realTimers
  let phase: HintPhase = opts.enabled ? 'idle' : 'done'
  let showTimer: unknown = null
  let fadeTimer: unknown = null

  const setPhase = (next: HintPhase): void => {
    phase = next
    opts.onPhase(next)
  }

  const clearTimers = (): void => {
    if (showTimer !== null) { timers.clearTimeout(showTimer); showTimer = null }
    if (fadeTimer !== null) { timers.clearTimeout(fadeTimer); fadeTimer = null }
  }

  const dismiss = (): void => {
    if (phase !== 'shown') return
    clearTimers()
    setPhase('fading')
    fadeTimer = timers.setTimeout(() => {
      fadeTimer = null
      setPhase('done')
      opts.onDone()
    }, HINT_FADE_MS)
  }

  const start = (): void => {
    if (phase !== 'idle') return
    setPhase('shown')
    showTimer = timers.setTimeout(() => {
      showTimer = null
      dismiss()
    }, HINT_SHOW_MS)
  }

  const dispose = (): void => {
    clearTimers()
    phase = 'done'   // onPhase/onDone 없이 조용히 끝낸다 — DOM 은 곧 사라진다
  }

  return {
    start, dismiss, dispose,
    get phase() { return phase },
  }
}
