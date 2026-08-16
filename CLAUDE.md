# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`life-jump` — 픽셀 아트 수직 점프 게임. 발판을 밟고 올라가며 높이를 겨루고, 중간에 퀴즈로 실·코인·에너지를 얻는다.
목표: **앱인토스(Apps in Toss) 미니앱으로 출시** — 아래 "앱인토스(Toss) 이식" 절이 그 준비 내용이다.

## Tech Stack

- Vanilla TypeScript + Vite (React 없음, 프레임워크 없음)
- Canvas 2D 렌더링 (논리 해상도 180×320, 정수 배율 + `image-rendering: pixelated`)
- 백엔드 없음 — 모든 상태는 localStorage (`life-jump-save-v1`)
- 테스트: Vitest

## Commands

- `npm test` — 전체 테스트 1회 실행
- `npm run test:watch` — 워치 모드
- `npm run build` — `tsc --noEmit` 후 vite build (타입 체크가 빌드 게이트)
- `npm run dev` — 개발 서버
- `npm run preview` — 빌드 결과 미리보기

## Architecture

```
src/
  main.ts        진입점 — 렌더 루프, 화면 전환, save 소유
  runFlow.ts     판 시작/종료 결산 (순수 로직, DOM 무관)
  constants.ts   물리·크기·구간 경계 상수 (스펙 4절 — 물리값 변경 금지)
  game/          순수 게임 로직 (state, physics, platforms, items, quiz, zones, camera, survival, update)
  render/        canvas, sprites, drawGame, drawHud, pixelmaps
  ui/            DOM UI — shell(탭바), lobby, shop, wardrobe, loadout, records, result, quizModal
  core/          loop(고정 타임스텝), input(키보드), storage(세이브), rng(시드 난수)
  toss/          앱인토스 SDK 래퍼 (screen.ts: 스와이프백). SDK 미설치 환경에서는 no-op
  data/          outfits, shop, pixelmaps, quiz.json
```

### 계층 경계 (tests/architecture.test.ts가 강제)

`src/game/` 안에서는 아래를 참조할 수 없다 — 위반 시 테스트 실패:

- `render/`, `ui/` import
- `document`, `window`, `localStorage`
- `Math.random` 직접 호출 (반드시 `core/rng`의 시드 RNG를 주입받을 것)

### 세이브 마이그레이션 규약

`src/core/storage.ts`의 `parseSave()`는 5단계 고정:
파싱 → 버전별 순차 `migrate()` → 기본값과 깊은 병합 → 유효성 검증·보정 → 재저장(`loadSave`).
스키마를 바꿀 때는 `SAVE_VERSION`을 올리고 `migrate()`에 단계를 추가한다. 순수 추가 필드라도 version만 전진시켜 다음 마이그레이션의 이어받을 지점을 남긴다.

### 입력 소스 규약

- 키보드와 터치는 `core/input.ts` 안에서 소스별 상태를 가지며 스냅샷에서 OR 된다. 새 입력 소스는
  `press/release(action, source)` 를 부르는 얇은 층으로 붙인다 — `InputState` 는 바꾸지 않는다.
- 터치 판정 상수(`DEAD`, `FOLLOW`)는 `core/touch.ts` 상단. `FOLLOW > DEAD` 불변식.
- 모달을 닫을 때는 `input.reset()` + `touch.reset()`, 페이지 복귀·판 종료에는 `touch.clear()`
  (detach 가 대신 부른다). 둘을 바꿔 쓰면 죽은 손가락이 존을 영구 점유하거나 첫 점프를 먹는다.
- 설계: `docs/superpowers/specs/2026-08-17-touch-controls-design.md`

---

# 앱인토스(Toss) 이식

> 참조 원본: `~/private/work/private-works/ai/eye-training` (이미 앱인토스에 출시된 프로젝트).
> 아래 내용은 그 프로젝트에서 검증된 사항을 옮긴 것이다.

## 개발 지원 · 외부 문서

