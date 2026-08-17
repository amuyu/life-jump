/**
 * 앱인토스 SDK 로더. 이 파일이 SDK 를 import 하는 유일한 지점이다.
 *
 * import 문자열을 **정적 리터럴**로 둔다 — 그래야 Vite 가 빌드 시 해석·번들링해서
 * 패키지를 설치하면 실제로 살아난다. (변수 + `@vite-ignore` 로 두면 번들에 bare
 * specifier `import("@apps-in-toss/web-framework")` 가 그대로 남고, 브라우저/WebView 는
 * node_modules 를 런타임에 해석하지 못하므로 설치해도 영원히 실패한다.)
 *
 * 패키지가 없는 환경(일반 웹 빌드·테스트)에서는 vite.config.ts 가 이 specifier 를
 * `src/toss/sdk-stub.ts` 로 alias 해 빌드가 깨지지 않게 한다 — 설치 여부에 따라
 * 자동으로 전환되며 코드를 고칠 필요가 없다.
 */
export async function loadTossSdk(): Promise<Record<string, unknown> | null> {
  try {
    return (await import('@apps-in-toss/web-framework')) as Record<string, unknown>
  } catch {
    // 스텁이 아닌데도 실패했다면 브리지 없는 브라우저 — 조용히 null
    return null
  }
}
