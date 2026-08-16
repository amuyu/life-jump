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
  /** 소스별 액션 진입점 — 키보드는 'keyboard', 터치 컨트롤러는 'touch' 로 부른다 */
  press(action: InputAction, source: InputSource): void
  release(action: InputAction, source: InputSource): void
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

export type InputAction = 'left' | 'right' | 'jump'
export type InputSource = 'keyboard' | 'touch'

const JUMP_CODES = new Set(['Space', 'ArrowUp', 'KeyW'])
const LEFT_CODES = new Set(['ArrowLeft', 'KeyA'])
const RIGHT_CODES = new Set(['ArrowRight', 'KeyD'])

interface SourceState {
  left: boolean
  right: boolean
  jumpHeld: boolean
}

const freshSource = (): SourceState => ({ left: false, right: false, jumpHeld: false })

export function createInput(): Input {
  // 소스별 상태. 스냅샷은 둘의 OR — 키보드 ←를 누른 채 마우스로 이동 존을 눌렀다
  // 떼도 ←가 살아 있어야 한다. 단일 불리언에 마지막 호출이 이기게 두면 데스크탑에서
  // 마우스 클릭 한 번에 키가 풀린다.
  const sources: Record<InputSource, SourceState> = {
    keyboard: freshSource(),
    touch: freshSource(),
  }
  let jumpPressed = false
  // reset() 시점에 점프키가 눌려 있었으면, 실제 keyup을 볼 때까지 점프를 막는다.
  // 브라우저의 키 반복 keydown은 새 누름과 구분되지 않으므로 이 플래그가 없으면
  // 모달을 마우스로 닫은 직후 "누르고 있던" Space가 점프로 이어진다 (스펙 8절 4).
  // 키보드 전용이다 — pointerdown은 반복되지 않으므로 터치에는 필요 없다.
  let kbJumpBlocked = false

  const anyJumpHeld = (): boolean => sources.keyboard.jumpHeld || sources.touch.jumpHeld

  const press = (action: InputAction, source: InputSource): void => {
    const s = sources[source]
    if (action === 'left') { s.left = true; return }
    if (action === 'right') { s.right = true; return }
    if (source === 'keyboard' && kbJumpBlocked) return   // 뗐다 다시 눌러야 한다
    // 합산 held가 false→true 로 바뀔 때만 엣지 — 이미 어느 소스든 잡고 있으면
    // 키 반복이거나 두 번째 소스의 중복 누름이다
    if (!anyJumpHeld()) jumpPressed = true
    s.jumpHeld = true
  }

  const release = (action: InputAction, source: InputSource): void => {
    const s = sources[source]
    if (action === 'left') { s.left = false; return }
    if (action === 'right') { s.right = false; return }
    s.jumpHeld = false
    if (source === 'keyboard') kbJumpBlocked = false   // 실제로 뗐다 — 다음 누름은 진짜 엣지다
  }

  const handleKeyDown = (code: string): void => {
    if (LEFT_CODES.has(code)) press('left', 'keyboard')
    if (RIGHT_CODES.has(code)) press('right', 'keyboard')
    if (JUMP_CODES.has(code)) press('jump', 'keyboard')
  }

  const handleKeyUp = (code: string): void => {
    if (LEFT_CODES.has(code)) release('left', 'keyboard')
    if (RIGHT_CODES.has(code)) release('right', 'keyboard')
    if (JUMP_CODES.has(code)) release('jump', 'keyboard')
  }

  const snapshot = (): InputState => ({
    left: sources.keyboard.left || sources.touch.left,
    right: sources.keyboard.right || sources.touch.right,
    jumpHeld: anyJumpHeld(),
    jumpPressed,
  })

  const consume = (): void => {
    jumpPressed = false
  }

  const reset = (): void => {
    // 눌려 있던 점프키는 실제 keyup을 볼 때까지 죽은 키로 둔다.
    // 눌려 있지 않았다면 막을 것이 없다 — 막으면 복귀 후 첫 점프를 먹는다.
    kbJumpBlocked = sources.keyboard.jumpHeld
    sources.keyboard = freshSource()
    sources.touch = freshSource()
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

  return { snapshot, consume, reset, press, release, handleKeyDown, handleKeyUp, attach }
}