- 개발 막힐 때 질문: https://techchat-apps-in-toss.toss.im/
- [앱인토스 Bedrock 개발 가이드 (소개)](https://developers-apps-in-toss.toss.im/bedrock/intro.html)
- [인앱 광고 소개 (전면/리워드/배너 종류, eCPM, 광고 그룹 설정)](https://developers-apps-in-toss.toss.im/ads/intro.html)
- [인앱 광고 2.0 ver2 API (loadFullScreenAd/showFullScreenAd, 이벤트 타입, 주의사항)](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/IntegratedAd.html)
- [광고 테스트 방법 및 테스트용 광고 ID](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/IntegratedAd.html#%E1%84%90%E1%85%A6%E1%84%89%E1%85%B3%E1%84%90%E1%85%B3%E1%84%92%E1%85%A1%EA%B8%B0)
- [프로모션 리워드 지급 API (grantPromotionReward, 토스 포인트 지급)](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EB%B9%84%EA%B2%8C%EC%9E%84/promotion.html)
- [스마트 메시지 소개 (세그먼트/발송 시점 최적화, 기능성·광고성 구분, 검수 정책)](https://developers-apps-in-toss.toss.im/smart-message/intro.html)
- [스마트 메시지 발송 API (send-message/send-bulk-message, x-toss-user-key 인증, mTLS 필수)](https://developers-apps-in-toss.toss.im/smart-message/develop.html)

## 빌드 · 배포 (Granite / ait)

앱인토스 미니앱은 Granite 프레임워크 위에서 돌아간다. 현재 순수 Vite 설정에 다음을 얹는다.

```jsonc
// package.json — eye-training에서 쓰는 형태
{
  "scripts": {
    "dev": "granite dev",      // 로컬은 vite로 dev:vite 별도 유지
    "dev:vite": "vite",
    "build": "ait build",
    "deploy": "ait deploy"
  },
  "dependencies": {
    "@apps-in-toss/web-framework": "^2.5.0"
  }
}
```

```ts
// granite.config.ts
import { defineConfig } from '@apps-in-toss/web-framework/config'

export default defineConfig({
  appName: 'life-jump',
  brand: {
    displayName: '<한글 표시명>',
    primaryColor: '#RRGGBB',
    icon: 'https://<호스팅된 로고 URL>',
  },
  web: {
    host: '0.0.0.0',
    port: 5173,
    commands: { dev: 'vite', build: 'vite build' },
  },
  webViewProps: {
    mediaPlaybackRequiresUserAction: false,   // 사용자 제스처 없이 오디오/비디오 재생 허용
  },
  permissions: [],
  outdir: 'dist',
})
```

`.granite/app.json`에 `appName`·`permissions`가 함께 기록된다.

## SDK 사용 패턴

앱인토스 SDK는 **토스 앱 WebView 안에서만** 브리지가 존재한다. 일반 브라우저에서는 없다.
따라서 **정적 import 금지 — 항상 동적 import + `isSupported()` 가드**로 감싼다.

```ts
// 토스 앱 안인지 판별
import('@apps-in-toss/web-framework').then(({ loadFullScreenAd }) => {
  try {
    if (loadFullScreenAd.isSupported()) { /* 토스 앱 */ }
  } catch {
    // 토스 브리지 없는 환경 — 무시하고 일반 웹으로 동작
  }
})
```

이 프로젝트는 React가 아니므로 eye-training의 훅(`useRewardedAd` 등)을 그대로 못 쓴다.
대신 **상태를 가진 싱글턴 모듈**로 옮긴다 (eye-training의 `src/lib/fullScreenAdManager.ts`가 이미 그 형태 — 훅은 얇은 어댑터일 뿐이다).

## 광고 (Ads)

### 광고 테스트 ID (개발용)

- 리워드 광고: `ait-ad-test-rewarded-id`
- 전면형 광고: `ait-ad-test-interstitial-id`
- 네이티브/배너: `ait-ad-test-native-image-id`
- ⚠️ 실제 광고 ID로 테스트하면 **정책 위반** — 반드시 테스트 ID 사용
- ⚠️ 샌드박스 환경에서는 광고 미지원 — 앱인토스 콘솔 QR 코드로 **실제 Toss 앱**에서 테스트
- 광고 그룹 ID는 `.env.local`에 `VITE_TOSS_REWARD_AD_GROUP_ID` / `VITE_TOSS_BANNER_AD_GROUP_ID` 로 주입

### 전면/리워드 광고 (`loadFullScreenAd` / `showFullScreenAd`)

- **load와 show가 분리**돼 있다. `loadFullScreenAd({options:{adGroupId}, onEvent, onError})`가 cleanup 함수를 반환하고, `onEvent`에 `type: 'loaded'`가 오면 표시 가능.
- 표시 후 `dismissed` 이벤트를 받으면 **다음 광고를 즉시 재로드**해야 한다. 안 하면 두 번째 탭부터 무반응.
- 보상형 이벤트 순서: `userEarnedReward` → `dismissed`.
  `dismissed`에서 무조건 `onDismissed`를 부르면 이미 보상 처리 중인 상태를 idle로 덮어쓴다 → `earned` 플래그로 조건부 호출.
- **무응답 방어**: 로드 요청 후 응답이 없을 수 있다. `LOAD_STALE_MS`(10초) 경과 또는 로드 실패 플래그가 서 있으면 탭 시 재로드. 대기 상태는 `PENDING_TIMEOUT_MS`(15초)에 풀고 실패 안내 → 한참 뒤 광고가 튀어나오는 것을 막는다.
- **show 실패 시 상태 복구**: `onError`에서 `isShowing`/`pending`을 되돌리고 재로드하지 않으면 영구 무반응에 빠진다.
- 로드 상태는 화면 수명과 분리한 **앱 전역 싱글턴**에 둔다 — 앱 시작 시 프리로드해서 버튼 탭 때 대기 확률을 줄인다.

### 배너 광고 (`TossAds.attachBanner`)

- `TossAds.initialize({ callbacks: { onInitialized, onInitializationFailed } })`를 **성공했을 때만** 초기화 플래그를 세운다. 실패 시 플래그를 올리면 재시도 경로가 영구히 막힌다.
- `attachBanner(adGroupId, targetEl, { theme: 'auto', variant: 'expanded' })` → `{ destroy? }` 반환. 언마운트 시 반드시 `destroy()`.

### 하루 광고 시청 제한

localStorage에 `{ date, count }`로 저장하고 날짜가 바뀌면 0으로 리셋. 읽을 때 `Math.min(LIMIT, Math.max(0, floor(n)))`로 클램프 (eye-training `useDailyAdLimit.ts` 참고).

### 광고 실패 원격 수집

광고 로드/표시 실패를 서버에 기록하면 원인 진단이 가능하다. **수집 실패가 광고 플로우를 절대 깨뜨리지 않도록** try/catch로 완전히 삼킬 것. 메시지는 500자로 잘라 저장.

## 토스 로그인 + Supabase (계정 연동이 필요해지면)

현재 life-jump는 localStorage 단독이라 로그인이 없어도 동작한다. 랭킹·기기 간 동기화가 필요해질 때만 도입한다.

### 인증 플로우

```
1. 클라이언트: Toss SDK appLogin() → authorizationCode (유효 10분)
2. POST /functions/v1/toss-auth { authorizationCode }
   [Edge Function]
   3. POST https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/generate-token
   4. GET  .../oauth2/login-me  (Bearer)  → AES-256-GCM 암호화된 사용자 정보
   5. 복호화 → sub(=userKey), name, phone
   6. toss_sub으로 users 조회 → 없으면 admin.createUser({ email: `toss_${sub}@app.internal` })
   7. admin.generateLink({ type:'magiclink' }) → hashed_token
   8. 응답 { token_hash }   ← Toss 토큰이 아니다
9. 클라이언트: supabase.auth.verifyOtp({ token_hash, type:'email' }) → 정상 Supabase 세션
```

- 연결 끊기 콜백: `toss-disconnect` Edge Function (Basic Auth). body `{ sub, referrer: 'UNLINK'|'WITHDRAWAL_TERMS'|'WITHDRAWAL_TOSS' }` → 해당 유저 삭제.
- **개발/브라우저 QA**: `appLogin()`은 토스 WebView 안에서만 동작한다. `VITE_DEV_AUTH=true`일 때 `dev-auth` Edge Function(`DEV_AUTH_SECRET` 검증)으로 우회. 프로덕션에는 배포하지 않는다.
- 실제 플로우 QA는 콘솔에 등록한 **테스트 계정(최대 30개)** + QR 코드로.

### Edge Function Secrets

```
TOSS_CLIENT_ID, TOSS_CLIENT_SECRET      # 콘솔 발급
TOSS_DECRYPT_KEY, TOSS_DECRYPT_AAD      # AES-256-GCM 복호화 키 (등록 후 이메일 수신)
TOSS_DISCONNECT_USER, TOSS_DISCONNECT_PASS
SUPABASE_SERVICE_ROLE_KEY               # 자동 주입
```

프론트: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Toss 파트너 API mTLS (Deno / Supabase Edge Function)

- Toss 파트너 API(`apps-in-toss-api.toss.im`)는 **mTLS 필수** — 인증서 없이 요청하면 `received fatal alert: CertificateRequired`
- `Deno.createHttpClient()`의 클라이언트 인증서 옵션 키는 **`cert`와 `key`**다. `certChain`/`privateKey`는 조용히 무시된다.
  ```ts
  // ❌ 잘못된 키 이름 — 런타임이 인증서를 TLS에 싣지 않음
  Deno.createHttpClient({ certChain, privateKey })
  // ✅ 올바른 키 이름
  Deno.createHttpClient({ cert, key })
  ```
- 인증서/키는 PEM을 base64로 인코딩해 Supabase Secret에 저장(`TOSS_CLIENT_CERT_B64`, `TOSS_CLIENT_KEY_B64`), 함수에서 `atob`으로 디코딩해 사용
- macOS에서는 `base64 파일경로`가 아니라 **`base64 -b 0 -i 파일경로`** (`-i` 필수, `-b 0`으로 줄바꿈 제거)

## 오디오 / 음성 (사운드를 넣게 될 경우)

- **Web Speech API(`speechSynthesis`) 사용 금지** — iOS WebView와 일부 Android WebView에서 동작하지 않음
- 음성/효과음은 파일(mp3)로 두고 맵에 등록해 재생
- 자동재생이 필요하면 `granite.config.ts`의 `webViewProps.mediaPlaybackRequiresUserAction: false`

## 콘솔 등록 준비사항

| 항목 | 내용 |
|---|---|
| 파트너 등록 | Apps in Toss 개발자 콘솔에서 앱 등록 신청 |
| Client ID 발급 | 콘솔 발급 → `TOSS_CLIENT_ID` |
| 동의 항목 신청 | 필요한 항목만 (이름/전화번호 등, CI는 별도) |
| 복호화 키 수신 | 등록 후 이메일로 AES-256-GCM 키 수신 |
| 연결 끊기 콜백 URL | Edge Function URL 등록 |
| 광고 그룹 생성 | 리워드/전면/배너 각각 광고 그룹 ID 발급 |
| 앱 심사 제출 | 이용약관 URL, 개인정보처리방침 URL, 수집 항목 |

---

## life-jump 이식 시 정리 필요한 지점

현재 구조와 앱인토스 요구사항 사이의 실제 격차 — 착수 전 결정/작업이 필요한 것들.

| 영역 | 현재 | 이식 시 필요한 것 |
|---|---|---|
| **입력** | `core/input.ts`가 키보드 전용 (`handleKeyDown/Up`, `input.attach(window, …)`) | 완료 — 터치 스펙 참조. 실기기 검증(9절 체크리스트) 남음. 스와이프백은 SDK 설치 후 검증 필요(스펙 7.4) |
| **화면 맞춤** | `render/canvas.ts`가 정수 배율만 사용 (`Math.floor`) | 세로 모바일에서 여백이 크게 남을 수 있음. safe-area·노치 대응 확인 필요 |
| **빌드** | 순수 Vite (`vite build`) | `granite.config.ts` + `ait build`/`ait deploy`로 전환. `web.commands`에 기존 vite 커맨드를 위임 |
| **SDK 호출부** | 없음 | React 훅이 아니므로 싱글턴 모듈(`src/toss/*`)로 작성. `game/`·`render/` 계층에는 절대 넣지 않는다 (architecture.test.ts 경계 유지) |
| **광고 삽입 지점** | 없음 | 후보: 판 종료 후 결과 화면(전면), "이어하기/부활"(리워드), 상점의 코인·실 획득(리워드), 로비 하단(배너). 하루 시청 제한 로직 동반 |
| **세이브** | localStorage 단독 | WebView에서도 동작하므로 그대로 유지 가능. 기기 간 동기화/랭킹이 필요할 때만 Supabase 도입 |
| **환경변수** | 없음 | `.env.local`에 `VITE_TOSS_*_AD_GROUP_ID` 추가. `.gitignore` 확인 |
| **에셋 호스팅** | 없음 | `brand.icon`은 외부 URL이어야 함 — 로고를 어딘가에 호스팅 |
| **오디오** | 없음 | 넣는다면 mp3 파일 방식만 사용 (`speechSynthesis` 금지) |

## 수익 구조 참고 (eye-training 실측)

`~/private/work/private-works/ai/eye-training/docs/` 아래에 실측 데이터가 있다.

- `guide/ad-revenue-2026-06.md` — eCPM·실수령·프로모션 비용 종합, 광고별 비중
- `superpowers/specs/2026-06-02-eye-box-reward-design.md` — 보상 설계, 수익 타당성, 광고 단가 정산 방식
- `guide/change-reward-amount.md` — 확률 테이블·변경 위치 목록
