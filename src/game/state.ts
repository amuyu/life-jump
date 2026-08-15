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
  pendingQuiz: { platformY: number } | null
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

  // 시작 시 플레이어가 화면 아래쪽 1/4 지점에 오도록 카메라를 잡는다
  const cameraY = Math.max(0, baseY - C.LOGICAL_H * 0.25)

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
    standingOnId: 0,
  }
}
