# Life Jump — UI 리디자인 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 완성된 게임의 DOM UI를 Meta Commerce 디자인 시스템 기반의 밝은 테마·탭 구조로 교체하고, 기록 탭을 새로 만든다. 캔버스 게임과 게임 로직은 건드리지 않는다.

**Architecture:** 디자인 시스템 CSS를 **손질해서 벤더링**한다(런타임 의존성은 계속 0). 화면은 탭 셸 하나 아래로 모으고, `main.ts`가 `tab` 상태 하나로 디스패치한다. 스프라이트 프리뷰는 기존 `render/sprites.ts` 캐시를 재사용해 작은 `<canvas>`에 정수 배율로 굽는다.

**Tech Stack:** 기존과 동일 — Vite + TypeScript + Canvas 2D + Vitest. 새 런타임 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-08-15-life-jump-design.md` (게임 스펙, 여전히 구속력 있음)
**Design reference:** `/tmp/lj-ds/design.html` — 시각 참조 전용. 데이터·의미론은 채택하지 않는다.
**Analysis:** `/tmp/lj-ds/analysis.md`

---

## Global Constraints

**기존 스펙 제약은 전부 그대로 유효하다.** 아래는 이 리디자인에만 추가되는 것.

- **런타임 의존성 0 유지.** `_ds_bundle.js`(gzip 8KB, React)는 채택하지 않는다. `components.css`와 `typography.utilities.css`는 순수 CSS라 번들 없이 동작한다.
- **외부 네트워크 요청 0 유지.** `tokens/fonts.css`는 채택하지 않는다 — Google Fonts를 런타임 `@import`하고, 파일 자체가 `Optimistic VF is NOT publicly licensed`라고 적고 있다. 시스템 폰트 스택으로 대체한다.
- **디자인의 데이터는 전부 무시한다.** 템플릿의 `OUTFITS`/`UPGRADES`/`CONSUMABLES`/`QUIZZES`는 목업 픽스처다. `src/data/`가 유일한 진실이다.
- **옷 ID는 구현 것을 유지한다.** 디자인은 `tee`/`stripe`/`rain`/`denim`/`robe`/`armor`/`space`, 구현은 `basic-tee`/`striped`/`raincoat`/`overalls`/`wizard`/`knight`/`spacesuit`. 10벌 중 7벌이 다르고, `parseSave` 4단계가 모르는 ID를 걸러내므로 디자인 ID를 쓰면 **기존 플레이어의 옷 7벌이 조용히 사라진다.**
- **소모품 의미론은 구현을 유지한다.** 명시적 장착 + 판 시작 시 차감. 디자인의 자동 적용 + 판 종료 시 차감은 스펙 10절을 두 번 위반하고 새로고침 복제 악용을 되살린다.
- **정수 배율 캔버스 스케일링을 유지한다.** 디자인의 `min(640px, 100vh - 48px)` CSS 스트레치는 `render/canvas.ts`의 존재 이유를 무효화한다.
- **퀴즈의 3지선다 보상 선택과 보기 셔플을 유지한다.** 셔플은 `quiz.json`의 정답이 한 슬롯에 42.5% 몰려 있어서 넣은 것이다.
- **로드아웃(출발 준비) 화면을 유지한다.** 디자인에는 없다. 로비의 소모품 칩은 **표시 + 진입점**으로 쓴다.
- **HUD는 캔버스 안에 유지한다.** `drawHud.ts`를 DOM으로 옮기지 않는다.
- **모든 높이는 px로 저장하고 표시할 때만 `PX_PER_M`로 나눈다.** 디자인의 `runs: [412, 630, ...]`은 미터다 — 그대로 베끼면 한 저장 객체에 두 단위가 섞인다.
- **`SAVE_KEY`를 바꾸지 않는다.** `'life-jump-save-v1'`의 `v1`은 스토리지 키 네임스페이스이고 스키마 버전은 `version` 필드다. 키를 바꾸면 기존 저장이 전부 고아가 된다.
- **아키텍처 가드 유지:** `src/game/` 아래 어떤 `.ts`도 `render/`·`ui/` import나 `document`·`window`·`localStorage`·`Math.random`을 포함하지 않는다.
- **기존 테스트 307개는 계속 통과해야 한다.** 스펙 14절에 따라 DOM·CSS는 테스트하지 않으므로, 이 계획의 대부분은 테스트가 잡아주지 않는다 — **육안 확인이 주된 검증 수단이다.**

---

## 채택하지 않는 것 (근거)

| 항목 | 이유 |
|---|---|
| `_ds_bundle.js` | gzip 8KB — 게임 전체 JS(13.6KB)의 60%. 필요한 컴포넌트 4개는 `components.css`에 순수 CSS로 이미 있다 |
| `tokens/fonts.css` | 외부 런타임 요청 + 미라이선스 폰트. 오프라인에서 깨진다 |
| 디자인의 데이터 카탈로그 | 목업. 옷 ID 채택 시 기존 옷 7벌 소실 |
| 디자인의 소모품 처리 | 스펙 10절 위반 + 새로고침 복제 악용 |
| 비정수 캔버스 스케일링 | 픽셀아트가 뭉개진다 |
| DOM HUD | 정수 배율 이점 상실 + 상태를 두 곳에서 그리는 동기화 문제. 얻는 것이 적다 |
| 드랍 테이블 푸터 | 82% 미드랍 케이스를 빼놓아 드랍 빈도를 과장한다. 넣는다면 기록 탭 안 |
| 로비의 특징 카드 3장 | 이미 열린 게임에 대한 마케팅 문구. 히어로를 아래로 밀어낸다 |
| `zonesReached` 필드 | 불필요 — 구간은 순수 높이 밴드라 `bestHeight`로 전부 계산된다 |

---

## File Structure

```
src/ui/
  tokens.css        신규 — 손질한 디자인 토큰 (colors/spacing/shapes/elevation/typography)
  typography.css    신규 — typography.utilities.css 를 거의 그대로
  components.css    신규 — 필요한 레시피 ~6개만 (.button-primary/-secondary/-pill-tab/.badge/.promo-banner/카드)
  styles.css        재작성 — 토큰 기반 레이아웃
  shell.ts          신규 — 헤더·탭바·재화 필·프로모 배너
  lobby.ts          재작성 — 히어로 레이아웃
  wardrobe.ts       재작성 — 5열 스프라이트 그리드
  shop.ts           재작성 — 레벨 점 + 효과 설명 카드
  loadout.ts        재스타일 (유지)
  result.ts         재작성 — 모달
  quizModal.ts      재스타일 (로직 무변경)
  records.ts        신규 — 기록 탭
  spritePreview.ts  신규 — 스프라이트를 <canvas> 로 굽는 헬퍼

