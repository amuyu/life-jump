import { describe, it, expect } from 'vitest'
import { resolveLanding, stepMotion } from '../../src/game/physics'
import { createGameState, defaultModifiers, makePlatform } from '../../src/game/state'
import type { InputState } from '../../src/core/input'
import * as C from '../../src/constants'

const NONE: InputState = { left: false, right: false, jumpHeld: false, jumpPressed: false }

/** 발판 하나만 있는 상태를 만든다 */
function scene(platformY: number, platformX = 0, width = 40) {
  const s = createGameState(defaultModifiers())
  s.platforms = [makePlatform(1, platformX, platformY, width)]
  s.player.onGround = false
  return s
}

describe('resolveLanding', () => {
  it('하강 중 발판 상단을 가로지르면 착지한다', () => {
    const s = scene(100, 0, 60)
    s.player.x = 10
    s.player.prevY = 104
    s.player.y = 96
    s.player.vy = -200

    const hit = resolveLanding(s)
    expect(hit).not.toBeNull()
    expect(s.player.y).toBe(100)
    expect(s.player.vy).toBe(0)
    expect(s.player.onGround).toBe(true)
  })

  it('착지 시 prevY를 발판 y로 갱신하고 doubleJumpUsed를 리셋한다', () => {
    // prevY 리셋이 빠지면 이 값(104)이 착지 후에도 그대로 남는다 —
    // 다음 스윕 검사가 stale prevY를 보고 잘못 판정하는, 바로 이 태스크가
    // 경고하는 "간헐적으로만 드러나는" 버그다.
    const s = scene(100, 0, 60)
    s.player.x = 10
    s.player.prevY = 104
    s.player.y = 96
    s.player.vy = -200
    s.player.doubleJumpUsed = true

    const hit = resolveLanding(s)

    expect(hit).not.toBeNull()
    expect(s.player.prevY).toBe(100)
    expect(s.player.doubleJumpUsed).toBe(false)
  })

  it('상승 중에는 발판을 통과한다', () => {
    const s = scene(100, 0, 60)
    s.player.x = 10
    s.player.prevY = 96
    s.player.y = 104
    s.player.vy = 300

    expect(resolveLanding(s)).toBeNull()
    expect(s.player.onGround).toBe(false)
  })

  it('x축이 겹치지 않으면 착지하지 않는다', () => {
    const s = scene(100, 0, 40)
    s.player.x = 120           // 발판은 0~40
    s.player.prevY = 104
    s.player.y = 96
    s.player.vy = -200

    expect(resolveLanding(s)).toBeNull()
  })

  it('발판 바로 옆을 스치면(경계 접촉) 착지하지 않는다', () => {
    const s = scene(100, 0, 40)
    s.player.x = 40            // 발판 오른쪽 끝에 딱 붙음 — 겹침 폭 0
    s.player.prevY = 104
    s.player.y = 96
    s.player.vy = -200

    expect(resolveLanding(s)).toBeNull()
  })

  it('죽은 발판은 착지 대상이 아니다', () => {
    const s = scene(100, 0, 60)
    s.platforms[0]!.dead = true
    s.player.x = 10
    s.player.prevY = 104
    s.player.y = 96
    s.player.vy = -200

    expect(resolveLanding(s)).toBeNull()
  })

  it('여러 발판을 가로지르면 가장 높은 발판에 착지한다', () => {
    const s = createGameState(defaultModifiers())
    s.platforms = [
      makePlatform(1, 0, 90, 60),
      makePlatform(2, 0, 100, 60),
    ]
    s.player.onGround = false
    s.player.x = 10
    s.player.prevY = 110
    s.player.y = 85
    s.player.vy = -400

    const hit = resolveLanding(s)
    expect(hit?.id).toBe(2)
    expect(s.player.y).toBe(100)
  })
})

describe('resolveLanding — 관통 방지 (이 태스크의 존재 이유)', () => {
  it('최대 낙하 속도에서도 발판을 관통하지 않는다', () => {
    // 발판 두께 6px, 프레임당 이동 10px — 단순 겹침 검사라면 뚫린다
    const s = scene(500, 0, C.LOGICAL_W)
    s.player.x = 80
    s.player.y = 900
    s.player.prevY = 900
    s.player.vy = -C.MAX_FALL

    let landed = false
    for (let i = 0; i < 200; i++) {
      stepMotion(s, NONE, C.STEP)
      if (resolveLanding(s)) { landed = true; break }
    }

    expect(landed).toBe(true)
    expect(s.player.y).toBe(500)
  })

  it('여러 속도로 떨어뜨려도 항상 착지한다', () => {
    for (const startVy of [-100, -250, -400, -550, -600]) {
      const s = scene(300, 0, C.LOGICAL_W)
      s.player.x = 80
      s.player.y = 700
      s.player.prevY = 700
      s.player.vy = startVy

      let landed = false
      for (let i = 0; i < 300; i++) {
        stepMotion(s, NONE, C.STEP)
        if (resolveLanding(s)) { landed = true; break }
      }
      expect(landed, `vy=${startVy}에서 관통`).toBe(true)
      expect(s.player.y).toBe(300)
    }
  })
})
