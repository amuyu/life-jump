/**
 * 앱인토스 화면 제어 래퍼. 게임 코드는 이 모듈만 보고, SDK 유무·실패는 여기서 삼킨다.
 * 브라우저(SDK 없음)에서는 전부 no-op 이다.
 */

export type SwipeBackFn =
  ((options: { isEnabled: boolean }) => Promise<void>) & { isSupported?: () => boolean }

/**
 * iOS 스와이프백 on/off. 호출은 직렬화된다 — 앞 요청이 네이티브에 도달하기 전에 다음을 보내면
 * 도착 순서가 뒤집혀 로비에서 스와이프백이 꺼진 채 남을 수 있다. 마지막으로 요청한 값과 같은
 * 요청은 보내지 않는다.
 */
export function createSwipeBack(loadSdk: () => Promise<SwipeBackFn | null>): { set(enabled: boolean): Promise<void> } {
  let chain: Promise<void> = Promise.resolve()
  let lastRequested: boolean | null = null

  const set = (enabled: boolean): Promise<void> => {
    if (lastRequested === enabled) return chain
    lastRequested = enabled
    chain = chain.then(async () => {
      try {
        const fn = await loadSdk()
        if (fn === null) return
        if (fn.isSupported !== undefined && !fn.isSupported()) return
        await fn({ isEnabled: enabled })
      } catch {
        // SDK 없음·브리지 없음·네이티브 거부 — 게임 진행에 영향을 주지 않는다
      }
    })
    return chain
  }

  return { set }
}

// 패키지 이름을 변수에 두어 Vite 가 빌드 시 해석하지 않게 한다 — 아직 설치되지 않은
// 환경(일반 웹 빌드)에서는 런타임 import 가 실패하고 위 try/catch 가 삼킨다.
// 앱인토스 이식 시 @apps-in-toss/web-framework 를 설치하면 그대로 살아난다.
// (export 이름은 스펙 7.4 선행 확인 항목 — 다르면 아래 한 줄만 고친다)
const SDK_MODULE = '@apps-in-toss/web-framework'
const SDK_EXPORT = 'setIosSwipeGestureEnabled'

async function loadFromSdk(): Promise<SwipeBackFn | null> {
  const mod = (await import(/* @vite-ignore */ SDK_MODULE)) as Record<string, unknown>
  const fn = mod[SDK_EXPORT]
  return typeof fn === 'function' ? (fn as SwipeBackFn) : null
}

const defaultSwipeBack = createSwipeBack(loadFromSdk)

export const setSwipeBack = (enabled: boolean): Promise<void> => defaultSwipeBack.set(enabled)
