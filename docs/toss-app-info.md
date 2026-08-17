# 앱인토스 콘솔 — 앱 정보

앱인토스 개발자 콘솔 "기본 정보" 폼에 넣는 텍스트. 콘솔에 붙여 넣은 값과 이 파일을 같게 유지한다 —
심사 반려로 문구를 고치면 여기도 고친다.

## 앱 이름

| 항목 | 값 | 제한 |
|---|---|---|
| 한국어 앱 이름 | 라이프 점프 | 10자 |
| 영어 앱 이름 | Life Jump | 15자 |

## 부제 (20자)

> 끝없이 올라가는 픽셀 점프 게임

## 한 줄 소개 ("어떤 앱을 만들고 싶나요?")

> 발판을 밟고 하늘 너머 우주까지 올라가는 픽셀 아트 점프 게임 — 중간중간 상식 퀴즈를 맞히면 재화를 얻어 캐릭터 옷을 만들고 아이템을 삽니다.

## 상세 설명 (500자 이내)

콘솔 안내: "사용자가 서비스에서 무엇을 보고, 어떤 버튼을 누르고, 무엇을 경험하는지 구체적으로". 제한 500자.
버튼·탭 이름은 코드의 실제 라벨과 같다 (`src/ui/*.ts`). 현재 439자(줄바꿈 포함).

> 라이프 점프는 발판을 밟고 위로 올라가는 픽셀 아트 점프 게임입니다.
>
> 로비에서 [게임 시작]을 누르고 이번 판에 쓸 소모품을 고른 뒤 [출발!]을 누르면 시작됩니다. 화면 왼쪽 절반을 밀어 좌우로 움직이고, 오른쪽 절반을 길게 누르면 높이 점프합니다.
>
> 땅에서 하늘, 우주로 오를수록 발판이 좁아지고 간격이 벌어집니다. 떨어지면 에너지(하트)를 하나 잃고 다시 시작하며, 모두 잃으면 판이 끝납니다. 도중에 [?] 아이템을 밟으면 상식 퀴즈가 뜨고, 정답이면 실·코인·에너지 중 보상을 고릅니다.
>
> 판이 끝나면 도달 높이와 획득 재화가 표시되고 [다시 도전] 또는 [로비로]로 이어갑니다. 옷장에서 실로 캐릭터 옷을 만들고, 상점에서 코인으로 업그레이드와 소모품을 사며, 기록에서 최고 기록과 최근 판 그래프를 봅니다.
>
> 로그인 없이 바로 시작하고, 진행 상황은 기기에 저장됩니다.

## 앱 검색 키워드

> 점프, 점프게임, 픽셀, 픽셀아트, 퀴즈, 캐주얼, 아케이드, 무한점프, 최고기록, 라이프점프

## 식별자 (한 번 정하면 못 바꾸는 것부터)

| 항목 | 값 | 비고 |
|---|---|---|
| Android 패키지명 (applicationId) | `dev.lazycompany.lifejump` | **Play 첫 업로드 후 변경 불가.** `lazycompany.dev` 소유 확인 필요 (eye-training 아이콘 URL 기준 추정) |
| 호스팅 URL | `https://life-jump.lazycompany.dev` | TWA host · 매니페스트 `start_url` · `/.well-known/assetlinks.json` 위치 |
| granite `appName` | `life-jump` | 앱인토스 URL `life-jump.web.tossmini.com` |
| 스토어 앱 이름 | 라이프 점프 / Life Jump | 변경 가능 |
| 서명 키 | keystore alias `lifejump` — Bubblewrap 생성 | **분실 시 업데이트 불가.** 비밀번호와 함께 안전 보관 |
| 버전 | `1.0.0` / versionCode `1` | versionCode 는 업데이트마다 +1 |
| 개인정보처리방침 URL | `https://life-jump.lazycompany.dev/privacy` | Play 필수. 수집 항목 없음 |
| Play 스토어 링크 (게시 후) | `https://play.google.com/store/apps/details?id=dev.lazycompany.lifejump` | 앱인토스 "게임 등급 정보 → 스토어 링크" 에 입력 |

쓰이는 곳: Play 콘솔 / Bubblewrap `twa-manifest.json` (`packageId`, `host`, `signingKey`) / `public/manifest.webmanifest` / `assetlinks.json` / `granite.config.ts` / 앱인토스 콘솔.

## 카테고리

콘솔의 게임 카테고리 목록: 액션 / RPG / 전략 / 어드벤처 / 퍼즐 / 시뮬레이션 / 레이싱 / 퀴즈 / 카드 / 보드 / 클래식 / 음악 / 스포츠 / 인디.

- **선택: 액션** — 핵심 루프가 타이밍·반사신경(점프 높이 조절, 좁아지는 발판)이라 아케이드 계열. 목록에 아케이드가 없어 액션이 가장 가깝다.
- 퀴즈는 훅일 뿐 플레이의 대부분이 점프라 1순위로 두지 않는다. 복수 선택이 되면 액션 + 퀴즈.
- 인디는 장르가 아니라 규모 태그 — 가이드가 "게임 장르에 맞는 카테고리"를 요구하므로 피한다.

## 이미지 에셋 (콘솔 규격)

모두 `node scripts/make-icon.mjs`(로고·썸네일) 와 `node scripts/store-screenshots.mjs`(스크린샷, dev 서버 필요) 로 다시 만들 수 있다.

