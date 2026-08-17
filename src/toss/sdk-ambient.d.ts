/**
 * `@apps-in-toss/web-framework` 미설치 환경을 위한 임시 타입 선언.
 * src/toss/sdk.ts 의 정적 import 가 tsc 를 통과하게 한다. 실제 패키지를 설치하면
 * 그쪽 타입 선언이 우선하므로 이 파일은 그대로 두어도 무해하다 (설치 후 삭제해도 된다).
 * export 이름을 여기에 나열하지 않는 것은 의도다 — 스펙 7.4 선행 확인 전까지 어떤 이름도
 * 보장하지 않으므로, 소비자는 `Record<string, unknown>` 으로 받아 런타임에 typeof 검사한다.
 */
declare module '@apps-in-toss/web-framework'
