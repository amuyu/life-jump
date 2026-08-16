export const SAVE_KEY = 'life-jump-save-v1'
export const SAVE_VERSION = 3
export const DEFAULT_OUTFIT_ID = 'basic-tee'

/** 최근 플레이 차트의 막대 개수와 같아야 한다. */
export const RECENT_RUNS_MAX = 8

/**
 * 소모품 재고 상한. 로드 시 클램프하는 값과 구매 시 막는 값이 같아야 한다 —
 * 어긋나면 상한을 넘겨 산 만큼이 다음 로드에서 조용히 사라진다.
 */
export const CONSUMABLE_MAX = 99

export const UPGRADE_MAX = {
  jump: 3,
  energy: 2,
  air: 2,
  magnet: 2,
} as const

export interface SaveData {
  version: number
  /** 최고 기록 (px). 게임 내 모든 높이는 px 단위이며, 표시할 때만 PX_PER_M로 나눈다 */
  bestHeight: number
  totalRuns: number
  thread: number
  coins: number
  ownedOutfits: string[]
  equippedOutfit: string
  upgrades: { jump: number; energy: number; air: number; magnet: number }
  consumables: { rocket: number; feather: number; cushion: number; doubleJump: number }
  selectedConsumables: string[]
  seenQuizIds: string[]
  /** 최근 판의 maxHeight (px), 오래된 것이 앞. 최대 RECENT_RUNS_MAX개 */
  recentRuns: number[]
  /** 첫 판 조작 안내를 이미 보여줬는가 (터치/키보드 공통) */
  controlsHintSeen: boolean
}

export interface ValidIds {
  outfits: ReadonlySet<string>
  consumables: ReadonlySet<string>
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    bestHeight: 0,
    totalRuns: 0,
    thread: 0,
    coins: 0,
    ownedOutfits: [DEFAULT_OUTFIT_ID],
    equippedOutfit: DEFAULT_OUTFIT_ID,
    upgrades: { jump: 0, energy: 0, air: 0, magnet: 0 },
    consumables: { rocket: 0, feather: 0, cushion: 0, doubleJump: 0 },
    selectedConsumables: [],
    seenQuizIds: [],
    recentRuns: [],
    controlsHintSeen: false,
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** 유한한 정수로 강제하고 범위를 자른다. 이상하면 fallback. */
function num(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, Math.floor(v)))
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}

/** strArray의 숫자판. 유한한 정수로 강제·범위를 자르고, 뒤에서부터 cap개만 남긴다. */
function numArray(v: unknown, max: number, cap: number): number[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
    .map((x) => Math.min(max, Math.max(0, Math.floor(x))))
    .slice(-cap)
}

/** 2단계: 버전별 순차 마이그레이션 */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const version = typeof raw['version'] === 'number' ? raw['version'] : 0
  let cur = raw

  // v0 (version 필드 없던 초기 저장) → v1
  if (version < 1) {
    cur = { ...cur, version: 1 }
  }

  // v1 → v2: recentRuns 필드 추가. 순수 추가 필드라 3단계 필드별 병합이
  // 기본값([])을 채워주므로 여기서 데이터를 옮길 필요는 없다 — version
  // 번호만 전진시켜 다음 마이그레이션이 이어받을 지점을 남긴다.
  if ((cur['version'] as number) < 2) {
    cur = { ...cur, version: 2 }
  }

  // v2 → v3: controlsHintSeen 필드 추가. 순수 추가 필드라 3단계 병합이 기본값(false)을
  // 채워준다 — version 번호만 전진시킨다.
  if ((cur['version'] as number) < 3) {
    cur = { ...cur, version: 3 }
  }

  return cur
}

export function parseSave(raw: string | null, valid: ValidIds): SaveData {
  const base = defaultSave()

  // 1단계: 파싱
  if (raw === null) return base

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return base
  }
  if (!isObject(parsed)) return base

  // 2단계: 마이그레이션
  const migrated = migrate(parsed)

  // 3단계: 기본값과 깊은 병합 — 있는 값은 보존한다
  const upgradesRaw = isObject(migrated['upgrades']) ? migrated['upgrades'] : {}
  const consumablesRaw = isObject(migrated['consumables']) ? migrated['consumables'] : {}

  const merged: SaveData = {
    version: SAVE_VERSION,
    bestHeight: num(migrated['bestHeight'], 0, Number.MAX_SAFE_INTEGER, base.bestHeight),
    totalRuns: num(migrated['totalRuns'], 0, Number.MAX_SAFE_INTEGER, base.totalRuns),
    thread: num(migrated['thread'], 0, Number.MAX_SAFE_INTEGER, base.thread),
    coins: num(migrated['coins'], 0, Number.MAX_SAFE_INTEGER, base.coins),
    ownedOutfits: strArray(migrated['ownedOutfits']),
    equippedOutfit:
      typeof migrated['equippedOutfit'] === 'string'
        ? migrated['equippedOutfit']
        : base.equippedOutfit,
    upgrades: {
      jump: num(upgradesRaw['jump'], 0, UPGRADE_MAX.jump, 0),
      energy: num(upgradesRaw['energy'], 0, UPGRADE_MAX.energy, 0),
      air: num(upgradesRaw['air'], 0, UPGRADE_MAX.air, 0),
      magnet: num(upgradesRaw['magnet'], 0, UPGRADE_MAX.magnet, 0),
    },
    consumables: {
      rocket: num(consumablesRaw['rocket'], 0, CONSUMABLE_MAX, 0),
      feather: num(consumablesRaw['feather'], 0, CONSUMABLE_MAX, 0),
      cushion: num(consumablesRaw['cushion'], 0, CONSUMABLE_MAX, 0),
      doubleJump: num(consumablesRaw['doubleJump'], 0, CONSUMABLE_MAX, 0),
    },
    selectedConsumables: strArray(migrated['selectedConsumables']),
    seenQuizIds: strArray(migrated['seenQuizIds']),
    recentRuns: numArray(migrated['recentRuns'], Number.MAX_SAFE_INTEGER, RECENT_RUNS_MAX),
    controlsHintSeen: migrated['controlsHintSeen'] === true,
  }

  // 4단계: 유효성 검증·보정
  merged.ownedOutfits = merged.ownedOutfits.filter((id) => valid.outfits.has(id))
  if (!merged.ownedOutfits.includes(DEFAULT_OUTFIT_ID)) {
    merged.ownedOutfits.unshift(DEFAULT_OUTFIT_ID)
  }
  if (!merged.ownedOutfits.includes(merged.equippedOutfit)) {
    merged.equippedOutfit = DEFAULT_OUTFIT_ID
  }
  merged.selectedConsumables = [
    ...new Set(merged.selectedConsumables.filter((id) => valid.consumables.has(id))),
  ]

  return merged
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  } catch {
    // 용량 초과·프라이빗 모드 — 저장 실패로 게임이 멈춰서는 안 된다
  }
}

export function loadSave(valid: ValidIds): SaveData {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(SAVE_KEY)
  } catch {
    raw = null
  }

  const data = parseSave(raw, valid)
  writeSave(data)   // 5단계: 보정 결과 재저장
  return data
}
