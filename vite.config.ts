import { defineConfig } from 'vite'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// 앱인토스 SDK 는 토스 앱 이식 시점에 설치된다. 그 전에는 src/toss/sdk.ts 의 정적
// import 가 해석되지 않아 빌드가 깨지므로, 패키지가 node_modules 에 없을 때만 빈 스텁으로
// alias 한다. 설치하면 alias 가 자동으로 꺼져 실제 SDK 가 번들된다 — 코드 수정 없음.
const TOSS_SDK = '@apps-in-toss/web-framework'
const tossSdkInstalled = existsSync(
  fileURLToPath(new URL(`./node_modules/${TOSS_SDK}/package.json`, import.meta.url)),
)

export default defineConfig({
  base: './',
  resolve: {
    alias: tossSdkInstalled
      ? []
      : [{ find: TOSS_SDK, replacement: fileURLToPath(new URL('./src/toss/sdk-stub.ts', import.meta.url)) }],
  },
})
