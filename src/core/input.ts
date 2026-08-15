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
  /**
   * 브라우저 이벤트 배선. DOM이 없는 환경에서는 호출하지 않는다.
   *
   * `shouldCapture`가 참을 돌려줄 때만 `preventDefault()`를 부른다. 무조건
   * 막으면 페이지 전체에서 Space로 버튼을 누를 수 없고 ArrowUp으로 상점
   * 패널을 스크롤할 수 없다 — 게임을 실제로 플레이 중일 때만 가로챈다.
   * 생략하면 항상 가로챈다.
   */
  attach(
    target: { addEventListener: Function; removeEventListener: Function },
    shouldCapture?: () => boolean,
  ): () => void
}

const JUMP_CODES = new Set(['Space', 'ArrowUp', 'KeyW'])
const LEFT_CODES = new Set(['ArrowLeft', 'KeyA'])
const RIGHT_CODES = new Set(['ArrowRight', 'KeyD'])

export function createInput(): Input {
  let left = false
  let right = false
  let jumpHeld = false
  let jumpPressed = false
  // reset() 시점에 점프키가 눌려 있었으면, 실제 keyup을 볼 때까지 점프를 막는다.
  // 브라우저의 키 반복 keydown은 새 누름과 구분되지 않으므로 이 플래그가 없으면
  // 모달을 마우스로 닫은 직후 "누르고 있던" Space가 점프로 이어진다 (스펙 8절 4).
  let jumpBlocked = false

  const handleKeyDown = (code: string): void => {
    if (LEFT_CODES.has(code)) left = true
    if (RIGHT_CODES.has(code)) right = true
    if (JUMP_CODES.has(code)) {
      if (jumpBlocked) return   // 뗐다 다시 눌러야 한다
      // 이미 눌려 있으면 브라우저 키 반복 — 엣지가 아니다
      if (!jumpHeld) jumpPressed = true
      jumpHeld = true
    }
  }

  const handleKeyUp = (code: string): void => {
    if (LEFT_CODES.has(code)) left = false
    if (RIGHT_CODES.has(code)) right = false
    if (JUMP_CODES.has(code)) {
      jumpHeld = false
      jumpBlocked = false   // 실제로 뗐다 — 다음 누름은 진짜 엣지다
    }
  }

  const snapshot = (): InputState => ({ left, right, jumpHeld, jumpPressed })

  const consume = (): void => {
    jumpPressed = false
  }

  const reset = (): void => {
    left = false
    right = false
    // 눌려 있던 점프키는 실제 keyup을 볼 때까지 죽은 키로 둔다.
    // 눌려 있지 않았다면 막을 것이 없다 — 막으면 복귀 후 첫 점프를 먹는다.
    jumpBlocked = jumpHeld
    jumpHeld = false
    jumpPressed = false
  }

  const attach = (
    target: { addEventListener: Function; removeEventListener: Function },
    shouldCapture?: () => boolean,
  ): (() => void) => {
    const onDown = (e: { code: string; preventDefault(): void }) => {
      const known =
        JUMP_CODES.has(e.code) || LEFT_CODES.has(e.code) || RIGHT_CODES.has(e.code)
      // 플레이 중일 때만 가로챈다 — 로비·상점에서는 Space로 버튼을 누르고
      // ArrowUp으로 패널을 스크롤할 수 있어야 한다
      if (known && (shouldCapture === undefined || shouldCapture())) {
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