src/core/storage.ts   수정 — recentRuns 필드 + numArray 헬퍼 + SAVE_VERSION 2
src/runFlow.ts        수정 — finishRun 이 recentRuns 에 기록
src/data/pixelmaps.ts 수정 — 업그레이드/소모품 아이콘 8종 추가
src/main.ts           재작성 — tab 상태 + render() 디스패처
```

---

## 태스크 개요

| # | 태스크 | 산출물 | 크기 |
|---|---|---|---|
| 1 | 토큰 벤더링 + 기존 화면 재스타일 | 전 화면이 새 테마로. DOM 구조 무변경 | 중 |
| 2 | 셸 — 탭바·헤더·재화 필 | 탭 내비게이션. **스케일링 회귀 주의 구간** | 중 |
| 3 | 스프라이트 프리뷰 헬퍼 + 아이콘 | 옷·아이템·업그레이드를 DOM 에 그림 | 소~중 |
| 4 | 옷장 그리드 + 상점 카드 | 리디자인의 최대 이득 | 중 |
| 5 | 로비 히어로 + 결과 모달 + 퀴즈 재스타일 | 로비 완성 | 중 |
| 6 | 저장 확장 + 기록 탭 | `recentRuns` + 기록 화면. **유일한 영속성 변경** | 중 |
| 7 | 프로모 배너 + 마감 점검 | 목표 제시 배너, 전체 육안 점검 | 소 |

각 태스크는 게임이 동작하는 상태로 끝난다.

---

### Task 1: 토큰 벤더링 + 기존 화면 재스타일

**Files:**
- Create: `src/ui/tokens.css`, `src/ui/typography.css`, `src/ui/components.css`
- Modify: `src/ui/styles.css`
- Source: `~/Downloads/genfic/_ds/meta-commerce-design-system-f992a3d7-179e-4f06-85a0-5d48ff96053c/`

**목표:** DOM 구조와 `main.ts`를 **전혀 건드리지 않고** 전 화면의 겉모습만 바꾼다.

- [ ] **Step 1: 토큰을 손질해 벤더링한다**

원본 `tokens/` 에서 `colors.css`·`spacing.css`·`shapes.css`·`elevation.css`·`typography.css` 를 가져와 `src/ui/tokens.css` 한 파일로 합친다. **`fonts.css`는 가져오지 않는다.**

색 변수 중 게임이 절대 쓰지 않는 것들을 뺀다 — `--color-fb-blue`, `--color-oculus-purple`, `--color-meta-link`, 폼/critical 계열 등 약 25개. 남기는 기준: 이 계획의 화면들이 참조하는 것 + `components.css` 레시피가 참조하는 시맨틱 별칭(`--text-body`, `--surface-page` 등).

`typography.css` 가 `--font-display`/`--font-body` 를 참조하는데 `fonts.css` 를 뺐으므로, `tokens.css` 상단에 시스템 폰트 스택으로 직접 정의한다:

```css
:root {
  --font-display: system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif;
  --font-body: system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif;
  --font-technical: ui-monospace, SFMono-Regular, Menlo, monospace;
  --font-feature-headings: normal;   /* ss01/ss02 는 시스템 폰트에 없다 */
}
```

한글이 주 언어이므로 `Noto Sans KR` 을 스택에 넣되 **`@import` 하지 않는다** — 없으면 다음 폰트로 넘어간다.

- [ ] **Step 2: 타이포 유틸리티를 가져온다**

`tokens/typography.utilities.css` 를 `src/ui/typography.css` 로 거의 그대로 복사한다. 순수 CSS라 JS 번들이 필요 없다.

**디자인 템플릿이 쓰는 클래스 두 개가 이 파일에 없다:** `type-display-md` 와 `type-button-sm`. 디자인의 버그다. 각각 `type-display-lg`, `type-button-md` 로 대체한다.

- [ ] **Step 3: 컴포넌트 레시피를 골라 가져온다**

`components/components.css` 에서 아래만 `src/ui/components.css` 로 가져온다. 나머지(체크아웃 요약, 스펙 표, FAQ 아코디언, 라디오, 검색 필 등)는 커머스용이라 버린다.

`.button-primary`, `.button-secondary`, `.button-ghost`, `.button-pill-tab` (+ `-active`), `.badge` (+ tone modifier), `.promo-banner`, 카드 레시피 1종.

- [ ] **Step 4: `styles.css` 를 토큰 기반으로 재작성한다**

기존의 어두운 하드코딩 색을 전부 토큰 참조로 바꾼다. **셀렉터 이름과 DOM 구조는 그대로 두어** 기존 `.ts` 파일들이 계속 동작하게 한다.

기존의 스코프 없는 전역 `button { }` 규칙을 **제거하지 말고 컨테이너로 스코프한다** (`.panel button`, `.modal-overlay button`).

이유: 기존 `.ts` 6개가 `createElement('button')` 을 15회 호출하면서 클래스는 `.wide`/`.primary`/`.selected` 수식자만 붙이고 **기본 스타일은 전역 규칙에 의존한다.** 그냥 제거하면 버튼 15개가 전부 무스타일이 된다. 최종 리뷰가 지적한 것은 "앱의 다른 버튼까지 물들인다"는 범위 문제이고, 스코프만으로 해소된다. Task 4·5 가 각 화면을 재작성할 때 제대로 된 클래스로 바꾼다.

- [ ] **Step 5: 검증**

```
npx tsc --noEmit && npm test && npm run build
```

테스트 307개 전부 통과해야 한다(DOM 을 테스트하지 않으므로 당연히 통과하지만, 빌드가 CSS import 를 처리하는지 확인하는 의미가 있다).

gzip 증가분을 보고서에 기록한다. **목표: +3.5KB 이하.** 초과하면 어떤 파일이 큰지 보고한다.

- [ ] **Step 6: 육안 확인**

`npm run dev` 로 띄우고 로비·옷장·상점·로드아웃·결과·퀴즈 모달을 전부 열어 확인한다. 이 단계에서는 **레이아웃이 아직 어색한 것이 정상이다**(셸이 Task 2 에 온다). 확인할 것은 색·타이포가 적용됐는지, 깨진 곳이 없는지, 외부 네트워크 요청이 0인지(개발자도구 Network 탭).

- [ ] **Step 7: 커밋**

```bash
git add src/ui/
git commit -m "feat(ui): vendor trimmed design tokens and restyle screens in place"
```

---

### Task 2: 셸 — 탭바 · 헤더 · 재화 필

**Files:**
- Create: `src/ui/shell.ts`
- Modify: `src/main.ts`, `src/ui/styles.css`, 각 화면의 `onClose` 시그니처

**Interfaces:**
```ts
export type Tab = 'lobby' | 'wardrobe' | 'shop' | 'records'
export interface ShellCallbacks { onTab(tab: Tab): void }
/** 헤더·탭바·재화 필을 그리고, 본문을 담을 컨테이너를 돌려준다 */
export function renderShell(
  mount: HTMLElement, save: SaveData, active: Tab, cb: ShellCallbacks,
): HTMLElement
```

**목표:** 화면마다 있던 `돌아가기` 버튼을 탭바로 대체하고, 재화 표시를 상시 크롬으로 올린다.

- [ ] **Step 1: `main.ts` 에 `tab` 상태와 단일 디스패처를 만든다**

지금은 `showLobby()`/`showShop()`/`showWardrobe()` 가 각자 `uiLayer` 를 직접 그린다. 이를 `let tab: Tab` + `render()` 하나로 모은다. `render()` 가 셸을 그리고, 반환된 본문 컨테이너에 현재 탭의 화면을 그린다.

`showShop`/`showWardrobe` 의 `onClose` 콜백이 사라진다. `showLoadout` 은 **탭이 아니라 로비에서 진입하는 화면**이므로 유지한다 — 별도 상태(`showingLoadout: boolean`)로 관리하거나 로비 안의 서브뷰로 둔다. 어느 쪽이든 로드아웃이 사라지지 않게 한다.

- [ ] **Step 2: 페이지 레이아웃을 스크롤 가능하게 바꾼다**

지금 `body` 는 `display:flex; align-items:center; overflow:hidden` 으로 캔버스를 화면 중앙에 고정한다. 디자인은 위에서 아래로 흐르는 스크롤 페이지다. `body` 를 일반 문서 흐름으로 바꾸고, **`.game-layer` 를 고정 오버레이로** 만든다.

- [ ] **Step 3: ⚠️ 스케일링 회귀를 반드시 확인한다**

**이 태스크에서 가장 위험한 지점이다.** `render/canvas.ts` 의 `fitScreen` 은 `window.innerWidth/innerHeight` 로 정수 배율을 계산한다. 캔버스를 고정 오버레이로 옮기면 그 측정 기준이 달라질 수 있다.

브라우저에서 창 크기를 최소 4가지로 바꿔가며 아래를 확인한다:

```js
const c = document.querySelector('canvas');
const cs = getComputedStyle(c);
({ internal: `${c.width}x${c.height}`,
   scaleX: parseFloat(cs.width) / c.width,
   integer: Number.isInteger(parseFloat(cs.width) / c.width) })
