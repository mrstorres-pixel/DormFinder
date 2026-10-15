const clamp = value => Math.max(0, Math.min(1, value))
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t) }

export function roomJourney(progress) {
  const p = clamp(progress)
  const travel = smooth((p - .25) / .5)
  return {
    progress: p,
    door: .14 + smooth(p / .25) * 1.43,
    travel,
    intro: 1 - smooth(p / .22),
    ending: smooth((p - .76) / .18),
  }
}
