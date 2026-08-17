# Google Play 콘솔 — 등록 정보

Play 콘솔에 넣는 값. 콘솔과 이 파일을 같게 유지한다. 앱인토스 쪽은 `docs/toss-app-info.md`.
스토어 등급(IARC → 전체이용가) 확보가 1차 목적이므로 최소 요건 위주로 채우되, 리스팅은 제대로 쓴다.

## 앱 만들기

| 항목 | 값 |
|---|---|
| 앱 이름 | 라이프 점프 |
| 기본 언어 | 한국어 (ko-KR) |
| 앱 / 게임 | 게임 |
| 무료 / 유료 | 무료 |
| 폼 팩터 | **휴대전화만.** 태블릿(별도 스크린샷·큰 화면 심사, 세로 고정 캔버스라 여백 큼)·Chrome OS(창 리사이즈·키/마우스 심사)·Play Games on PC(별개 프로그램, 별도 SDK·심사)·Wear/TV/Auto 는 옵트인하지 않는다. 등급 확보용 최소 배포에 심사 표면만 늘어난다 |
| 패키지 이름 (첫 AAB 업로드 시 고정) | `dev.lazycompany.llifejump` |

## 기본 스토어 등록정보 (한국어)

| 항목 | 제한 | 값 |
|---|---|---|
| 앱 이름 | 30자 | 라이프 점프 |
| 짧은 설명 | 80자 | 끝없이 올라가는 픽셀 점프 게임 — 퀴즈로 재화를 모아 캐릭터를 꾸며요 (39자) |
| 자세한 설명 | 4000자 | 아래 (492자) |

### 자세한 설명

> 라이프 점프는 발판을 밟고 위로 올라가는 픽셀 아트 점프 게임입니다.
>
> ▶ 이렇게 놀아요
> 화면 왼쪽 절반을 밀어 좌우로 움직이고, 오른쪽 절반을 길게 누르면 높이 점프합니다. 땅에서 하늘, 우주로 오를수록 발판이 좁아지고 간격이 벌어집니다. 떨어지면 에너지(하트)를 하나 잃고 다시 시작하며, 모두 잃으면 판이 끝납니다.
>
> ▶ 퀴즈로 재화 획득
> 도중에 [?] 아이템을 밟으면 상식 퀴즈가 뜹니다. 정답이면 실·코인·에너지 중 원하는 보상을 고릅니다.
>
> ▶ 꾸미고 강해지기
> - 옷장: 모은 실로 캐릭터 옷 10종을 만들어 갈아입어요.
> - 상점: 코인으로 점프력·에너지·공중 제어·자석 업그레이드와 소모품(로켓·깃털·쿠션·더블점프)을 삽니다.
> - 기록: 최고 기록, 최근 판 높이 그래프, 구간별 도달 현황을 봅니다.
>
> ▶ 가볍게, 바로
> 로그인이나 회원가입 없이 바로 시작합니다. 개인정보를 수집하지 않으며 진행 상황은 기기에만 저장됩니다. 한 판 1~2분, 최고 기록에 도전하세요.

## 스토어 등록정보 (영어, en-US) — i18n 완료 후 콘솔에 추가

게임 UI 가 영어를 지원하기 전에는 넣지 않는다 (영어 설명 보고 받은 사람이 한국어 UI 를 만나면 안 된다).
용어는 `docs/superpowers/specs/2026-08-17-i18n-design.md` 6절과 같다: thread / coins / energy / Wardrobe / Shop / Records / run / Go! / Try again.

| 항목 | 제한 | 값 |
|---|---|---|
| App name | 30 | Life Jump |
| Short description | 80 | Endless pixel-art jumper — answer quizzes, earn thread and coins, dress up (74) |
| Full description | 4000 | 아래 (1028) |