| 콘솔 항목 | 규격 | 파일 |
|---|---|---|
| 앱 로고 | 600×600 | `assets/store/logo-600.png` (ascent 배경) |
| 다크모드 앱 로고 | 600×600 | `assets/store/logo-dark-600.png` (night 배경 — 다크 UI 위에서 밝은 하늘이 튀지 않게) |
| 썸네일 | 1932×828 | `assets/store/thumbnail-1932x828.png` (캐릭터 + 이름/부제, ascent 배경) |
| 스크린샷 세로 (최소 3) | 636×1048 | `assets/store/shot-1-lobby`, `shot-2-play`, `shot-3-quiz`, `shot-4-wardrobe` |
| 스크린샷 가로 (최소 1) | 1504×741 | `assets/store/shot-5-lobby-1504x741.png` |

스크린샷은 진행된 계정처럼 보이도록 seed 저장 데이터(최고 642m, 옷 4벌, 노란 우비 착용)로 찍는다 — 빈 로비는 매력이 없다.
플레이 화면은 `pointer: coarse` 에뮬레이션으로 터치 글리프가 보이게 찍는다.

## 아이콘

- 파일: `assets/icon/icon-ascent-1024.png` (512·192 도 같은 폴더). 원본은 `icon-ascent.svg`.
  배경은 게임 구간 진행 그대로 — 아래 하늘, 위로 갈수록 우주(별). 다른 배경(sky/night/flat)도 같은 폴더에 남겨 둠.
- 생성: `node scripts/make-icon.mjs` — 캐릭터 스프라이트(`src/data/pixelmaps.ts` PLAYER_IDLE)에서 그린다.
  스프라이트나 기본 옷 색이 바뀌면 다시 돌린다.
- `granite.config.ts` 의 `brand.icon` 은 **외부 URL** 이어야 한다 — 콘솔이 URL 을 요구하면 호스팅한 주소를 넣는다.
- 아이콘 얼굴은 눈 두 개(게임 스프라이트는 눈 세 픽셀 — 아이콘 크기에서 점으로 읽혀 바꿈).

## 게임 등급 정보 · 주요화면 (게임은 등급이 법적 필수)

근거: [앱인토스 블로그 — 게임 등급분류](https://toss.im/apps-in-toss/blog/game_rating_classification).
눈하루(비게임)에는 없던 절차. 토스는 자체등급분류사업자가 아니라 두 경로뿐이다.

| | 게임물관리위원회 직접 신청 | 스토어 자체등급 (IARC) |
|---|---|---|
| 서류 | 게임물제작업자등록증/배급업자등록증 + 사업자등록증 + 내용설명서 + 실행물 + 플레이 영상 | 스토어 개발자 계정만 |
| 비용·기간 | 수수료, 심사 10~15일 | 원스토어·MS 무료 / 구글 $25 1회 / 애플 $99 연. 설문 즉시 |
| 콘솔 입력 | 드롭다운 "등급분류증명서" 업로드 | "스토어 링크" (실제 게시된 URL) + 자체등급분류 게임물 정보 수동 입력 |

**선택: 스토어 자체등급, 원스토어 우선(무료, 국내 자체등급분류사업자).** 개인 개발자는 GRAC 경로의 제작업 등록증이 문턱이다.
청소년이용불가 등급이면 GRAC 추가 심사 — 라이프 점프는 전체이용가라 해당 없음.

출시 경로:
1. 웹 빌드를 HTTPS 에 호스팅 (Vercel / GitHub Pages) — `granite.config.ts` `brand.icon` URL 도 여기서 해결.
2. TWA 로 APK 생성 — `npx @bubblewrap/cli init --manifest <호스팅 URL>/manifest.json`. (웹 매니페스트 추가 필요)
3. 원스토어(또는 구글 플레이) 등록, IARC 설문 → 전체이용가. 스토어 리스팅 스크린샷은 `assets/store/shot-*.png` 그대로.
4. [게임물관리위원회](https://www.grac.or.kr) 검색에 뜨면 콘솔 "자체등급분류 게임물 정보" 채움:
   등록자명 / 자체등급분류사업자명(`원스토어` 또는 `구글`) / 등급분류일자·번호 / 이용등급 전체이용가 / 내용정보 전부 해당 없음 /
   제작업 신고번호는 개인이면 비움 / 대표자 인감 대신 서명 이미지. 블로그가 "자체등급분류 게임물 정보, 간단하게 입력하기" 가이드를 따로 링크함 — 그걸 따른다.
5. "게임 주요화면" 두 쌍은 스토어 화면 = 앱인토스 화면 이어야 한다 → 양쪽에 같은 파일:
   - 주요화면 1: `shot-2-play-636x1048.png`  - 주요화면 2: `shot-1-lobby-636x1048.png`
6. 하단 체크박스 "인허가·등록·신고 완료" 는 4번이 끝나야 체크.

## 나중에 채울 것

| 항목 | 상태 |
|---|---|
| 이용약관 URL | 미정 |
| 개인정보처리방침 URL | 미정 — 수집 항목 없음(로그인 없음, localStorage 만) 이라는 내용으로 |
| 광고 그룹 ID | 광고 붙일 때 (CLAUDE.md "광고" 절) |
| 게임 등급 정보 | 스토어 등급 선행 — 위 절 |

## 문구 근거 (검증한 사실)

- 소모품 4종: `src/data/shop.ts` CONSUMABLES (rocket, feather, cushion, doubleJump)
- 업그레이드 4종: `src/data/shop.ts` UPGRADES (jump, energy, air, magnet)
- 옷 10종: `src/data/outfits.ts` OUTFITS
- 탭 4개: `src/ui/shell.ts` (로비·옷장·상점·기록)
- 버튼 라벨: `게임 시작`(lobby), `출발!`(loadout), `다시 도전`/`로비로`(result)
- 조작: `docs/superpowers/specs/2026-08-17-touch-controls-design.md` (왼쪽 절반 조이스틱, 오른쪽 절반 홀드 점프)
