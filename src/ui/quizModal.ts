import type { Question, RewardKind, Reward } from '../game/quiz'
import { rewardFor } from '../game/quiz'

const TIME_LIMIT_MS = 10_000

export interface QuizResult {
  correct: boolean
  reward: RewardKind | null
}

/**
 * 퀴즈 모달을 띄운다. 제한시간은 실시간(performance.now) 기준으로 흐른다 —
 * 게임 시간은 멈춰 있으므로 게임 시간에 연동하면 타이머가 얼어붙는다.
 */
export function showQuiz(
  mount: HTMLElement, question: Question, done: (result: QuizResult) => void,
): void {
  const reward: Reward = rewardFor(question.difficulty)
  let finished = false
  let rafId = 0

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'

  const box = document.createElement('div')
  box.className = 'panel'
  overlay.appendChild(box)

  const bar = document.createElement('div')
  bar.className = 'timer-bar'
  const fill = document.createElement('div')
  fill.className = 'timer-fill'
  bar.appendChild(fill)
  box.appendChild(bar)

  const title = document.createElement('h2')
  title.textContent = '퀴즈!'
  box.appendChild(title)

  const text = document.createElement('p')
  text.className = 'quiz-q'
  text.textContent = question.q
  box.appendChild(text)

  const choiceList = document.createElement('div')
  choiceList.className = 'item-list'
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
    h.textContent = '정답! 보상을 고르세요'
    box.appendChild(h)

    const options: Array<[RewardKind, string]> = [
      ['thread', `실 ${reward.thread}개`],
      ['coin', `코인 ${reward.coin}개`],
      ['food', `에너지 +${reward.food}`],
    ]

    for (const [kind, label] of options) {
      const b = document.createElement('button')
      b.className = 'wide'
      b.textContent = label
      b.onclick = () => {
        cleanup()
        done({ correct: true, reward: kind })
      }
      box.appendChild(b)
    }
  }

  question.choices.forEach((choice, index) => {
    const b = document.createElement('button')
    b.className = 'wide'
    b.textContent = choice
    b.onclick = () => {
      if (finished) return
      if (index === question.answer) {
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