> Life Jump is a pixel-art jumping game: hop from platform to platform and climb as high as you can.
>
> ▶ How to play
> Slide the left half of the screen to move left and right; hold the right half to jump — hold longer to jump higher. From the ground to the sky to outer space, platforms get narrower and farther apart. Fall and you lose one energy (heart) and restart on a nearby platform; lose them all and the run ends.
>
> ▶ Quizzes for rewards
> Step on a [?] item and a trivia question pops up. Answer correctly and pick your reward: thread, coins, or energy.
>
> ▶ Dress up and power up
> - Wardrobe: craft 10 outfits with the thread you collect and wear them.
> - Shop: spend coins on jump, energy, air-control and magnet upgrades, plus consumables (rocket, feather, cushion, double jump).
> - Records: your best height, a chart of recent runs, and how far you reached in each zone.
>
> ▶ Light and instant
> No sign-up, no login. We collect no personal data — progress is saved on your device only. A run takes a minute or two. Beat your best.

Release notes (v1.0.0): "First release. Endless pixel-art jumper — answer quizzes to earn thread and coins, craft outfits and upgrade."
영어 리스팅을 넣는 시점에 국가/지역도 전체로 확장하고, 앱인토스 쪽 영어 스토어 문구(`toss-app-info.md`)는 별도.


## 그래픽

| 항목 | 규격 | 파일 |
|---|---|---|
| 앱 아이콘 | 512×512 PNG, 32비트, 1MB 이하 | `assets/icon/icon-ascent-512.png` |
| 그래픽 이미지 (feature graphic) | 1024×500 JPG/PNG | `assets/store/play-feature-1024x500.png` |
| 휴대전화 스크린샷 | 2~8장, 16:9~9:16, 최소 320px, 최대 3840px | `assets/store/shot-1-lobby-636x1048.png`, `shot-2-play-…`, `shot-3-quiz-…`, `shot-4-wardrobe-…` (9:16 대역 안) |
| 7인치/10인치 태블릿 | 선택 | 없음 (게임이 세로 고정) |
| 동영상 (YouTube URL) | 선택 | 없음 |

## 앱 콘텐츠 (정책 신고)

| 항목 | 값 | 비고 |
|---|---|---|
| 개인정보처리방침 URL | `https://life-jump.lazycompany.dev/privacy` | 라이브. 수집 없음 |
| 광고 | **광고 없음** / 광고 ID **사용 안 함** | 지금 AAB 에 AD_ID 권한이 없으므로 이 신고가 사실이다. 앱인토스 광고는 토스 SDK 쪽이라 Play 앱과 무관 — Play 버전엔 광고를 넣지 않아도 된다 |
| 앱 액세스 권한 | 모든 기능이 특별한 액세스 없이 이용 가능 | 로그인 없음 |
| 콘텐츠 등급 (IARC 설문) | 카테고리 **게임**. 폭력·성적 콘텐츠·언어·약물·도박·사용자 상호작용·위치 공유·개인정보 공유 **전부 아니오** → 전체이용가(3+) | 이 결과가 앱인토스 등급의 근거 |
| 타겟층 및 콘텐츠 | 타겟 연령 **13세 이상** 선택 (모든 연령 포함 시 아동 정책 요건이 붙음). 아동 대상 아님 | 등급은 전체이용가지만 "어린이 대상 앱" 으로 신고하지 않는다 |
| 뉴스 앱 | 아니오 | |
| 코로나19 접촉 추적/상태 앱 | 아니오 | |
| 데이터 보안 | 사용자 데이터 **수집 안 함**, 공유 안 함. 전송 중 암호화: 해당 없음(수집 없음). 삭제 요청: 해당 없음 | localStorage 만 |
| 정부 앱 | 아니오 | |
| 금융 기능 | 없음 | |
| 건강 | 없음 | |

