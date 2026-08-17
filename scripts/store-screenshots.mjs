#!/usr/bin/env node
/**
 * 앱인토스 콘솔용 스크린샷 생성 — 헤드리스 Chrome + CDP 로 실제 게임 화면을 찍는다.
 *
 *   npm run dev -- --port 5199   (다른 터미널)
 *   node scripts/store-screenshots.mjs
 *
 * 산출: assets/store/shot-*.png — 세로 636×1048 ×N, 가로 1504×741 ×1 (콘솔 규격).
 * 의존성 없음 — Node 22 의 내장 WebSocket 으로 CDP 에 붙는다. Chrome 은 macOS 기본 경로.
 *
 * 각 장면은 seed 저장 데이터로 시작해(빈 로비가 아니라 진행된 계정처럼 보이게) DOM 을 클릭해 이동한다.
 * 플레이 화면은 rAF 를 몇 프레임 돌려 캐릭터가 발판 위에 선 상태에서 찍는다.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'assets', 'store')
mkdirSync(outDir, { recursive: true })

const URL_ = process.env.APP_URL ?? 'http://localhost:5199/'
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9333

const SEED = {
  version: 3, bestHeight: 6420, totalRuns: 17, thread: 38, coins: 145,
  ownedOutfits: ['basic-tee', 'striped', 'raincoat', 'overalls'], equippedOutfit: 'raincoat',
  upgrades: { jump: 1, energy: 1, air: 0, magnet: 1 },
  consumables: { rocket: 1, feather: 2, cushion: 0, doubleJump: 1 },
  selectedConsumables: [], seenQuizIds: [],
  recentRuns: [1200, 2450, 1900, 3800, 3100, 5200, 4600, 6420],
  controlsHintSeen: true,
}

// ── 최소 CDP 클라이언트 ────────────────────────────────────────────────────────
const profile = mkdtempSync(join(tmpdir(), 'lj-shots-'))
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank',
], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForDevtools() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (r.ok) return
    } catch { /* not yet */ }
    await sleep(100)
  }
  throw new Error('Chrome DevTools 포트가 열리지 않는다')
}

async function newTargetWs() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
  const t = await r.json()
  return t.webSocketDebuggerUrl
}

function cdp(ws) {
  let id = 0
  const pending = new Map()
  const events = []
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data)
    if (msg.id !== undefined) {
      const p = pending.get(msg.id); pending.delete(msg.id)
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result)
    } else events.push(msg)
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id
    pending.set(mid, { resolve, reject })
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
  return { send, events }
}

async function evalJs(c, expression) {
  const r = await c.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed')
  return r.result.value
}

async function shot(c, name, w, h) {
  await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: true })
  await evalJs(c, 'window.dispatchEvent(new Event("resize")); true')
  await sleep(150)
  const r = await c.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 } })
  const p = join(outDir, `${name}.png`)
  writeFileSync(p, Buffer.from(r.data, 'base64'))
  console.log(p.replace(root + '/', ''))
}

const clickText = (t) => `(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(t)}); if (!b) throw new Error('no button ' + ${JSON.stringify(t)}); b.click(); return true })()`

// 헤드리스에서도 rAF 는 돈다. 몇 프레임 진행시켜 캐릭터가 착지한 뒤 멈춘 상태를 얻는다.
const stepFrames = (n) => `new Promise((res) => { let k = 0; const f = () => { if (++k >= ${n}) res(true); else requestAnimationFrame(f) }; requestAnimationFrame(f) })`

try {
  await waitForDevtools()
  const wsUrl = await newTargetWs()
  const ws = new WebSocket(wsUrl)
  await new Promise((r) => ws.addEventListener('open', r))
  const c = cdp(ws)
  await c.send('Page.enable')
  await c.send('Runtime.enable')
  // 폰처럼 보이게: pointer: coarse 로 에뮬레이션해야 플레이 화면에 터치 글리프(슬라이더·● )가 뜬다
  await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }, { name: 'hover', value: 'none' }] })

  // 세로 규격으로 먼저 로드 — 캔버스 배율(정수)이 뷰포트에 맞춰진다
  await c.send('Emulation.setDeviceMetricsOverride', { width: 636, height: 1048, deviceScaleFactor: 1, mobile: true })
  await c.send('Page.navigate', { url: URL_ })
  await sleep(800)
  await evalJs(c, `localStorage.setItem('life-jump-save-v1', ${JSON.stringify(JSON.stringify(SEED))}); true`)
  await c.send('Page.navigate', { url: URL_ })
  await sleep(800)

  // 1. 로비
  await shot(c, 'shot-1-lobby-636x1048', 636, 1048)

  // 2. 플레이 중 — 게임 시작 → 출발! → 몇 프레임 진행
  await evalJs(c, clickText('게임 시작'))
  await evalJs(c, clickText('출발!'))
  await evalJs(c, stepFrames(20))
  await shot(c, 'shot-2-play-636x1048', 636, 1048)

  // 3. 퀴즈 — 로비로 돌아가지 않고 모달을 직접 띄운다 (실제 플레이 중 뜨는 모달과 같은 DOM)
  await evalJs(c, `(async () => {
    const { showQuiz } = await import('/src/ui/quizModal.ts');
    const { QUESTIONS } = await import('/src/game/quiz.ts');
    const { createRng } = await import('/src/core/rng.ts');
    showQuiz(document.body, QUESTIONS[3], createRng(7), () => {});
    return true
  })()`)
  await sleep(200)
  await shot(c, 'shot-3-quiz-636x1048', 636, 1048)
  await evalJs(c, `document.querySelector('.modal-overlay')?.remove(); true`)

  // 4. 옷장 — 새로고침해서 로비로, 탭 클릭
  await c.send('Page.navigate', { url: URL_ })
  await sleep(800)
  await evalJs(c, clickText('옷장'))
  await sleep(200)
  await shot(c, 'shot-4-wardrobe-636x1048', 636, 1048)

  // 5. 가로 — 로비
  await evalJs(c, clickText('로비'))
  await sleep(200)
  await shot(c, 'shot-5-lobby-1504x741', 1504, 741)

  ws.close()
} finally {
  chrome.kill()
}
