export interface InputState {
  left: boolean
  right: boolean
  /** 점프키가 눌려 있는 동안 참 — 가변 점프 컷오프 판정용 */
  jumpHeld: boolean
  /** 이번 틱에 점프키가 "새로" 눌렸으면 참 — 점프 발동용 */
  jumpPressed: boolean
}

export interface Input {
  /** 물리 스텝이 소비할 현재 입력 스냅샷 */
  snapshot(): InputState
  /** 스텝 처리 후 호출 — jumpPressed 엣지를 소비한다 */
  consume(): void
  /** 모든 키를 뗀 것으로 만든다 (모달 종료·탭 복귀) */
  reset(): void
  /** 테스트·배선용 저수준 진입점 */
  handleKeyDown(code: string): void
  handleKeyUp(code: string): void
  /** 브라우저 이벤트 배선. DOM이 없는 환경에서는 호출하지 않는다 */
  attach(target: { addEventListener: Function; removeEventListener: Function }): () => void
}

const JUMP_CODES = new Set(['Space', 'ArrowUp', 'KeyW'])
const LEFT_CODES = new Set(['ArrowLeft', 'KeyA'])
const RIGHT_CODES = new Set(['ArrowRight', 'KeyD'])

export function createInput(): Input {
  let left = false
  let right = false
  let jumpHeld = false
  let jumpPressed = false

  const handleKeyDown = (code: string): void => {
    if (LEFT_CODES.has(code)) left = true
    if (RIGHT_CODES.has(code)) right = true
    if (JUMP_CODES.has(code)) {
      // 이미 눌려 있으면 브라우저 키 반복 — 엣지가 아니다
      if (!jumpHeld) jumpPressed = true
      jumpHeld = true
    }
  }

  const handleKeyUp = (code: string): void => {
    if (LEFT_CODES.has(code)) left = false
    if (RIGHT_CODES.has(code)) right = false
    if (JUMP_CODES.has(code)) jumpHeld = false
  }

  const snapshot = (): InputState => ({ left, right, jumpHeld, jumpPressed })

  const consume = (): void => {
    jumpPressed = false
  }

  const reset = (): void => {
    left = false
    right = false
    jumpHeld = false
    jumpPressed = false
  }

  const attach = (target: {
    addEventListener: Function
    removeEventListener: Function
  }): (() => void) => {
    const onDown = (e: { code: string; preventDefault(): void }) => {
      if (JUMP_CODES.has(e.code) || LEFT_CODES.has(e.code) || RIGHT_CODES.has(e.code)) {
        e.preventDefault() // Space 스크롤 방지
      }
      handleKeyDown(e.code)
    }
    const onUp = (e: { code: string }) => handleKeyUp(e.code)

    target.addEventListener('keydown', onDown)
    target.addEventListener('keyup', onUp)
    return () => {
      target.removeEventListener('keydown', onDown)
      target.removeEventListener('keyup', onUp)
    }
  }

  return { snapshot, consume, reset, handleKeyDown, handleKeyUp, attach }
}