```

`internal` 은 항상 `180x320`, `scaleX` 는 항상 정수여야 한다. 하나라도 어긋나면 **멈추고 보고한다.**

- [ ] **Step 4: 모바일 폭을 결정한다**

기존 CSS 에는 미디어 쿼리가 하나도 없다. 아무것도 안 하면 데스크톱 전용 페이지가 된다. 최소한 좁은 폭에서 탭바가 줄바꿈되고 그리드 열 수가 줄도록 브레이크포인트를 하나 이상 넣는다.

- [ ] **Step 5: 검증 + 육안 확인 + 커밋**

`npx tsc --noEmit && npm test && npm run build`. 브라우저에서 탭 4개를 오가며(기록 탭은 아직 자리만) 상태가 유지되는지, 게임 중에는 셸이 가려지는지 확인한다.

---

### Task 3: 스프라이트 프리뷰 헬퍼 + 아이콘

**Files:**
- Create: `src/ui/spritePreview.ts`
- Modify: `src/data/pixelmaps.ts`, `src/render/sprites.ts` (필요 시 export 추가)

**Interfaces:**
```ts
/** 픽셀맵을 정수 배율로 구운 <canvas> 를 돌려준다. 캐시된 스프라이트를 drawImage 로 복사한다. */
export function spriteCanvas(
  map: PixelMap, palette: Palette, scale: number, overlay?: { map: PixelMap; palette: Palette },
): HTMLCanvasElement
/** 옷을 입은 캐릭터 프리뷰 */
export function outfitCanvas(outfitId: string, scale: number): HTMLCanvasElement
```

- [ ] **Step 1: 프리뷰 헬퍼를 만든다**

기존 `render/sprites.ts` 의 `bakeSprite` 와 `spriteCache` 를 재사용한다. **매 렌더마다 픽셀을 다시 찍지 않는다** — 스펙 13절의 스프라이트 캐싱 규칙은 DOM 프리뷰에도 그대로 적용된다. 옷 10벌을 14배로 그리면 168×308 캔버스가 10개다.

배율은 정수만 쓴다: 히어로 14배, 옷장 7배, 아이콘 2~4배.

- [ ] **Step 2: 업그레이드·소모품 아이콘 8종을 추가한다**

디자인의 아이콘 **모양만** 가져와 `src/data/pixelmaps.ts` 에 게임의 팔레트 규약대로 넣는다. 점프력 강화·에너지 확장·공중 조향·자석·로켓 부츠·깃털·방석·더블 점프.

기존 픽셀맵 테스트가 행 길이 균일성과 팔레트 완전성을 검사하므로, 새 맵도 같은 검사를 통과해야 한다.

- [ ] **Step 3: 검증 + 커밋**

`npm test` — 픽셀맵 테스트가 새 아이콘을 포함해 통과해야 한다.

---

### Task 4: 옷장 그리드 + 상점 카드

**Files:** Rewrite `src/ui/wardrobe.ts`, `src/ui/shop.ts`

**이 태스크가 리디자인의 최대 이득이다.**

- [ ] **Step 1: 옷장을 5열 그리드로 재작성한다**

각 칸에 `outfitCanvas(id, 7)` 로 그 옷을 입은 캐릭터를 그린다. 착용 중인 칸에 테두리 + `착용 중` 배지. 보유 = `착용하기`, 미보유 = 실 비용 + `제작하기`(실 부족 시 비활성). 우상단에 `N / 10벌 보유`.

**옷 ID·비용·이름은 `src/data/outfits.ts` 에서 읽는다.** 디자인의 것을 베끼지 않는다.

- [ ] **Step 2: 상점을 카드로 재작성한다**

업그레이드는 아이콘 + 이름 + 효과 설명 + **레벨 점 표시**(`● ○ ○` Lv 1/3) + 가격 + 구매 버튼. 소모품은 아래 별도 섹션.

효과 설명("점프 속도 +20/레벨 · 9.6m → 12m")은 `src/data/shop.ts` 의 `desc` 를 쓰되, 필요하면 `desc` 를 조금 더 구체적으로 늘린다 — 그 경우 `shop.test.ts` 의 "설명이 비어 있지 않다" 테스트가 여전히 통과하는지 확인한다.

- [ ] **Step 3: 육안 확인 + 커밋**

옷을 실제로 제작·착용해보고, 상점에서 업그레이드를 사서 레벨 점이 늘어나는지 확인한다.

---

### Task 5: 로비 히어로 + 결과 모달 + 퀴즈 재스타일

**Files:** Rewrite `src/ui/lobby.ts`, `src/ui/result.ts`; restyle `src/ui/quizModal.ts`, `src/ui/loadout.ts`

- [ ] **Step 1: 로비를 히어로 레이아웃으로 재작성한다**

좌측에 `outfitCanvas(save.equippedOutfit, 14)` 프리뷰 카드, 우측에 최고 기록 대형 표시 + 착용 옷 + `착용 중` 배지 + **소모품 칩 행** + `게임 시작`/`상점 둘러보기` + 조작 힌트.

**소모품 칩은 표시 + 로드아웃 진입점이다.** 클릭하면 로드아웃 화면이 열린다. 자동 적용하지 않는다.

`8회 기록 · 우주 구간 도달` 같은 부제는 `totalRuns` 와 `zoneAt(bestHeight)` 로 만든다 — 새 필드가 필요 없다.

**디자인의 특징 카드 3장은 만들지 않는다.**

- [ ] **Step 2: 결과 화면을 모달로 바꾼다**

게임 레이어 위에 뜨는 모달로. `다시 도전`/`로비로` 유지.

- [ ] **Step 3: 퀴즈 모달을 재스타일한다**

**로직은 한 줄도 바꾸지 않는다.** `shuffleChoices`, 3지선다 보상 선택, `performance.now()` 타이머, 복귀 5단계 전부 그대로. CSS 클래스만 교체한다.

- [ ] **Step 4: ⚠️ 소모품 통합 테스트를 반드시 재실행한다**

로비에서 로드아웃으로 가는 경로가 바뀌므로 `consumeSelected` 주변 순서가 흔들릴 수 있다. **`src/runFlow.ts` 는 건드리지 않는다.** 아래가 전부 통과해야 이 태스크가 끝난다:

```
npx vitest run tests/integration/runFlow.test.ts
npx vitest run tests/data/shop.test.ts
```

- [ ] **Step 5: 육안 확인 + 커밋**

로드아웃에서 소모품을 장착하고 게임을 시작한 뒤, 로비로 돌아와 재고가 정확히 1개 줄었는지 저장을 직접 확인한다.

---

### Task 6: 저장 확장 + 기록 탭

**Files:** Modify `src/core/storage.ts`, `src/runFlow.ts`; Create `src/ui/records.ts`; Modify `tests/core/storage.test.ts`

**이 계획에서 유일하게 영속성을 건드리는 태스크다. 마지막에 단독으로 한다.**

- [ ] **Step 1: `SaveData` 에 `recentRuns` 를 추가한다**

```ts
export const RECENT_RUNS_MAX = 8

