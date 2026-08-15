import { STEP, MAX_FRAME_DELTA, MAX_STEPS_PER_FRAME } from '../constants'

export interface Loop {
  /** 프레임 delta(초)를 넣으면 이번 프레임에 실행할 스텝 수를 돌려준다 */
  frame(deltaSeconds: number): number
  /** accumulator를 0으로 버린다 (탭 복귀·모달 종료 시) */
  reset(): void
}

export function createLoop(): Loop {
  let accumulator = 0

  const frame = (deltaSeconds: number): number => {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0

    accumulator += Math.min(deltaSeconds, MAX_FRAME_DELTA)

    let steps = Math.floor(accumulator / STEP)
    if (steps > MAX_STEPS_PER_FRAME) {
      steps = MAX_STEPS_PER_FRAME
      accumulator = 0 // 초과분 폐기 — 죽음의 나선 방지
    } else {
      accumulator -= steps * STEP
    }
    return steps
  }

  const reset = (): void => {
    accumulator = 0
  }

  return { frame, reset }
}
