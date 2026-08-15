import type { GameState, Platform, PlatformKind } from './state'
import { makePlatform } from './state'
import type { Rng } from '../core/rng'
import { rollDrop } from './items'
import * as C from '../constants'

/** 두 발판의 수평 간격 (겹치면 0) */
export function horizontalGap(a: Platform, b: Platform): number {
  const aRight = a.x + a.width
  const bRight = b.x + b.width
  if (b.x > aRight) return b.x - aRight
  if (a.x > bRight) return a.x - bRight
  return 0
}

/** 상승 점프로 dy만큼 올랐다가 하강하며 도달하기까지의 시간(초). 도달 불가면 NaN */
export function reachTime(dy: number): number {
  const disc = C.JUMP_V * C.JUMP_V - 2 * C.GRAVITY * dy
  if (disc < 0) return Number.NaN
  return (C.JUMP_V + Math.sqrt(disc)) / C.GRAVITY
}

/** 최소 업그레이드 상태에서 from → to 가 도달 가능한가 (최악 위치 기준) */
export function isReachable(from: Platform, to: Platform): boolean {
  const dy = to.y - from.y
  if (dy <= 0) return true
  if (dy > C.MAX_GAP_Y) return false

  const t = reachTime(dy)
  if (!Number.isFinite(t)) return false

  // 최소 업그레이드 상태 기준 수평 예산
  let budget = t * C.MOVE_SPEED

  // 이동 발판은 최악 위치를 가정한다
  if (from.kind === 'moving') budget -= C.MOVING_RANGE
  if (to.kind === 'moving') budget -= C.MOVING_RANGE

  if (budget < 0) return false
  return horizontalGap(from, to) <= budget
}

/** 0(쉬움) ~ 1(최대 난이도) */
function difficulty(y: number): number {
  return Math.min(1, Math.max(0, y / C.DIFFICULTY_FULL_Y))
}

function widthAt(y: number): number {
  const t = difficulty(y)
  return Math.round(C.PLATFORM_W_START + (C.PLATFORM_W_MIN - C.PLATFORM_W_START) * t)
}

function pickKind(y: number, rng: Rng): PlatformKind {
  const roll = rng.next()

  if (y < C.SKY_START_Y) {
    // 땅 구간 — 일반과 스프링만
    return roll < 0.05 ? 'spring' : 'normal'
  }

  if (roll < 0.05) return 'spring'
  if (roll < 0.18) return 'crumble'
  if (roll < 0.30) return 'moving'
  return 'normal'
}

/** targetY 높이까지 발판을 채운다. 이미 채워져 있으면 아무것도 하지 않는다 */
export function generateUpTo(state: GameState, targetY: number, rng: Rng): void {
  while (state.highestGeneratedY < targetY) {
    const prev = state.platforms[state.platforms.length - 1]
    if (prev === undefined) return

    const t = difficulty(prev.y)
    const gapMax = C.GAP_Y_START_MAX + (C.GAP_Y_MAX - C.GAP_Y_START_MAX) * t
    const dy = rng.range(C.GAP_Y_MIN, gapMax)
    const y = prev.y + dy

    const width = widthAt(y)
    const kind = pickKind(y, rng)

    // 도달 가능한 수평 예산을 계산한다
    let budget = reachTime(dy) * C.MOVE_SPEED
    if (prev.kind === 'moving') budget -= C.MOVING_RANGE
    if (kind === 'moving') budget -= C.MOVING_RANGE
    if (budget < 0) budget = 0

    // 예산을 만족하는 x 범위를 구하고 화면 안으로 자른다
    const bandMin = prev.x - width - budget
    const bandMax = prev.x + prev.width + budget
    const lo = Math.max(0, bandMin)
    const hi = Math.min(C.LOGICAL_W - width, bandMax)

    // 정수 범위에서 직접 뽑는다 — 실수로 뽑아 반올림하면 최대 0.5px 예산 밖으로 나간다
    const iLo = Math.ceil(lo)
    const iHi = Math.floor(hi)
    const x = iLo <= iHi
      ? rng.int(iLo, iHi)
      : Math.round(Math.max(0, Math.min(C.LOGICAL_W - width, lo)))

    const plat = makePlatform(state.nextPlatformId++, x, y, width, kind)
    plat.movingOriginX = plat.x

    // 정수 밴드가 비어(폭 < 1px) 근사값을 쓴 경우를 대비한 최종 방어.
    // prev 바로 위로 당기면 간격이 0이 되어 반드시 도달 가능하므로 루프는 종료한다.
    const safeX = Math.max(0, Math.min(C.LOGICAL_W - width, prev.x))
    while (plat.x !== safeX && !isReachable(prev, plat)) {
      plat.x += plat.x < safeX ? 1 : -1
      plat.movingOriginX = plat.x
    }

    // 아이템 드랍 — 발판 자신의 y를 기준으로 굴린다 (스펙 3절 원칙)
    const drop = rollDrop(y, rng)
    plat.item = drop.kind
    plat.itemAmount = drop.amount

    state.platforms.push(plat)
    state.highestGeneratedY = y
  }
}

/** 카메라 아래로 벗어난 발판을 배열에서 제거한다 */
export function prunePlatforms(state: GameState): void {
  const floor = state.camera.y - C.PRUNE_MARGIN
  state.platforms = state.platforms.filter((p) => p.y >= floor)
}

export function applyLandingEffect(state: GameState, platform: Platform): void {
  if (platform.kind === 'spring') {
    state.player.vy = C.SPRING_V
    state.player.onGround = false
    state.player.doubleJumpUsed = false
    return
  }

  if (platform.kind === 'crumble' && platform.crumbleAt === null) {
    platform.crumbleAt = state.run.time + C.CRUMBLE_DELAY
  }
}

export function stepCrumbling(state: GameState): void {
  for (const p of state.platforms) {
    if (p.crumbleAt !== null && !p.dead && state.run.time >= p.crumbleAt) {
      p.dead = true
    }
  }
}

export function stepMovingPlatforms(
  state: GameState,
  dt: number,
  standingOn: Platform | null,
): void {
  for (const p of state.platforms) {
    if (p.kind !== 'moving' || p.dead) continue

    const before = p.x
    let next = p.x + p.movingDir * C.MOVING_SPEED * dt

    const min = p.movingOriginX - C.MOVING_RANGE
    const max = p.movingOriginX + C.MOVING_RANGE

    if (next > max) {
      next = max
      p.movingDir = -1
    } else if (next < min) {
      next = min
      p.movingDir = 1
    }

    // 화면 밖으로 나가지 않게 자른다
    if (next < 0) { next = 0; p.movingDir = 1 }
    if (next + p.width > C.LOGICAL_W) { next = C.LOGICAL_W - p.width; p.movingDir = -1 }

    p.x = next

    // 이 발판 위에 서 있으면 플레이어도 같이 옮긴다
    if (standingOn !== null && standingOn.id === p.id) {
      state.player.x += next - before
      if (state.player.x < 0) state.player.x = 0
      const maxX = C.LOGICAL_W - C.PLAYER_W
      if (state.player.x > maxX) state.player.x = maxX
    }
  }
}