interface SaveData {
  // ...
  /** 최근 판의 maxHeight (px), 오래된 것이 앞. 최대 RECENT_RUNS_MAX개 */
  recentRuns: number[]
}
```

**px 로 저장한다.** 디자인의 `runs: [412, 630, ...]` 은 미터다 — 그대로 베끼면 한 저장 객체에 두 단위가 섞이고, 그건 스펙 3절의 "높이를 나타내는 네 가지 값 (혼동 금지)" 가 막으려던 바로 그 상황이다.

- [ ] **Step 2: 로드 파이프라인 3곳을 고친다**

`parseSave` 3단계는 **필드별 병합**이라 자동으로 되지 않는다.

1. `defaultSave()` 에 `recentRuns: []` 추가
2. `numArray` 헬퍼 추가 — **길이 상한이 load-bearing 이다.** 없으면 손상된 저장이 막대 10만 개를 그리려 든다.
   ```ts
   function numArray(v: unknown, max: number, cap: number): number[] {
     if (!Array.isArray(v)) return []
     return v
       .filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
       .map((x) => Math.min(max, Math.max(0, Math.floor(x))))
       .slice(-cap)
   }
   ```
3. `SAVE_VERSION` 을 2로 올리고 `migrate()` 에 파일이 이미 예약해둔 다음 단계를 채운다

**`SAVE_KEY` 는 건드리지 않는다.**

- [ ] **Step 3: 저장 회귀 테스트 4개를 추가한다**

기존 `upgrades`/`consumables` 테스트와 같은 형태로:

- `recentRuns` 가 없는 v1 저장이 **나머지를 초기화하지 않고** 병합된다
- `recentRuns: "nope"` → `[]`
- `recentRuns: [-5, 1.7, "x", NaN]` → `[0, 1]`
- 8개를 넘는 배열이 **최신 8개로 잘린다**

- [ ] **Step 4: `finishRun` 이 기록하게 한다**

`src/runFlow.ts` 의 `finishRun` 에서 `bestHeight`·`totalRuns` 갱신 옆에 추가한다. **한 판이 기록되는 지점이 한 곳이어야 한다.**

`tests/integration/runFlow.test.ts` 에 "판을 마치면 recentRuns 에 이번 판 높이가 px 로 추가되고 8개를 넘지 않는다" 테스트를 더한다.

- [ ] **Step 5: 기록 탭을 만든다**

- 최고 기록 카드 (`bestHeight`, `zoneAt` 으로 도달 구간 문구)
- 통계 4칸: 기록된 플레이(`totalRuns`), 제작한 옷(`ownedOutfits.length`), 업그레이드 합계(`upgrades` 값의 합), 평균 높이(`recentRuns` 평균)
- 최근 플레이 막대 차트 (`recentRuns`, 최고 기록과 같은 막대는 강조)
- 구간 진행 바 3개 — **`bestHeight` 하나로 전부 계산된다. 새 필드 불필요.**

`recentRuns` 가 비었을 때(신규 플레이어) 차트와 평균이 깨지지 않아야 한다.

- [ ] **Step 6: 검증 + 커밋**

`npx tsc --noEmit && npm test`. 기존 저장을 심어놓고 새로고침해 진행도가 보존되는지 직접 확인한다.

---

### Task 7: 프로모 배너 + 마감 점검

**Files:** Modify `src/ui/shell.ts`

- [ ] **Step 1: 프로모 배너를 만든다**

`OUTFITS` 와 `save.thread` 에 대한 순수 함수로, **가장 싼 미보유 옷**을 골라 "실 N개면 X를 만들 수 있어요. 옷장 보기" 를 띄운다. 전부 보유했거나 실이 이미 충분하면 다른 문구를 쓰거나 감춘다.

리디자인에서 유일하게 플레이어에게 **목표를 제시하는** 요소다.

- [ ] **Step 2: 전체 마감 점검**

브라우저에서 전 흐름을 돈다 — 로비 → 옷장(제작·착용) → 상점(구매) → 로드아웃(장착) → 게임 → 퀴즈 → 결과 → 기록 탭.

확인할 것:
- 캔버스 배율이 창 크기 4종에서 전부 정수
- 외부 네트워크 요청 0
- 콘솔 에러 0
- 좁은 폭에서 레이아웃이 무너지지 않음
- gzip 번들 크기(목표: 17KB 이하)

- [ ] **Step 3: 커밋**

---

## 검증 전략

기존 테스트 307개는 DOM·CSS를 다루지 않으므로 **이 계획의 대부분을 잡아주지 못한다.** 그래서:

- **Task 6 만이 테스트로 검증된다** — 저장 회귀 4개 + `finishRun` 통합 1개
- **Task 5 는 기존 소모품 통합 테스트가 회귀 그물이다** — 반드시 재실행
- **나머지는 육안 확인이 주된 수단이다** — 각 태스크의 육안 확인 단계를 건너뛰지 않는다
- **Task 2 의 정수 배율 확인은 생략 불가다** — 창 크기 4종에서 스크립트로 확인