### 광고를 붙이게 되면 (Play 버전에도 넣을 경우에만)
한 번에 바꿔야 일관된다: 광고 "예" + 광고 ID "사용" / 데이터 보안 "기기 또는 기타 ID 수집, 광고 목적 공유" / 개인정보처리방침 3절 갱신(시행일 변경) / 매니페스트 `AD_ID` 권한(광고 SDK 가 자동 추가) / 재심사.
"사용 안 함" 으로 신고한 채 AD_ID 권한이 AAB 에 들어가면 리젝된다.

## 스토어 설정

| 항목 | 값 |
|---|---|
| 앱 카테고리 | 게임 → **아케이드** (Play 는 아케이드가 있음. 앱인토스의 "액션" 과 대응) |
| 태그 | 캐주얼, 아케이드, 픽셀 아트, 퀴즈 (콘솔이 제안하는 목록에서 선택) |
| 이메일 (연락처, 필수) | elasil@naver.com |
| 전화번호 / 웹사이트 | 선택. 웹사이트 `https://life-jump.lazycompany.dev` |
| 외부 마케팅 | 기본값 |
| 국가/지역 | **처음엔 한국만.** 결제·수집·규제 콘텐츠가 없어 전체 선택해도 문제는 없지만, 리스팅·게임이 한국어뿐인 동안은 노출을 넓힐 이유가 없다. i18n(영어) + 영어 리스팅 후 전체로 확장 (재심사 없이 반영) |
| 번역 | "AI로 번역 가져오기"(Gemini) 는 쓰지 않는다 — 게임 내 용어(thread/run/Wardrobe/Go!)와 어긋난다. 영어 리스팅은 i18n 후 직접 작성해 "직접 추가" |

## 출시

### 앱 번들
- 파일: `twa/app-release-bundle.aab` — versionName 1.0.0 / versionCode 1
- 재빌드·버전 올리기·서명 키 보관: `docs/toss-app-info.md` "Google Play 출시" 절
- Play 앱 서명: **사용(권장)** — 업로드 키는 `twa/lifejump.keystore`. Play 가 앱 서명 키를 따로 만들면 `assetlinks.json` 에 **Play 의 서명 키 SHA-256** 도 추가해야 TWA 가 주소창 없이 열린다 (콘솔 → 설정 → 앱 서명 에서 확인). 현재 파일엔 업로드 키 지문만 있음.

### 트랙
1. **비공개 테스트** 트랙에 AAB 업로드, 테스터 이메일 목록 등록.
2. 개인 계정(2023-11 이후 생성)이면 **테스터 12명 이상 × 14일 연속** 옵트인 후 프로덕션 신청 가능. 회사 계정·기존 계정이면 면제.
3. 프로덕션 출시 → 심사 1~7일 → 게시.
4. 게시 후 스토어 URL: `https://play.google.com/store/apps/details?id=dev.lazycompany.llifejump` → 앱인토스 콘솔 "게임 등급 정보 → 스토어 링크".

### 출시 노트 (v1.0.0)
> 첫 출시. 픽셀 아트 무한 점프 게임 — 퀴즈로 재화를 모아 옷을 만들고 업그레이드하세요.

## 체크리스트

- [ ] 개발자 계정 ($25) / 신원 확인
- [ ] 앱 만들기 (위 표)
- [ ] 스토어 등록정보 + 그래픽 업로드
- [ ] 앱 콘텐츠 8항목 (개인정보처리방침·광고·액세스·등급·타겟층·뉴스·데이터 보안·정부)
- [ ] 비공개 테스트 트랙에 AAB 업로드, 테스터 등록
- [ ] Play 앱 서명 키 지문 확인 → 필요 시 `public/.well-known/assetlinks.json` 에 추가, 푸시
- [ ] 14일 후 프로덕션 신청
- [ ] 게시 후 스토어 링크를 `docs/toss-app-info.md` 와 앱인토스 콘솔에
- [ ] 서명 키·비밀번호 백업 (`twa/lifejump.keystore`, `twa/.keystore-password`)
