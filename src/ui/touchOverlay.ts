import type { TouchController, TouchSnapshot } from '../core/touch'
import { FOLLOW } from '../core/touch'
import { createHintController, type HintPhase } from './touchHint'

/** 트랙 폭 96px 의 절반 — 노브가 움직이는 최대 거리 */
export const TRACK_HALF = 32

const HINT_TOUCH = '왼쪽 밀어서 이동 · 오른쪽 길게 눌러 점프'
const HINT_KEYBOARD = '← → 이동 · Space 길게 눌러 점프'

export interface TouchOverlayOptions {
  showHint: boolean
  /** 안내가 끝났을 때 딱 한 번 — main 이 save 갱신·저장 */
  onHintDone(): void
  /** 기본 matchMedia('(pointer: coarse)'). 테스트 주입용 */
  isCoarse?: () => boolean
}

export interface MountedTouchOverlay {
  /** 멱등 — 여러 번 불려도 타이머·onHintDone 중복 없음 */
  dismissHint(): void
  /** 구독 해제 + DOM 제거 + 남은 타이머 정리. 안내가 진행 중이었으면 onHintDone 은 부르지 않는다 */
  unmount(): void
}

const defaultIsCoarse = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

function buildTrack(extraClass: string): { track: HTMLDivElement; knob: HTMLSpanElement } {
  const track = document.createElement('div')
  track.className = `touch-track ${extraClass}`
  const left = document.createElement('span')
  left.className = 'touch-track-arrow'
  left.textContent = '◀'
  const knob = document.createElement('span')
  knob.className = 'touch-knob'
  const right = document.createElement('span')
  right.className = 'touch-track-arrow'
  right.textContent = '▶'
  track.append(left, knob, right)
  return { track, knob }
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/**
 * 판 중 캔버스 위에 겹치는 순수 DOM 오버레이. pointer-events: none — 판정은 gameLayer 가
 * 하고 여기서는 스냅샷을 그림으로 옮기기만 한다. save 를 모른다.
 */
export function mountTouchOverlay(
  gameLayer: HTMLElement,
  touch: Pick<TouchController, 'subscribe'>,
  opts: TouchOverlayOptions,
): MountedTouchOverlay {
  const isCoarse = opts.isCoarse ?? defaultIsCoarse
  let glyphsVisible = isCoarse()

  const root = document.createElement('div')
  root.className = 'touch-overlay'
  root.classList.toggle('touch-overlay-glyphs-hidden', !glyphsVisible)

  const rest = buildTrack('touch-track-rest')
  const live = buildTrack('touch-track-live')
  live.track.hidden = true

  const jump = document.createElement('div')
  jump.className = 'touch-jump-glyph'
  jump.textContent = '●'

  root.append(rest.track, live.track, jump)

  // ── 첫 판 안내 ──
  let hintEl: HTMLDivElement | null = null
  if (opts.showHint) {
    hintEl = document.createElement('div')
    hintEl.className = 'touch-hint type-caption'
    hintEl.textContent = glyphsVisible ? HINT_TOUCH : HINT_KEYBOARD
    root.appendChild(hintEl)
  }
  const onPhase = (phase: HintPhase): void => {
    if (hintEl === null) return
    hintEl.classList.toggle('touch-hint-shown', phase === 'shown')
    hintEl.classList.toggle('touch-hint-fading', phase === 'fading')
    if (phase === 'done') { hintEl.remove(); hintEl = null }
  }
  const hint = createHintController({ enabled: opts.showHint, onPhase, onDone: opts.onHintDone })

  gameLayer.appendChild(root)
  hint.start()

  const render = (s: TouchSnapshot): void => {
    if (!glyphsVisible && s.lastPointerType === 'touch') {
      glyphsVisible = true
      root.classList.remove('touch-overlay-glyphs-hidden')
    }

    const active = s.moveAnchor !== null
    // 손가락이 닿은 순간 안내를 내린다 — 이동 존 down 직후는 dir=0 이라 InputState 로는
    // 보이지 않는다. 키보드는 main 이 스냅샷 플래그로 dismissHint 를 부른다. 멱등이라 겹쳐도 무해.
    if (active || s.jumpActive) hint.dismiss()
    rest.track.classList.toggle('is-active', active)
    rest.knob.style.transform = `translateX(${s.moveDir * TRACK_HALF}px)`

    if (s.moveAnchor !== null && s.movePoint !== null) {
      live.track.hidden = false
      live.track.style.left = `${s.moveAnchor.x}px`
      live.track.style.top = `${s.moveAnchor.y}px`
      const ratio = clamp((s.movePoint.x - s.moveAnchor.x) / FOLLOW, -1, 1)
      live.knob.style.transform = `translateX(${ratio * TRACK_HALF}px)`
    } else {
      live.track.hidden = true
    }

    jump.classList.toggle('is-active', s.jumpActive)
  }

  const unsubscribe = touch.subscribe(render)

  return {
    dismissHint: () => { hint.dismiss() },
    unmount: () => {
      unsubscribe()
      hint.dispose()
      root.remove()
    },
  }
}
