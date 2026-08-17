import { describe, it, expect, vi } from 'vitest'
import { createSwipeBack, type SwipeBackFn } from '../../src/toss/screen'

/** 호출 순서를 손으로 풀어주는 SDK 흉내 */
function deferredSdk() {
  const calls: boolean[] = []
  const resolvers: Array<() => void> = []
  const fn = vi.fn((o: { isEnabled: boolean }) => new Promise<void>((resolve) => {
    calls.push(o.isEnabled)
    resolvers.push(resolve)
  })) as unknown as SwipeBackFn
  return { fn, calls, resolveNext: () => { resolvers.shift()?.() } }
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0))

describe('createSwipeBack', () => {
  it('SDK 가 없으면 아무 것도 하지 않고 resolve 한다', async () => {
    const sb = createSwipeBack(async () => null)
    await expect(sb.set(false)).resolves.toBeUndefined()
  })

  it('isSupported 가 false 면 부르지 않는다', async () => {
    const sdk = deferredSdk()
    sdk.fn.isSupported = () => false
    const sb = createSwipeBack(async () => sdk.fn)
    await sb.set(false)
    expect(sdk.calls).toEqual([])
  })

  it('호출을 직렬화한다 — 앞 호출이 끝나기 전에는 다음을 보내지 않는다', async () => {
    const sdk = deferredSdk()
    const sb = createSwipeBack(async () => sdk.fn)
    void sb.set(false)
    void sb.set(true)
    await flush()
    expect(sdk.calls).toEqual([false])      // 두 번째는 대기 중
    sdk.resolveNext()
    await flush()
    expect(sdk.calls).toEqual([false, true])
  })

  it('마지막으로 요청한 값과 같으면 스킵한다', async () => {
    // SDK 호출은 chain.then 안에서 비동기로 시작된다 — resolveNext 는 반드시 호출이
    // 실제로 일어난 것을(calls) 확인한 뒤에 부른다. 그 전에 부르면 빈 큐를 건드릴 뿐이다.
    const sdk = deferredSdk()
    const sb = createSwipeBack(async () => sdk.fn)
    void sb.set(false)
    await flush()
    expect(sdk.calls).toEqual([false])
    sdk.resolveNext()
    await flush()

    void sb.set(false)                       // 같은 값 — 보내지 않는다
    await flush()
    expect(sdk.calls).toEqual([false])

    void sb.set(true)
    await flush()
    expect(sdk.calls).toEqual([false, true])
    sdk.resolveNext()
    await flush()
  })

  it('SDK 가 던져도 삼키고 다음 호출은 계속된다', async () => {
    let n = 0
    const fn = vi.fn(async () => { n += 1; if (n === 1) throw new Error('boom') }) as unknown as SwipeBackFn
    const sb = createSwipeBack(async () => fn)
    await expect(sb.set(false)).resolves.toBeUndefined()
    await sb.set(true)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('로더가 던져도 삼킨다', async () => {
    const sb = createSwipeBack(async () => { throw new Error('no module') })
    await expect(sb.set(false)).resolves.toBeUndefined()
  })

  it('네이티브 호출이 실패하면 같은 값을 다시 요청할 수 있다', async () => {
    // 중복 스킵은 "마지막으로 성공한 값" 기준이어야 한다. 요청 시점에 기록하면
    // 판 시작의 set(false) 가 일시 실패했을 때 그 판 내내 재시도가 막혀 스와이프백이
    // 켜진 채 남는다.
    let n = 0
    const fn = vi.fn(async () => { n += 1; if (n === 1) throw new Error('bridge busy') }) as unknown as SwipeBackFn
    const sb = createSwipeBack(async () => fn)
    await sb.set(false)                       // 실패 (삼킴)
    await sb.set(false)                       // 재시도 — 보내야 한다
    expect(fn).toHaveBeenCalledTimes(2)
    await sb.set(false)                       // 이번엔 성공한 뒤라 스킵
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('SDK 미지원으로 보내지 못한 값도 다음에 다시 시도한다', async () => {
    // isSupported 가 false 인 동안은 성공한 적이 없으므로 기록하지 않는다 —
    // 브리지가 늦게 살아나는 환경에서 첫 요청이 영구히 스킵되면 안 된다.
    const sdk = deferredSdk()
    let supported = false
    sdk.fn.isSupported = () => supported
    const sb = createSwipeBack(async () => sdk.fn)
    await sb.set(false)
    expect(sdk.calls).toEqual([])
    supported = true
    void sb.set(false)
    await flush()
    expect(sdk.calls).toEqual([false])
    sdk.resolveNext()
    await flush()
  })
})
