/**
 * 앱인토스 화면 제어 래퍼. 게임 코드는 이 모듈만 보고, SDK 유무·실패는 여기서 삼킨다.
 * 브라우저(SDK 없음)에서는 전부 no-op 이다.
 */

import { loadTossSdk } from './sdk'

export type SwipeBackFn =
  ((options: { isEnabled: boolean }) => Promise<void>) & { isSupported?: () => boolean }

/**
 * iOS 스와이프백 on/off. 호출은 직렬화된다 — 앞 요청이 네이티브에 도달하기 전에 다음을 보내면
 * 도착 순서가 뒤집혀 로비에서 스와이프백이 꺼진 채 남을 수 있다.
 *
 * 중복 스킵은 "네이티브에 실제로 적용된 값(또는 지금 적용 중인 값)" 기준이다. 요청 시점에
 * 기록해 두면 판 시작의 set(false) 가 일시 실패했을 때 그 판 내내 같은 요청이 스킵되어
 * 스와이프백이 켜진 채 남는다. 실패·미지원으로 보내지 못한 값은 기록하지 않아 다음 호출이
 * 다시 시도한다.
 */
export function createSwipeBack(loadSdk: () => Promise<SwipeBackFn | null>): { set(enabled: boolean): Promise<void> } {
  let chain: Promise<void> = Promise.resolve()
  /** 마지막으로 성공적으로 적용된 값 */
  let applied: boolean | null = null
  /** 큐에 들어가 아직 결과가 안 난 값 — 연달아 같은 값을 부르면 하나만 보낸다 */
  let pending: boolean | null = null

  const set = (enabled: boolean): Promise<void> => {
    if (pending === enabled || (pending === null && applied === enabled)) return chain
    pending = enabled
    chain = chain.then(async () => {
      let ok = false
      try {
        const fn = await loadSdk()
        if (fn !== null && (fn.isSupported === undefined || fn.isSupported())) {
          await fn({ isEnabled: enabled })
          ok = true
        }
      } catch {
        // SDK 없음·브리지 없음·네이티브 거부 — 게임 진행에 영향을 주지 않는다
      }
      if (ok) applied = enabled
      if (pending === enabled) pending = null
    })
    return chain
  }

  return { set }
}

// SDK import 자체는 src/toss/sdk.ts 가 한다 (정적 리터럴 import — 설치하면 진짜 번들됨,
// 미설치면 vite.config.ts 가 빈 스텁으로 alias). 여기서는 export 이름만 고른다.
// (export 이름은 스펙 7.4 선행 확인 항목 — 다르면 아래 한 줄만 고친다)
const SDK_EXPORT = 'setIosSwipeGestureEnabled'

async function loadFromSdk(): Promise<SwipeBackFn | null> {
  const mod = await loadTossSdk()
  const fn = mod?.[SDK_EXPORT]
  return typeof fn === 'function' ? (fn as SwipeBackFn) : null
}

const defaultSwipeBack = createSwipeBack(loadFromSdk)

export const setSwipeBack = (enabled: boolean): Promise<void> => defaultSwipeBack.set(enabled)
