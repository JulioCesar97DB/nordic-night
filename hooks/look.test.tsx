import { expect, test } from 'claude-code/testing'
import type { ThemeSetArgs } from 'claude-code'

import { SCENE_HEAD, SCENE_ID, SCENE_TAIL, WINDS } from './scene.js'

const BACKDROP = {
  plugin: 'nordic-night',
  component: 'Backdrop',
  requestId: 'theme-1',
  props: { scene: `${SCENE_ID}_w7`, plugin: 'nordic-night', glass: { blur: 8, opacity: 0.4 } },
} as const
// A fixed moment for the engine's clock: 2026-11-15T12:00:00Z.
const NOW = 1794744000000

test('session start sets the dark look with the nordic scene and a light frost', async ($, on) => {
  const sets: ThemeSetArgs[] = []

  on('theme.set', (_, e) => {
    sets.push(e)

    return { value: { isDrawn: true, requestId: 'theme-1' } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: NOW }))
  on('clock.every', () => ({ value: undefined }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(sets.length).toBe(1)
  const backdrop = sets[0]?.backdrop
  const scene = (backdrop !== undefined && 'scene' in backdrop ? backdrop.scene : undefined) ?? ''
  expect(/^nordic-night-[0-9a-f]{10}_w([0-9]|10)$/.test(scene)).toBe(true)
  const glass = backdrop !== undefined && 'scene' in backdrop ? backdrop.glass : undefined
  expect(glass !== undefined && glass !== false ? glass.opacity : undefined).toBe(0.4)
  expect(sets[0]?.colors !== undefined).toBe(true)
})

test('desktop and mobile draw the scene as an SVG within the size limit', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BACKDROP, surface })
    const svg = await ui.find({ type: 'Svg' })

    expect(svg !== undefined).toBe(true)
    await ui.unmount()
  }
})

test('the scene leaves a clock slot on every animation and the mod fills them', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  expect((SCENE_HEAD.match(/@D[\d.]+@/g) ?? []).length > 40).toBe(true)
  const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  const source = String(svg?.props.source ?? '')

  expect(source.includes('@D')).toBe(false)
  expect(/animation-delay:-[\d.]+s/.test(source)).toBe(true)
  expect(source.length <= 131072).toBe(true)
  await ui.unmount()
})

test('a backdrop another plugin set is left to it', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>someone else</Text>
  })
  const ui = await $.ui.mount({ ...BACKDROP, props: { ...BACKDROP.props, scene: 'other' }, surface: 'desktop' })

  expect(await ui.find({ type: 'Svg' })).toBe(undefined)
  await ui.unmount()
})

test('every wind level fits the size limit and carries the running husky', async () => {
  expect(WINDS.length).toBe(11)
  for (const wind of WINDS) {
    const scene = SCENE_HEAD + wind + SCENE_TAIL

    expect(scene.length <= 131072).toBe(true)
    expect(scene.includes('@keyframes tr0{')).toBe(true)
    expect(scene.includes('@keyframes smkA{')).toBe(true)
  }
  expect(SCENE_HEAD.includes('@WIND@') || SCENE_TAIL.includes('@WIND@')).toBe(false)
  expect(SCENE_TAIL.includes('class="hRunPath"')).toBe(true)
  expect(SCENE_TAIL.includes('class="hSit"')).toBe(true)
})

test('a wind level outside the scale is not drawn', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  const ui = await $.ui.mount({ ...BACKDROP, props: { ...BACKDROP.props, scene: `${SCENE_ID}_w11` }, surface: 'desktop' })

  expect(await ui.find({ type: 'Svg' })).toBe(undefined)
  await ui.unmount()
})
