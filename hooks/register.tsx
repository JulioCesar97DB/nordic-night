import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { SCENE_HEAD, SCENE_ID, SCENE_TAIL, WINDS } from './scene.js'

// The wind is drawn at random each time the theme is set: one of 11 levels,
// -5 (hard to the left) to 5 (hard to the right), 0 being still air. It leans
// and drifts the aurora, bends the chimney smoke and sways the trees, and the
// level also gives the aurora its own length. The level rides in the scene's
// name, so the drawing always matches the wind that was picked.
const sceneName = (level: number): string => `${SCENE_ID}_w${level + 5}`
const levelOf = (scene: string): number | undefined => {
  if (!scene.startsWith(`${SCENE_ID}_w`)) {
    return undefined
  }
  const index = Number(scene.slice(SCENE_ID.length + 2))

  return Number.isInteger(index) && WINDS[index] !== undefined ? index - 5 : undefined
}
const randomLevel = (): number => Math.floor(Math.random() * WINDS.length) - 5

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
    const set = await $.theme.set(look(randomLevel()))

    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    const level = levelOf(e.props.scene)

    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || level === undefined) {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)
    const wind = WINDS[level + 5] ?? ''

    return (
      <Svg
        source={SCENE_HEAD + wind + SCENE_TAIL}
        alt="A calm northern night: a slow green and violet aurora over snowy mountains, a pine forest and a small lit cabin with a husky watching the sky"
        isInteractive
      />
    )
  })
}
