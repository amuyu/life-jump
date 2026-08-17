import type { Question, RewardKind, Reward } from '../game/quiz'
import { rewardFor } from '../game/quiz'
import type { Rng } from '../core/rng'
import { FOOD_TO_COIN } from '../constants'

const TIME_LIMIT_MS = 10_000

export interface QuizResult {
  correct: boolean
  reward: RewardKind | null
}

export interface RewardOption {
  kind: RewardKind
  /** 버튼 첫 줄 — 무엇을 얼마나 */
  label: string
  /** 버튼 둘째 줄 — 어디에 쓰는지. 이 화면이 세 재화를 처음 비교하는 자리라 없으면 고를 근거가 없다 */
  desc: string
}

/**
 * 보상 선택지 세 개. 순수 함수 — 문구를 테스트로 고정한다.
 * 에너지 설명의 코인 수치는 items.ts 의 grantFood 규칙(FOOD_TO_COIN)에서 오므로
 * 상수가 바뀌어도 문구가 거짓이 되지 않는다.
 */
export function rewardOptions(reward: Reward): RewardOption[] {
  return [
    { kind: 'thread', label: `실 ${reward.thread}개`, desc: '옷장에서 옷을 만들 때 써요' },
    { kind: 'coin', label: `코인 ${reward.coin}개`, desc: '상점에서 업그레이드·소모품을 사요' },
    {
      kind: 'food',
      label: `에너지 +${reward.food}`,
      desc: `낙하 후 버틸 목숨. 가득 차 있으면 코인 ${FOOD_TO_COIN}개로 바뀌어요`,
    },
  ]
}

export interface ShuffledChoices {
  choices: string[]
  answer: number
}

/**
 * 보기를 섞고 정답 인덱스를 다시 매긴다.
 *
 * quiz.json의 정답 분포는 {0:5, 1:17, 2:16, 3:2}라 항상 1번을 찍으면 42.5%를
 * 맞힌다. JSON을 고치는 대신 출제할 때마다 섞으면 그 편향이 사라지고, 40문항
 * 풀을 통째로 외우는 것도 막힌다.
 */
export function shuffleChoices(question: Question, rng: Rng): ShuffledChoices {
  const order = question.choices.map((_, i) => i)
  // Fisher-Yates
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    const tmp = order[i]!
    order[i] = order[j]!
    order[j] = tmp
  }
  return {
    choices: order.map((i) => question.choices[i]!),
    answer: order.indexOf(question.answer),
  }
}

/**
 * 퀴즈 모달을 띄운다. 제한시간은 실시간(performance.now) 기준으로 흐른다 —
 * 게임 시간은 멈춰 있으므로 게임 시간에 연동하면 타이머가 얼어붙는다.
 */
export function showQuiz(
  mount: HTMLElement, question: Question, rng: Rng, done: (result: QuizResult) => void,
): void {
  const shuffled = shuffleChoices(question, rng)
  const reward: Reward = rewardFor(question.difficulty)
  let finished = false
  let rafId = 0

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'

  const box = document.createElement('div')
  box.className = 'panel quiz-panel'
  overlay.appendChild(box)

  const bar = document.createElement('div')
  bar.className = 'quiz-timer-bar'
  const fill = document.createElement('div')
  fill.className = 'quiz-timer-fill'
  bar.appendChild(fill)
  box.appendChild(bar)

  const title = document.createElement('h2')
  title.className = 'type-heading-sm quiz-title'
  title.textContent = '퀴즈!'
  box.appendChild(title)

  const text = document.createElement('p')
  text.className = 'type-body-sm quiz-question'
  text.textContent = question.q
  box.appendChild(text)

  const choiceList = document.createElement('div')
  choiceList.className = 'quiz-choices'
  box.appendChild(choiceList)

  const cleanup = (): void => {
    cancelAnimationFrame(rafId)
    overlay.remove()
  }

  const finishWrong = (): void => {
    if (finished) return
    finished = true
    cleanup()
    done({ correct: false, reward: null })
  }

  const askReward = (): void => {
    box.innerHTML = ''
    const h = document.createElement('h2')
    h.className = 'type-heading-sm quiz-title'
    h.textContent = '정답! 보상을 고르세요'
    box.appendChild(h)

    for (const { kind, label, desc } of rewardOptions(reward)) {
      const b = document.createElement('button')
      b.className = 'btn button-secondary quiz-reward-choice'
      const l = document.createElement('span')
      l.className = 'quiz-reward-label'
      l.textContent = label
      const d = document.createElement('span')
      d.className = 'quiz-reward-desc type-caption'
      d.textContent = desc
      b.append(l, d)
      b.onclick = () => {
        cleanup()
        done({ correct: true, reward: kind })
      }
      box.appendChild(b)
    }
  }

  shuffled.choices.forEach((choice, index) => {
    const b = document.createElement('button')
    b.className = 'quiz-choice'
    b.textContent = choice
    b.onclick = () => {
      if (finished) return
      if (index === shuffled.answer) {
        finished = true
        cancelAnimationFrame(rafId)
        askReward()
      } else {
        finishWrong()
      }
    }
    choiceList.appendChild(b)
  })

  // 실시간 타이머
  const startedAt = performance.now()
  const tick = (): void => {
    const elapsed = performance.now() - startedAt
    const ratio = Math.max(0, 1 - elapsed / TIME_LIMIT_MS)
    fill.style.width = `${ratio * 100}%`
    if (ratio <= 0) {
      finishWrong()
      return
    }
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)

  mount.appendChild(overlay)
}
