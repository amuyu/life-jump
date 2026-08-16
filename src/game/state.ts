import * as C from '../constants'

export type PlatformKind = 'normal' | 'spring' | 'crumble' | 'moving'
export type ItemKind = 'thread' | 'coin' | 'food' | 'quiz'
export type ZoneName = 'ground' | 'sky' | 'space'

export interface Platform {
  id: number
  x: number
  y: number
  width: number
  kind: PlatformKind
  movingOriginX: number
  movingDir: 1 | -1
  crumbleAt: number | null
  dead: boolean
  item: ItemKind | null
  itemAmount: number
}

export interface Player {
  x: number
  y: number
  prevY: number
  vx: number
  vy: number
  onGround: boolean
  doubleJumpUsed: boolean
}

export interface RunState {
  time: number
  maxHeight: number
  energy: number
  maxEnergy: number
  invulnerableUntil: number
  cushionAvailable: boolean
  doubleJumpEnabled: boolean
  gravity: number
  jumpVelocity: number
  moveSpeed: number
  magnetRadius: number
  thread: number
  coins: number
  over: boolean
}

export interface GameState {
  player: Player
  platforms: Platform[]
  camera: { y: number }
  run: RunState
  nextPlatformId: number
  highestGeneratedY: number
  paused: boolean
  /** 지금 띄워야 할 퀴즈. main이 이 값만 보고 모달을 연다 */
  pendingQuiz: { platformY: number } | null
  /**
   * 공중에서 주워 착지를 기다리는 퀴즈. 점프 도중 모달을 띄우면 풀고 나왔을 때
   * 플레이어가 공중 한복판에 놓여 자기가 어디로 향하던 중이었는지 다시 파악해야
   * 한다 — 그래서 발이 땅에 닿을 때까지 미룬다. 한 번에 하나만 들 수 있다.
   */
  heldQuiz: { platformY: number } | null
  standingOnId: number | null
}

export interface RunModifiers {
  maxEnergy: number
  gravity: number
  jumpVelocity: number
  moveSpeed: number
  magnetRadius: number
  cushionAvailable: boolean
  doubleJumpEnabled: boolean
  startHeight: number
}

export function defaultModifiers(): RunModifiers {
  return {
    maxEnergy: 3,
    gravity: C.GRAVITY,
    jumpVelocity: C.JUMP_V,
    moveSpeed: C.MOVE_SPEED,
    magnetRadius: 0,
    cushionAvailable: false,
    doubleJumpEnabled: false,
    startHeight: 0,
  }
}

/** 아이템도 특수 동작도 없는 평범한 발판을 만든다 */
export function makePlatform(
  id: number,
  x: number,
  y: number,
  width: number,
  kind: PlatformKind = 'normal',
): Platform {
  return {
    id,
    x,
    y,
    width,
    kind,
    movingOriginX: x,
    movingDir: 1,
    crumbleAt: null,
    dead: false,
    item: null,
    itemAmount: 0,
  }
}

export function createGameState(mods: RunModifiers): GameState {
  const baseY = mods.startHeight
  // 시작 발판: 화면 폭 전체를 덮어 첫 점프를 편하게 한다
  const ground = makePlatform(0, 0, baseY, C.LOGICAL_W)

  const player: Player = {
    x: C.LOGICAL_W / 2 - C.PLAYER_W / 2,
    y: baseY,
    prevY: baseY,
    vx: 0,
    vy: 0,
    onGround: true,
    doubleJumpUsed: false,
  }

  // 시작 카메라를 시작 높이보다 GROUND_VIEW_MARGIN만큼 아래에 두어, 화면
  // 하단에 땅이 보이도록 한다 (0으로 클램프하면 시작 발판이 화면 밖으로
  // 밀려나 캐릭터가 허공에 뜬 것처럼 보인다 — Task 16 수정 라운드 1).
  const cameraY = baseY - C.GROUND_VIEW_MARGIN

  return {
    player,
    platforms: [ground],
    camera: { y: cameraY },
    run: {
      time: 0,
      maxHeight: baseY,
      energy: mods.maxEnergy,
      maxEnergy: mods.maxEnergy,
      invulnerableUntil: 0,
      cushionAvailable: mods.cushionAvailable,
      doubleJumpEnabled: mods.doubleJumpEnabled,
      gravity: mods.gravity,
      jumpVelocity: mods.jumpVelocity,
      moveSpeed: mods.moveSpeed,
      magnetRadius: mods.magnetRadius,
      thread: 0,
      coins: 0,
      over: false,
    },
    nextPlatformId: 1,
    highestGeneratedY: baseY,
    paused: false,
    pendingQuiz: null,
    heldQuiz: null,
    standingOnId: 0,
  }
}
