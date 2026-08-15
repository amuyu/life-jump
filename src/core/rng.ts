export interface Rng {
  next(): number
  range(min: number, max: number): number
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const range = (min: number, max: number): number => min + next() * (max - min)

  const int = (min: number, max: number): number =>
    Math.floor(range(min, max + 1))

  const pick = <T,>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error('pick() on empty array')
    return items[int(0, items.length - 1)]!
  }

  return { next, range, int, pick }
}
