// 논리 해상도
export const LOGICAL_W = 180
export const LOGICAL_H = 320

// 타임스텝
export const STEP = 1 / 60
export const MAX_STEPS_PER_FRAME = 6
// 한 프레임에 처리할 시간 상한(초). 독립 상수로 두면 부동소수점 경계에서
// MAX_STEPS_PER_FRAME과 어긋날 수 있으므로 파생시킨다. STEP * 6 === 0.1 (정확).
export const MAX_FRAME_DELTA = STEP * MAX_STEPS_PER_FRAME

// 물리 (스펙 4절 — 변경 금지)
export const GRAVITY = 1200
export const JUMP_V = 480
export const JUMP_CUTOFF = 300
export const MOVE_SPEED = 90
export const MAX_FALL = 600
export const SPRING_V = 750
export const CRUMBLE_DELAY = 0.3
/**
 * 부서진 발판이 되살아나기까지의 시간(초).
 * 발판 생성은 사다리 한 줄이라 곁가지가 없다 — 부서지는 발판의 약 2/3은 위아래를
 * 잇는 유일한 통로여서, 영구히 사라지면 떨어져 되돌아왔을 때 길이 끊긴다.
 * 되살아나게 두면 그 막힘이 스스로 풀린다. 올라가는 중에는 이미 지나친 뒤라
 * 체감되지 않고, 부순 직후 곧바로 떨어진 경우에만 잠깐 기다리게 된다.
 */
export const CRUMBLE_RESPAWN = 3

// 파생값
export const MAX_JUMP_HEIGHT = (JUMP_V * JUMP_V) / (2 * GRAVITY)  // 96
export const MAX_GAP_Y = 88               // 96에서 안전 여백 8 차감

// 크기
export const PLAYER_W = 12
export const PLAYER_H = 16
export const PLATFORM_THICKNESS = 6

// 카메라 / 생존
export const CAMERA_FOLLOW_OFFSET = LOGICAL_H * 0.6   // 192
export const FALL_LINE_OFFSET = -16       // camera.y + 이 값보다 낮으면 낙하
export const REVIVE_MIN_MARGIN = 40       // 부활 후보는 camera.y + 40 이상
export const RESCUE_MARGIN = 60           // 구조 발판은 camera.y + 60
export const INVULN_SECONDS = 1.5
// 시작 카메라를 시작 높이(baseY)보다 이만큼 아래에 두어, 화면 하단에 땅이
// 보이도록 여유를 둔다 (createGameState가 사용).
export const GROUND_VIEW_MARGIN = 40

// 구간 경계 (10px = 1m 이므로 300m / 900m)
// 발판 종류 결정(Task 10)과 배경 보간(Task 12)이 함께 쓰므로 여기 둔다.
export const SKY_START_Y = 3000
export const SPACE_START_Y = 9000

// 단위
export const PX_PER_M = 10

// 발판
export const PLATFORM_W_START = 40
export const PLATFORM_W_MIN = 24
export const GAP_Y_MIN = 32
export const GAP_Y_START_MAX = 48
export const GAP_Y_MAX = 72
export const DIFFICULTY_FULL_Y = 9000    // 900m — 우주 진입 시 최대 난이도
export const MOVING_RANGE = 20           // 중심에서 ±20px
export const MOVING_SPEED = 25           // px/s
export const PRUNE_MARGIN = 40           // 카메라 아래 이만큼 벗어나면 폐기
export const GENERATE_AHEAD = LOGICAL_H  // 카메라 위로 한 화면 앞서 생성

// 아이템
export const ITEM_PICKUP_PAD = 6
export const FOOD_TO_COIN = 3      // 에너지 가득일 때 음식이 주는 코인
