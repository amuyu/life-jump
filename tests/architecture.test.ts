import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const GAME_DIR = join(process.cwd(), 'src', 'game')

const FORBIDDEN = [
  { pattern: /from\s+['"].*\/render\//, label: "render/ import" },
  { pattern: /from\s+['"].*\/ui\//, label: "ui/ import" },
  { pattern: /\bdocument\b/, label: 'document 참조' },
  { pattern: /\bwindow\b/, label: 'window 참조' },
  { pattern: /\blocalStorage\b/, label: 'localStorage 참조' },
  { pattern: /\bMath\.random\b/, label: 'Math.random 직접 호출' },
]

function gameFiles(): string[] {
  if (!existsSync(GAME_DIR)) return []
  return readdirSync(GAME_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(GAME_DIR, f))
}

describe('계층 경계', () => {
  it('src/game/ 는 렌더링·DOM·전역 난수를 참조하지 않는다', () => {
    const violations: string[] = []

    for (const file of gameFiles()) {
      const source = readFileSync(file, 'utf8')
      for (const { pattern, label } of FORBIDDEN) {
        if (pattern.test(source)) {
          violations.push(`${file}: ${label}`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})
