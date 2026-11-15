import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { SCENE_HEAD, SCENE_ID, SCENE_TAIL, WINDS } from './scene.js'

// The wind: one of 11 levels, -5 (hard to the left) to 5 (hard to the right),
// 0 being still air. It leans and drifts the aurora, bends the chimney smoke
// and sways the trees, and each level gives the aurora its own length. It
// follows the clock along two slow waves that never line up the same way, so
// it wanders without a pattern, one level at a time, and a scene drawn again
// finds the wind it left. The level rides in the scene's name.
const sceneName = (level: number): string => `${SCENE_ID}_w${level + 5}`
const levelOf = (scene: string): number | undefined => {
  if (!scene.startsWith(`${SCENE_ID}_w`)) {
    return undefined
  }
  const index = Number(scene.slice(SCENE_ID.length + 2))

  return Number.isInteger(index) && WINDS[index] !== undefined ? index - 5 : undefined
}
const TAU = Math.PI * 2
const windAt = (ms: number): number => {
  const minutes = ms / 60000
  const wave = 0.62 * Math.sin((TAU * minutes) / 47) + 0.38 * Math.sin((TAU * minutes) / 17.3 + 1.1)

  return Math.max(-5, Math.min(5, Math.round(wave * 5.4)))
}

// Every animation of the scene is offset by the time of day (see the delay
// slots in scene/build-scene.mjs), so a redrawn scene carries on, not restarts.
const DAY = 86400
const atClock = (svg: string, ms: number): string => {
  const seconds = (ms / 1000) % DAY

  return svg.replace(/@D([\d.]+)@/g, (_, base: string) => `-${(Number(base) + seconds).toFixed(1)}s`)
}

// Slate-blue night surfaces, cool white text and the aurora's own hues for the
// roles: ice blue accent, aurora green, violet and a muted lamp amber.
const { theme, problems } = makeColors({
  label: 'Nordic night',
  only: 'dark',
  roles: { accent: '#7cc0e0', danger: '#e07a80', success: '#6fd3a8', warning: '#e3b866', pro: '#a993e6' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0d1219',
        'surface-1': '#121923',
        'surface-2': '#161e2a',
        'surface-3': '#161e2a',
        'text-primary': '#e6edf3',
        'text-secondary': '#b9c4cf',
        'text-muted': '#95a1b0',
      },
    },
  },
})

// A light frost: the landscape stays readable as a landscape, the words stay sharp.
const look = (level: number): ThemeSetArgs => ({
  colors: theme,
  backdrop: { scene: sceneName(level), glass: { blur: 8, tint: '#0d1219', opacity: 0.4 } },
})

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // While tuning the colors: the line that would stop Desktop painting the theme.
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    let level = windAt(await $.clock.now())
    const set = await $.theme.set(look(level))

    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }
    // When the wind has moved on a level, the scene is set again with it.
    $.clock.every(120000, () => {
      void $.clock.now().then(async now => {
        const blowing = windAt(now)

        if (blowing !== level) {
          level = blowing
          await $.theme.set(look(level))
        }
      })
    })

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    const level = levelOf(e.props.scene)

    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || level === undefined) {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)
    const wind = WINDS[level + 5] ?? ''

    return (
      <Svg
        source={atClock(SCENE_HEAD, await $.clock.now()) + wind + SCENE_TAIL}
        alt="A calm northern night: a slow green and violet aurora over snowy mountains, a pine forest and a small lit cabin with a husky watching the sky"
        isInteractive
      />
    )
  })
}
