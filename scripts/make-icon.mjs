#!/usr/bin/env node
/**
 * 앱 아이콘 생성 — 게임 캐릭터 스프라이트(src/data/pixelmaps.ts PLAYER_IDLE)를 그대로 쓴다.
 * 스프라이트나 기본 옷 색이 바뀌면 이 스크립트를 다시 돌리면 아이콘도 따라간다.
 *
 *   node scripts/make-icon.mjs            → assets/icon/*.svg, *.png (1024/512/192)
 *
 * PNG 변환은 rsvg-convert(brew install librsvg)를 쓴다. 없으면 SVG 만 만든다.
 *
 * 왜 SVG rect 로 그리나: 픽셀아트는 어떤 크기로 키워도 경계가 또렷해야 한다. 캔버스로
 * 작은 비트맵을 만들어 확대하면 뷰어에 따라 보간이 걸린다. rect 하나 = 픽셀 하나면 확실하다.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const outDir = join(root, 'assets', 'icon')
mkdirSync(outDir, { recursive: true })

// ── 스프라이트 데이터 (src/data/pixelmaps.ts / outfits.ts 와 동일하게 유지) ─────────
// TS 를 직접 import 하려면 빌드 단계가 필요하므로 12×16 맵과 팔레트를 여기 복사해 둔다.
// 원본이 바뀌면 여기도 맞춘다 — 아래 검증이 폭/높이를 확인한다.
// 얼굴 행만 게임과 다르다: 게임 스프라이트는 'hsesesesh'(눈 3픽셀)인데 아이콘 크기에서는
// 점 세 개로 읽혀 얼굴이 흐려진다. 아이콘은 눈 두 개('hssesessh')로 둔다.
const PLAYER_IDLE = [
  '....hhhh....',
  '...hhhhhh...',
  '..hhhhhhhh..',
  '..hssssssh..',
  '..hssesessh.',
  '..hssssssh..',
  '...ssssss...',
  '....ssss....',
  '..cccccccc..',
  '.cccccccccc.',
  '.cccccccccc.',
  '..cccccccc..',
  '..cc....cc..',
  '..cc....cc..',
  '..ss....ss..',
  '.sss....sss.',
]
const PALETTE = {
  h: '#4a3728', // 머리카락
  s: '#f2c9a0', // 피부
  e: '#2b2118', // 눈
  c: '#3498db', // 기본 티셔츠 (outfits.ts basic-tee)
}
if (PLAYER_IDLE.length !== 16 || PLAYER_IDLE.some((r) => r.length !== 12)) {
  throw new Error('PLAYER_IDLE 은 12×16 이어야 한다 — src/data/pixelmaps.ts 와 다시 맞출 것')
}

// ── 아이콘 레이아웃 ─────────────────────────────────────────────────────────────
// 아이콘 캔버스는 정사각형. 캐릭터(12×16)를 세로 기준으로 캔버스의 ~62% 높이로 두고 가운데 정렬.
// 앱 아이콘은 대개 둥근 마스크가 씌워지므로 가장자리에 여백을 넉넉히 둔다.
const SIZE = 1024
const CHAR_H_RATIO = 0.62
const px = Math.floor((SIZE * CHAR_H_RATIO) / 16)   // 픽셀 하나의 크기
const charW = px * 12
const charH = px * 16
const ox = Math.floor((SIZE - charW) / 2)
const oy = Math.floor((SIZE - charH) / 2) + Math.floor(px * 0.5)   // 살짝 아래로 — 시각적 중심 보정

const variants = {
  // 로비 프리뷰의 하늘 그라데이션 (styles.css .lobby-preview) 위에 캐릭터 + 발판
  sky: {
    bg: `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7ec8f7"/>
      <stop offset="1" stop-color="#cfe6f7"/>
    </linearGradient></defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>`,
    ground: true,
    tee: PALETTE.c,
  },
  // 짙은 밤하늘(우주 구간) — 캐릭터가 밝게 떠오르고 작은 크기에서 대비가 가장 강하다
  night: {
    bg: `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1b2540"/>
      <stop offset="1" stop-color="#2c3e50"/>
    </linearGradient></defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
    <circle cx="${SIZE * 0.2}" cy="${SIZE * 0.22}" r="${SIZE * 0.008}" fill="#ffffff" opacity="0.9"/>
    <circle cx="${SIZE * 0.78}" cy="${SIZE * 0.16}" r="${SIZE * 0.006}" fill="#ffffff" opacity="0.7"/>
    <circle cx="${SIZE * 0.86}" cy="${SIZE * 0.34}" r="${SIZE * 0.009}" fill="#ffffff" opacity="0.8"/>
    <circle cx="${SIZE * 0.12}" cy="${SIZE * 0.42}" r="${SIZE * 0.006}" fill="#ffffff" opacity="0.6"/>`,
    ground: true,
    tee: PALETTE.c,
  },
  // 게임의 구간 진행 그대로 — 아래는 하늘, 위로 갈수록 우주. 별은 위쪽(우주)에만 둔다.
  // 그라데이션이 부드럽게만 이어지면 "하늘에서 우주로" 가 아니라 "탁한 파랑" 으로 읽히므로
  // 중간(캐릭터 머리 위)에서 급하게 어두워지도록 stop 을 몰아 둔다.
  ascent: {
    bg: `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0"    stop-color="#0b1026"/>
      <stop offset="0.16" stop-color="#1b2a4a"/>
      <stop offset="0.36" stop-color="#5aa9e6"/>
      <stop offset="0.70" stop-color="#8fd3f8"/>
      <stop offset="1"    stop-color="#cfe6f7"/>
    </linearGradient></defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
    <circle cx="${SIZE * 0.16}" cy="${SIZE * 0.12}" r="${SIZE * 0.009}" fill="#ffffff" opacity="0.95"/>
    <circle cx="${SIZE * 0.34}" cy="${SIZE * 0.07}" r="${SIZE * 0.006}" fill="#ffffff" opacity="0.7"/>
    <circle cx="${SIZE * 0.62}" cy="${SIZE * 0.10}" r="${SIZE * 0.007}" fill="#ffffff" opacity="0.8"/>
    <circle cx="${SIZE * 0.82}" cy="${SIZE * 0.05}" r="${SIZE * 0.010}" fill="#ffffff" opacity="0.9"/>
    <circle cx="${SIZE * 0.90}" cy="${SIZE * 0.22}" r="${SIZE * 0.006}" fill="#ffffff" opacity="0.7"/>
    <circle cx="${SIZE * 0.08}" cy="${SIZE * 0.30}" r="${SIZE * 0.007}" fill="#ffffff" opacity="0.6"/>
    <circle cx="${SIZE * 0.72}" cy="${SIZE * 0.27}" r="${SIZE * 0.005}" fill="#ffffff" opacity="0.5"/>`,
    ground: true,
    tee: PALETTE.c,
  },
  // 게임 화면 하늘색 단색 + 발판 한 줄 — 가장 담백함
  flat: {
    bg: `<rect width="${SIZE}" height="${SIZE}" fill="#8fd3f8"/>`,
    ground: true,
    tee: PALETTE.c,
  },
}

function rects(teeColor) {
  const palette = { ...PALETTE, c: teeColor }
  const out = []
  for (let y = 0; y < 16; y++) {
    const row = PLAYER_IDLE[y]
    // 같은 색이 이어지면 rect 하나로 합쳐 파일을 줄인다
    let x = 0
    while (x < 12) {
      const ch = row[x]
      if (ch === '.') { x++; continue }
      let x2 = x
      while (x2 + 1 < 12 && row[x2 + 1] === ch) x2++
      const color = palette[ch]
      if (!color) throw new Error(`팔레트에 없는 문자: ${ch}`)
      out.push(`<rect x="${ox + x * px}" y="${oy + y * px}" width="${(x2 - x + 1) * px}" height="${px}" fill="${color}"/>`)
      x = x2 + 1
    }
  }
  return out.join('\n')
}

// 발밑 발판 — 게임의 normal 발판 색(풀 + 흙). 캐릭터 발 바로 아래, 캐릭터보다 조금 넓게.
function ground() {
  const gw = px * 16
  const gx = Math.floor((SIZE - gw) / 2)
  const gy = oy + charH
  return `<rect x="${gx}" y="${gy}" width="${gw}" height="${px * 1.5}" fill="#4caf50"/>
<rect x="${gx}" y="${gy + px * 1.5}" width="${gw}" height="${px * 2}" fill="#8b5a2b"/>`
}

const made = []
for (const [name, v] of Object.entries(variants)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" shape-rendering="crispEdges">
${v.bg}
${v.ground ? ground() : ''}
${rects(v.tee)}
</svg>
`
  const svgPath = join(outDir, `icon-${name}.svg`)
  writeFileSync(svgPath, svg)
  made.push(svgPath)
  for (const size of [1024, 512, 192]) {
    const png = join(outDir, `icon-${name}-${size}.png`)
    try {
      execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', png, svgPath])
      made.push(png)
    } catch (e) {
      if (size === 1024) console.warn(`rsvg-convert 실패 — SVG 만 생성됨 (${e.message.split('\n')[0]})`)
    }
  }
}
console.log(made.map((p) => p.replace(root + '/', '')).join('\n'))

// ── 스토어 에셋 (앱인토스 콘솔 규격) ─────────────────────────────────────────────
// 로고 600×600 (라이트 = ascent, 다크모드 = night), 썸네일 1932×828 (배너).
// 텍스트는 macOS 의 Apple SD Gothic Neo 로 렌더된다 — 다른 OS 면 font-family 를 바꾼다.
const storeDir = join(root, 'assets', 'store')
mkdirSync(storeDir, { recursive: true })

const storeMade = []
const logo = (variant, name) => {
  const svgPath = join(outDir, `icon-${variant}.svg`)
  const png = join(storeDir, `${name}-600.png`)
  execFileSync('rsvg-convert', ['-w', '600', '-h', '600', '-o', png, svgPath])
  storeMade.push(png)
}
logo('ascent', 'logo')
logo('night', 'logo-dark')

// 썸네일 — 가로 배너. 왼쪽 1/3 에 캐릭터, 오른쪽에 이름/부제.
{
  const W = 1932, H = 828
  const bpx = Math.floor((H * 0.62) / 16)      // 캐릭터 픽셀 크기 (세로 62%)
  const bcx = Math.floor(W * 0.24)             // 캐릭터 중심 x
  const bx = bcx - bpx * 6
  const by = Math.floor((H - bpx * 16) / 2) + Math.floor(bpx * 0.5)
  const charRects = []
  for (let y = 0; y < 16; y++) {
    const row = PLAYER_IDLE[y]
    let x = 0
    while (x < 12) {
      const ch = row[x]
      if (ch === '.') { x++; continue }
      let x2 = x
      while (x2 + 1 < 12 && row[x2 + 1] === ch) x2++
      charRects.push(`<rect x="${bx + x * bpx}" y="${by + y * bpx}" width="${(x2 - x + 1) * bpx}" height="${bpx}" fill="${PALETTE[ch]}"/>`)
      x = x2 + 1
    }
  }
  const gw = bpx * 16, gx = bcx - gw / 2, gy = by + bpx * 16
  const textX = Math.floor(W * 0.46)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0"    stop-color="#0b1026"/>
  <stop offset="0.16" stop-color="#1b2a4a"/>
  <stop offset="0.36" stop-color="#5aa9e6"/>
  <stop offset="0.70" stop-color="#8fd3f8"/>
  <stop offset="1"    stop-color="#cfe6f7"/>
</linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<g fill="#ffffff">
  <circle cx="${W * 0.06}" cy="${H * 0.14}" r="7" opacity="0.9"/>
  <circle cx="${W * 0.15}" cy="${H * 0.07}" r="5" opacity="0.7"/>
  <circle cx="${W * 0.33}" cy="${H * 0.10}" r="6" opacity="0.8"/>
  <circle cx="${W * 0.55}" cy="${H * 0.06}" r="8" opacity="0.9"/>
  <circle cx="${W * 0.72}" cy="${H * 0.13}" r="5" opacity="0.7"/>
  <circle cx="${W * 0.88}" cy="${H * 0.08}" r="7" opacity="0.85"/>
  <circle cx="${W * 0.95}" cy="${H * 0.20}" r="5" opacity="0.6"/>
</g>
<g shape-rendering="crispEdges">
<rect x="${gx}" y="${gy}" width="${gw}" height="${bpx * 1.5}" fill="#4caf50"/>
<rect x="${gx}" y="${gy + bpx * 1.5}" width="${gw}" height="${bpx * 2}" fill="#8b5a2b"/>
${charRects.join('\n')}
</g>
<text x="${textX}" y="${H * 0.47}" font-family="Apple SD Gothic Neo, Noto Sans CJK KR, sans-serif" font-size="150" font-weight="800" fill="#ffffff">라이프 점프</text>
<text x="${textX}" y="${H * 0.63}" font-family="Apple SD Gothic Neo, Noto Sans CJK KR, sans-serif" font-size="66" font-weight="600" fill="#0b1e33" opacity="0.85">끝없이 올라가는 픽셀 점프 게임</text>
</svg>
`
  const svgPath = join(storeDir, 'thumbnail.svg')
  writeFileSync(svgPath, svg)
  const png = join(storeDir, 'thumbnail-1932x828.png')
  execFileSync('rsvg-convert', ['-w', String(W), '-h', String(H), '-o', png, svgPath])
  storeMade.push(svgPath, png)
}
console.log(storeMade.map((p) => p.replace(root + '/', '')).join('\n'))

// ── Google Play 그래픽 이미지 1024×500 — 썸네일과 같은 구성, 비율만 다르다 ─────
{
  const W = 1024, H = 500
  const bpx = Math.floor((H * 0.62) / 16)
  const bcx = Math.floor(W * 0.24)
  const bx = bcx - bpx * 6
  const by = Math.floor((H - bpx * 16) / 2) + Math.floor(bpx * 0.5)
  const charRects = []
  for (let y = 0; y < 16; y++) {
    const row = PLAYER_IDLE[y]
    let x = 0
    while (x < 12) {
      const ch = row[x]
      if (ch === '.') { x++; continue }
      let x2 = x
      while (x2 + 1 < 12 && row[x2 + 1] === ch) x2++
      charRects.push(`<rect x="${bx + x * bpx}" y="${by + y * bpx}" width="${(x2 - x + 1) * bpx}" height="${bpx}" fill="${PALETTE[ch]}"/>`)
      x = x2 + 1
    }
  }
  const gw = bpx * 16, gx = bcx - gw / 2, gy = by + bpx * 16
  const textX = Math.floor(W * 0.46)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0"    stop-color="#0b1026"/>
  <stop offset="0.16" stop-color="#1b2a4a"/>
  <stop offset="0.36" stop-color="#5aa9e6"/>
  <stop offset="0.70" stop-color="#8fd3f8"/>
  <stop offset="1"    stop-color="#cfe6f7"/>
</linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<g fill="#ffffff">
  <circle cx="${W * 0.06}" cy="${H * 0.14}" r="4" opacity="0.9"/>
  <circle cx="${W * 0.15}" cy="${H * 0.07}" r="3" opacity="0.7"/>
  <circle cx="${W * 0.33}" cy="${H * 0.10}" r="3.5" opacity="0.8"/>
  <circle cx="${W * 0.55}" cy="${H * 0.06}" r="4.5" opacity="0.9"/>
  <circle cx="${W * 0.72}" cy="${H * 0.13}" r="3" opacity="0.7"/>
  <circle cx="${W * 0.88}" cy="${H * 0.08}" r="4" opacity="0.85"/>
</g>
<g shape-rendering="crispEdges">
<rect x="${gx}" y="${gy}" width="${gw}" height="${bpx * 1.5}" fill="#4caf50"/>
<rect x="${gx}" y="${gy + bpx * 1.5}" width="${gw}" height="${bpx * 2}" fill="#8b5a2b"/>
${charRects.join('\n')}
</g>
<text x="${textX}" y="${H * 0.47}" font-family="Apple SD Gothic Neo, Noto Sans CJK KR, sans-serif" font-size="82" font-weight="800" fill="#ffffff">라이프 점프</text>
<text x="${textX}" y="${H * 0.63}" font-family="Apple SD Gothic Neo, Noto Sans CJK KR, sans-serif" font-size="36" font-weight="600" fill="#0b1e33" opacity="0.85">끝없이 올라가는 픽셀 점프 게임</text>
</svg>
`
  const svgPath = join(storeDir, 'play-feature.svg')
  writeFileSync(svgPath, svg)
  const png = join(storeDir, 'play-feature-1024x500.png')
  execFileSync('rsvg-convert', ['-w', String(W), '-h', String(H), '-o', png, svgPath])
  console.log(png.replace(root + '/', ''))
}
