import type { Input } from './input'

/**
 * 조이스틱 튜닝 상수 (CSS px). 물리 상수와 섞지 않기 위해 constants.ts 에 두지 않는다.
 * FOLLOW > DEAD 는 불변식이다 — 같거나 작으면 한 방향으로 밀다 손가락을 멈추는 순간
 * anchor 가 손가락 DEAD 이내로 따라와 방향이 풀린다.
 */
export const DEAD = 12     // 이 안이면 정지
export const FOLLOW = 24   // 중심에서 이만큼 넘게 멀어지면 중심이 따라온다

export interface TouchSnapshot {
  /** 이동 존 활성 시 조이스틱 중심 (CSS px) */
  moveAnchor: { x: number; y: number } | null
  /** 이동 존 활성 시 현재 손가락 */
  movePoint: { x: number; y: number } | null
  moveDir: -1 | 0 | 1
  jumpActive: boolean
  /** 마지막으로 처리한 포인터의 종류 ('touch' | 'mouse' | 'pen' | null). 오버레이 표시 판단용 */
  lastPointerType: string | null
}

export interface PointerLike {
  type: 'down' | 'move' | 'up' | 'cancel'
  pointerId: number
  clientX: number
  clientY: number
  pointerType?: string
}

/** attach 가 필요로 하는 최소 DOM 표면 — 테스트에서는 가짜 객체를 넣는다 */
export interface TouchTarget {
  addEventListener: Function
  removeEventListener: Function
  setPointerCapture?: (pointerId: number) => void
}

export interface TouchController {
  /** DOM 배선. 반환된 함수가 detach — 호출자(main.ts)가 보관한다. attach·detach 모두 clear() 를 부른다 */
  attach(el: TouchTarget): () => void
  /** 모달용 — 손가락이 아직 화면에 있다. 포인터를 suppressed 로 보존하고 액션만 해제 */
  reset(): void
  /** 수명 종료·OS 개입용 — 포인터 목록을 전부 삭제하고 액션 해제. 이후 어떤 stale up 도 무시된다 */
  clear(): void
  subscribe(cb: (s: TouchSnapshot) => void): () => void
  /** 테스트·배선용 저수준 진입점 — DOM 없이 가짜 이벤트를 넣는다 */
  handlePointer(e: PointerLike): void
}

type Zone = 'move' | 'jump'
type Dir = -1 | 0 | 1

interface Tracked {
  zone: Zone
  /** reset() 을 거친 손가락 — 존은 점유하지만 move 는 무시하고 up 은 제거만 한다 */
  suppressed: boolean
  anchorX: number
  anchorY: number
  x: number
  y: number
  dir: Dir
}

const dirAction = (dir: Dir): 'left' | 'right' => (dir < 0 ? 'left' : 'right')

export function createTouch(input: Input, layout: () => { width: number }): TouchController {
  const pointers = new Map<number, Tracked>()
  const subs = new Set<(s: TouchSnapshot) => void>()
  let lastPointerType: string | null = null

  const zoneOf = (x: number): Zone => (x < layout().width / 2 ? 'move' : 'jump')

  const activeIn = (zone: Zone): Tracked | null => {
    for (const t of pointers.values()) if (t.zone === zone) return t
    return null
  }

  const publish = (): void => {
    const move = activeIn('move')
    const jump = activeIn('jump')
    const live = move !== null && !move.suppressed ? move : null
    const snap: TouchSnapshot = {
      moveAnchor: live === null ? null : { x: live.anchorX, y: live.anchorY },
      movePoint: live === null ? null : { x: live.x, y: live.y },
      moveDir: live === null ? 0 : live.dir,
      jumpActive: jump !== null && !jump.suppressed,
      lastPointerType,
    }
    for (const cb of subs) cb(snap)
  }

  /** dir 이 바뀔 때만 press/release 를 부른다 — 매 move 마다 부르지 않는다 */
  const setDir = (t: Tracked, next: Dir): void => {
    if (t.dir === next) return
    if (t.dir !== 0) input.release(dirAction(t.dir), 'touch')
    if (next !== 0) input.press(dirAction(next), 'touch')
    t.dir = next
  }

  const releaseActions = (t: Tracked): void => {
    if (t.suppressed) return
    if (t.zone === 'jump') input.release('jump', 'touch')
    else setDir(t, 0)
  }

  const onDown = (e: PointerLike): void => {
    const zone = zoneOf(e.clientX)
    // 한 존에 한 포인터 — 활성이든 suppressed 든 이미 있으면 무시 (스냅샷도 안 낸다)
    if (activeIn(zone) !== null) return
    pointers.set(e.pointerId, {
      zone, suppressed: false,
      anchorX: e.clientX, anchorY: e.clientY, x: e.clientX, y: e.clientY, dir: 0,
    })
    if (zone === 'jump') input.press('jump', 'touch')
    publish()
  }

  const onMove = (e: PointerLike): void => {
    const t = pointers.get(e.pointerId)
    if (t === undefined || t.suppressed || t.zone !== 'move') return
    t.x = e.clientX
    t.y = e.clientY
    // 조이스틱 판정은 Task 3 에서 채운다
    publish()
  }

  const onUp = (e: PointerLike): void => {
    const t = pointers.get(e.pointerId)
    if (t === undefined) return
    pointers.delete(e.pointerId)
    releaseActions(t)
    publish()
  }

  const handlePointer = (e: PointerLike): void => {
    if (e.pointerType !== undefined) lastPointerType = e.pointerType
    switch (e.type) {
      case 'down': onDown(e); break
      case 'move': onMove(e); break
      case 'up':
      case 'cancel': onUp(e); break
    }
  }

  const clear = (): void => {
    for (const t of pointers.values()) releaseActions(t)
    pointers.clear()
    publish()
  }

  const reset = (): void => {
    // Task 4 で suppressed 規則で変わる
    clear()
  }

  const subscribe = (cb: (s: TouchSnapshot) => void): (() => void) => {
    subs.add(cb)
    return () => { subs.delete(cb) }
  }

  const attach = (_el: TouchTarget): (() => void) => {
    throw new Error('attach は Task 5 で実装する')
  }

  return { attach, reset, clear, subscribe, handlePointer }
}
