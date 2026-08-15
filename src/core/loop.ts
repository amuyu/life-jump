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
    // 스펙 4절이 요구하는 하드 백스톱. 바로 위 delta 클램프가 이미 한 프레임에
    // 들어오는 시간을 MAX_FRAME_DELTA(= STEP × 6)로 자르므로 현재 상수 조합에서
    // 이 가지는 도달 불가능하다 — 방어용으로 남겨둔다. 두 상수의 관계가 바뀌면
    // (예: 클램프를 늘리거나 스텝 상한을 줄이면) 이것이 유일한 방어선이 된다.
    // 테스트로 덮이지 않는다는 점을 알고 두는 코드다.
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
