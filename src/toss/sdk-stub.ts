/**
 * `@apps-in-toss/web-framework` 미설치 환경에서 vite.config.ts 가 대신 붙이는 빈 모듈.
 * 아무 export 도 없으므로 loadTossSdk() 가 돌려주는 객체에서 어떤 함수도 찾히지 않고,
 * 모든 SDK 래퍼는 no-op 으로 떨어진다. 패키지를 설치하면 alias 가 꺼져 이 파일은 쓰이지 않는다.
 */
export {}
