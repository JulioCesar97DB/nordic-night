// Builds the "Nordic night" backdrop: a calm northern sky with the Milky Way,
// slow aurora curtains, snowy mountains in the mist, a pine forest and a log
// cabin where a husky sits in the snow watching the lights.
//
// Everything that moves is slow and runs at a few frames per second, so the
// scene stays quiet behind the conversation and cheap to draw.
//
// Usage:
//   node scene/build-scene.mjs              -> writes hooks/scene.js
//   node scene/build-scene.mjs night.svg    -> also saves the SVG to preview it in a browser
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// DIAG=1 adds a test badge at the top: it shows whether the surface applies
// the scene's CSS, plays CSS animations and plays SMIL animations.
const DIAG = process.env.DIAG === '1'
const diagBadge = `<g font-family="-apple-system,Helvetica,Arial,sans-serif" font-weight="800" text-anchor="middle">
<rect x="560" y="110" width="480" height="170" rx="24" fill="#05070c" opacity=".85"/>
<text x="800" y="158" font-size="38" fill="#ffffff">TEST</text>
<circle class="dA" cx="680" cy="220" r="34" fill="#e5484d"/><text x="680" y="233" font-size="36" fill="#05070c">1</text>
<circle class="dB" cx="800" cy="220" r="34" fill="#3b82f6"/><text x="800" y="233" font-size="36" fill="#05070c">2</text>
<circle cx="920" cy="220" r="34" fill="#facc15"><animate attributeName="opacity" values="1;.1;1" dur="1.2s" repeatCount="indefinite"/></circle><text x="920" y="233" font-size="36" fill="#05070c">3</text>
</g>`

// ---------- helpers ----------
let seed = 20261115
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const R = (a, b) => a + (b - a) * rnd()
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2
const pick = list => list[Math.floor(rnd() * list.length)]
const n = v => Math.round(v * 10) / 10
const TAU = Math.PI * 2
const kf = (name, frames) => `@keyframes ${name}{${frames.map(([p, css]) => `${n(p)}%{${css}}`).join('')}}`

// Compact path data: the first point absolute, then integer relative steps.
const num = (v, first) => (first || v < 0 ? `${v}` : ` ${v}`)
const poly = (pts, close = true) => {
  let x0 = Math.round(pts[0][0])
  let y0 = Math.round(pts[0][1])
  let d = `M${x0} ${y0}l`
  for (let i = 1; i < pts.length; i++) {
    const x = Math.round(pts[i][0])
    const y = Math.round(pts[i][1])
    d += num(x - x0, i === 1) + num(y - y0, false)
    x0 = x
    y0 = y
  }
  return close ? `${d}z` : d
}

// A smooth loop sampled into keyframes and played in small steps: the eye sees
// a slow, continuous drift while the page repaints only ~FPS times a second.
const FPS = 4
const css = []
const anims = []
// The wind: one value from -1 (hard to the left) to 1 (hard to the right),
// picked at random by the mod on a scale of 11 levels. A loop marked `wind`
// gets it (and the aurora's length for that level) and is built per level.
const windLoops = []
const windKf = (cls, samples, fn) => windLoops.push({ cls, samples, fn })
const loop = (cls, dur, fn, { samples = 10, delay = 0, wind = false, fps = FPS } = {}) => {
  if (wind) windKf(cls, samples, fn)
  else {
    const frames = []
    for (let i = 0; i <= samples; i++) frames.push([(i / samples) * 100, fn(i / samples)])
    css.push(kf(cls, frames))
  }
  const steps = Math.max(1, Math.round((dur * fps) / samples))
  anims.push(`.${cls}{animation:${cls} ${dur}s steps(${steps},end) infinite${delay ? `;animation-delay:-${n(delay)}s` : ''}}`)
}
const wave = t => Math.sin(t * TAU)

const W = 1600
const H = 1000

// ---------- sky ----------
const sky = `<rect width="${W}" height="${H}" fill="url(#sky)"/><ellipse cx="800" cy="760" rx="1300" ry="330" fill="url(#horizon)"/>`

// ---------- stars and the Milky Way ----------
// Many small dots drawn as one path per look: a zero-length segment with a
// round cap is a dot, which keeps hundreds of stars to a few elements.
const dotBins = new Map()
const dot = (x, y, size, color, alpha) => {
  const key = `${color}|${size}|${alpha}`
  if (!dotBins.has(key)) dotBins.set(key, [])
  dotBins.get(key).push(`M${Math.round(x)} ${Math.round(y)}h0`)
}
const flushDots = () => {
  let s = ''
  for (const [key, d] of dotBins) {
    const [color, size, alpha] = key.split('|')
    s += `<path d="${d.join('')}" stroke="${color}" stroke-width="${size}" stroke-linecap="round" opacity="${alpha}"/>`
  }
  dotBins.clear()
  return s
}
for (let i = 0; i < 320; i++) {
  const r = rnd()
  dot(R(0, W), Math.pow(rnd(), 1.35) * 640, rnd() < 0.88 ? pick([1, 1.4, 1.8]) : 2.6, r < 0.7 ? '#dfe8ff' : r < 0.85 ? '#fff1d6' : '#c9ddff', pick([0.3, 0.5, 0.7, 0.85]))
}
const mw = { x: 520, y: 210, angle: -17 }
for (let i = 0; i < 300; i++) {
  const u = R(-900, 900)
  const v = gauss() * 70
  const a = (mw.angle * Math.PI) / 180
  const x = mw.x + u * Math.cos(a) - v * Math.sin(a)
  const y = mw.y + u * Math.sin(a) + v * Math.cos(a)
  if (x < 0 || x > W || y < 0 || y > 620) continue
  dot(x, y, pick([0.8, 1.1, 1.4]), '#e8eeff', pick([0.2, 0.35, 0.5]))
}
const stars = flushDots()
let twinkle = ''
for (let i = 0; i < 10; i++) {
  const x = R(30, W - 30)
  const y = R(20, 480)
  twinkle += `<circle class="tw${i}" cx="${Math.round(x)}" cy="${Math.round(y)}" r="${n(R(0.9, 1.4))}" fill="#eef3ff"/>`
  const lo = R(0.2, 0.4)
  loop(`tw${i}`, R(7, 13), t => `opacity:${n(lo + (0.95 - lo) * (0.5 + 0.5 * wave(t)))}`, { samples: 8, delay: R(0, 13) })
}
const glints = [[1180, 92], [262, 140], [1452, 300], [760, 58]]
  .map(([x, y], i) => `<g opacity="${[0.8, 0.6, 0.55, 0.5][i]}"><circle cx="${x}" cy="${y}" r="5" fill="url(#starGlow)"/><path d="M${x - 7} ${y}h14M${x} ${y - 7}v14" stroke="#eef3ff" stroke-width=".6" opacity=".55"/><circle cx="${x}" cy="${y}" r="1.4" fill="#fff"/></g>`)
  .join('')
const starsLayer = `<g transform="rotate(${mw.angle} ${mw.x} ${mw.y})"><ellipse cx="${mw.x}" cy="${mw.y}" rx="980" ry="120" fill="url(#milky)"/><ellipse cx="${mw.x + 80}" cy="${mw.y + 8}" rx="620" ry="46" fill="url(#milkyCore)"/></g>${stars}${twinkle}${glints}`

// ---------- aurora ----------
// Each curtain is a row of thin vertical rays standing on a wavy baseline,
// softened by a two-level blur: fine streaks plus a wide glow.
const curtains = [
  { id: 'a2', y0: 545, amp: [55, 22], len: [1700, 610], ph: [1.7, 0.4], h: [210, 170], dx: 13, alpha: 0.42, grad: 'ag2', x0: -200, x1: 1800, fold: [1100, 2.1], drift: [12, 173], breathe: [0.78, 0.95, 67], sway: [0.6, 131], stretch: [0.975, 1.02] },
  { id: 'a1', y0: 630, amp: [50, 22], len: [1450, 520], ph: [0.3, 1.1], h: [240, 190], dx: 11, alpha: 0.6, grad: 'ag1', x0: -200, x1: 1800, fold: [880, 0.6], drift: [16, 151], breathe: [0.84, 1, 53], sway: [0.7, 113], stretch: [0.97, 1.025] },
  { id: 'a3', y0: 650, amp: [40, 16], len: [1100, 430], ph: [2.6, 2.2], h: [160, 130], dx: 11, alpha: 0.5, grad: 'ag3', x0: -150, x1: 1050, fold: [640, 1.4], drift: [18, 139], breathe: [0.65, 0.85, 47], sway: [0.8, 127], stretch: [0.97, 1.03] },
]
let aurora = ''
for (const c of curtains) {
  const base = x => c.y0 + c.amp[0] * Math.sin((TAU * x) / c.len[0] + c.ph[0]) + c.amp[1] * Math.sin((TAU * x) / c.len[1] + c.ph[1])
  let rays = ''
  for (let x = c.x0; x <= c.x1; x += c.dx) {
    const yb = base(x)
    const fold = 0.5 + 0.5 * Math.sin((TAU * x) / c.fold[0] + c.fold[1])
    const ends = Math.min(1, (x - c.x0) / 260, (c.x1 - x) / 260)
    const h = Math.round((c.h[0] + c.h[1] * fold) * R(0.7, 1.15))
    const a = c.alpha * Math.max(0, ends) * (0.3 + 0.7 * fold) * R(0.45, 1)
    if (a < 0.03) continue
    const w = Math.round(c.dx * R(0.9, 1.7))
    // A ray is its own box, so the gradient runs from its foot to its tip.
    rays += `<path d="M${Math.round(x - w / 2)} ${Math.round(yb - h)}h${w}v${h}h-${w}z" opacity="${a.toFixed(2).replace(/^0/, '')}"/>`
  }
  aurora += `<g class="${c.id}d"><g class="${c.id}b"><g class="${c.id}s"><g filter="url(#aur)"><g fill="url(#${c.grad})">${rays}</g></g></g></g></g>`
  const [dAmp, dDur] = c.drift
  loop(`${c.id}d`, dDur, (t, w) => `transform:translateX(${n(dAmp * wave(t) + w * 90)}px)`, { delay: R(0, dDur), wind: true })
  const [lo, hi, bDur] = c.breathe
  loop(`${c.id}b`, bDur, t => `opacity:${(lo + (hi - lo) * (0.5 + 0.5 * wave(t))).toFixed(2)}`, { samples: 8, delay: R(0, bDur) })
  const [sk, sDur] = c.sway
  const [s0, s1] = c.stretch
  // Sway and stretch in one loop: two waves at different speeds read as a living curtain.
  loop(`${c.id}s`, sDur, (t, w, len) => `transform:skewX(${n(-w * 16 + sk * (1 + Math.abs(w)) * wave(t))}deg) scaleY(${(len * (s0 + (s1 - s0) * (0.5 + 0.5 * wave(t * 2 + 0.25)))).toFixed(3)})`, { samples: 14, delay: R(0, sDur), wind: true })
  anims.push(`.${c.id}s{transform-origin:800px ${c.y0}px}`)
}
const auroraGlow = `<g class="glowA"><ellipse cx="520" cy="470" rx="720" ry="230" fill="url(#glowGreen)"/><ellipse cx="760" cy="660" rx="1050" ry="150" fill="url(#glowGreen)"/></g><g class="glowB"><ellipse cx="1150" cy="360" rx="620" ry="210" fill="url(#glowViolet)"/></g>`
loop('glowA', 43, t => `opacity:${(0.8 + 0.15 * (0.5 + 0.5 * wave(t))).toFixed(2)}`, { samples: 8 })
loop('glowB', 61, t => `opacity:${(0.7 + 0.15 * (0.5 + 0.5 * wave(t + 0.3))).toFixed(2)}`, { samples: 8 })
// The colours drift too, very slowly: the curtain tops wander between violet and teal.
css.push(kf('hue1', [[0, 'stop-color:#7a5cff'], [25, 'stop-color:#5f7dff'], [50, 'stop-color:#3fc6d8'], [75, 'stop-color:#5f7dff'], [100, 'stop-color:#7a5cff']]))
css.push(kf('hue2', [[0, 'stop-color:#c07bff'], [25, 'stop-color:#e07bd0'], [50, 'stop-color:#8a8cff'], [100, 'stop-color:#c07bff']]))
anims.push('.hue1{animation:hue1 150s steps(75,end) infinite}.hue2{animation:hue2 190s steps(95,end) infinite}')

// ---------- mountains ----------
// A ridge: peaks shaped like worn pyramids plus layered noise for the rock.
const ridge = (baseY, peaks, rough, step) => {
  const ph = [R(0, TAU), R(0, TAU), R(0, TAU), R(0, TAU)]
  const pts = []
  for (let x = -20; x <= W + 20; x += step) {
    let lift = 0
    for (const p of peaks) {
      const u = (x - p.x) / p.w
      const au = Math.abs(u)
      // Steeper on the shadow (right) side, like wind-cut northern peaks.
      if (au < 1) lift = Math.max(lift, p.h * Math.pow(1 - au, u > 0 ? (p.k ?? 1.25) * 1.15 : (p.k ?? 1.25)))
    }
    const noise = rough * (0.5 * Math.sin(x / 23 + ph[0]) + 0.28 * Math.sin(x / 9.7 + ph[1]) + 0.14 * Math.sin(x / 4.3 + ph[2]) + 0.08 * Math.sin(x / 2.1 + ph[3]))
    pts.push([x, baseY - lift - noise * (0.35 + lift / 180)])
  }
  return pts
}
const yAt = (pts, x) => {
  const step = pts[1][0] - pts[0][0]
  const i = Math.max(0, Math.min(pts.length - 2, Math.floor((x - pts[0][0]) / step)))
  const f = (x - pts[i][0]) / step
  return pts[i][1] * (1 - f) + pts[i + 1][1] * f
}
// Light comes from the upper left: each summit and shoulder lights the face
// between the valley on its left and a spur running down from it.
const rangeFaces = (pts, peaks, bottom, look) => {
  let lit = ''
  let snowRidge = ''
  let rocks = ''
  let snowStreaks = ''
  const idx = x => Math.max(0, Math.min(pts.length - 1, Math.round((x - pts[0][0]) / (pts[1][0] - pts[0][0]))))
  for (const p of [...peaks].sort((a, b) => a.h - b.h)) {
    // the summit near the peak's centre, and the lowest point of the ridge to its left
    let top = idx(p.x - p.w * 0.25)
    for (let k = top; k <= idx(p.x + p.w * 0.25); k++) if (pts[k][1] < pts[top][1]) top = k
    let valley = idx(p.x - p.w)
    for (let k = valley; k < top; k++) if (pts[k][1] > pts[valley][1]) valley = k
    if (top - valley < 3) continue
    const [px, py] = pts[top]
    // the arete: a ragged line from the summit down, leaning a little into the shade
    const spur = []
    let x = px
    for (let y = py; y <= bottom; y += 7) {
      spur.push([x, y])
      x += R(-0.35, 0.75) * 7 * (0.35 + (y - py) / 300)
    }
    lit += poly([...pts.slice(valley, top + 1), ...spur, [pts[valley][0], bottom]])
    snowRidge += poly(pts.slice(valley, top + 1).map(([a, b]) => [a, b + 1]), false)
    const height = pts[valley][1] - py
    // dark rock breaking through the snow on the lit face
    for (let r = 0; r < Math.round(height / 11); r++) {
      const rx = R(pts[valley][0] + 4, px - 3)
      const ry = yAt(pts, rx) + R(3, 40)
      // streaks run down the fall line, which on this face heads down and to the left
      const len = R(6, 30)
      const lean = -R(0.2, 0.75)
      const wid = R(1.2, 4.5)
      const kink = R(-2, 2)
      rocks += poly([[rx, ry], [rx + lean * len * 0.5 + kink, ry + len * 0.5], [rx + lean * len, ry + len], [rx + lean * len + wid * R(0.3, 0.8), ry + len - R(1, 4)], [rx + lean * len * 0.5 + kink + wid, ry + len * 0.5], [rx + wid * R(0.6, 1.2), ry + R(-1, 2)]])
    }
    // pale snow gullies on the shaded side
    for (let k = 0; k < Math.round(height / 30) + 2; k++) {
      let sx = px + R(8, p.w * 0.35)
      let sy = yAt(pts, sx) + R(4, 12)
      const line = []
      const len = R(16, 50)
      for (let t = 0; t < 5; t++) {
        line.push([sx, sy])
        sx += R(-0.5, 3.5)
        sy += len / 5
      }
      snowStreaks += poly(line, false)
    }
  }
  return `<path d="${lit}" fill="url(#${look.litFill})"/><path d="${rocks}" fill="${look.rock}" opacity=".45"/><path d="${snowStreaks}" fill="none" stroke="${look.streak}" stroke-width="1.2" stroke-linecap="round" opacity=".22"/><path d="${snowRidge}" fill="none" stroke="${look.cornice}" stroke-width="1.2" opacity="${look.corniceAlpha}"/>`
}

const farPeaks = [
  { x: -40, h: 95, w: 220 }, { x: 250, h: 155, w: 270 }, { x: 610, h: 112, w: 230 },
  { x: 1060, h: 228, w: 320, k: 1.15 }, { x: 1250, h: 150, w: 210 }, { x: 1440, h: 138, w: 250 }, { x: 1660, h: 105, w: 220 },
]
const far = ridge(700, farPeaks, 10, 4)
const farLayer = `<path d="${poly([...far, [W + 20, H + 40], [-20, H + 40]])}" fill="url(#farFill)"/>${rangeFaces(far, farPeaks, 780, { litFill: 'farLit', rock: '#16212f', streak: '#86a0bf', cornice: '#bcd2ea', corniceAlpha: 0.45 })}<path d="${poly(far, false)}" fill="none" stroke="#5ad6b0" stroke-width="1.4" opacity=".14"/>`

const midPeaks = [{ x: 120, h: 105, w: 320 }, { x: 520, h: 72, w: 260 }, { x: 880, h: 96, w: 300 }, { x: 1290, h: 118, w: 330 }, { x: 1620, h: 80, w: 260 }]
const mid = ridge(800, midPeaks, 7, 5)
const midLayer = `<path d="${poly([...mid, [W + 20, H + 40], [-20, H + 40]])}" fill="url(#midFill)"/>${rangeFaces(mid, midPeaks, 860, { litFill: 'midLit', rock: '#0d1522', streak: '#5a7190', cornice: '#7f97b5', corniceAlpha: 0.22 })}`

// A dense far forest climbing the mid hills: one ragged treeline.
const forestEdge = []
for (let x = -20; x <= W + 20; x += 4.5) {
  const ground = yAt(mid, Math.min(W + 20, Math.max(-20, x))) + 34 + 10 * Math.sin(x / 70)
  forestEdge.push([x, ground - R(10, 30)], [x + 2.2, ground - R(0, 6)])
}
const midForest = `<path d="${poly([...forestEdge, [W + 20, 920], [-20, 920]])}" fill="#0b1320"/>`

// ---------- pines ----------
// A spruce: drooping, ragged tiers that thin towards a leader at the top. The
// front trees carry snow on the upper side of their branches.
const spruce = (x, y, h, withSnow) => {
  const levels = Math.max(7, Math.round(h / 13))
  const left = []
  const right = []
  const snow = []
  const maxW = h * R(0.26, 0.32)
  for (let i = 0; i < levels; i++) {
    const t = i / levels
    const yy = y - h * 0.07 - h * 0.9 * t
    const step = (h * 0.9) / levels
    const reach = maxW * Math.pow(1 - t, 0.92) * R(0.7, 1.15) + 2
    const droop = step * R(0.25, 0.6)
    const inner = reach * R(0.18, 0.32)
    for (const [side, out] of [[-1, left], [1, right]]) {
      const r = reach * R(0.85, 1.1)
      // from the trunk out to the drooping tip, a needle clump on the way
      out.push([x + side * inner, yy - step * 0.55], [x + side * r * 0.55, yy - step * 0.15 + R(-1.5, 1.5)], [x + side * r * 0.7, yy - step * 0.35], [x + side * r, yy + droop])
      if (withSnow && rnd() < 0.5 && t < 0.9) {
        const a = [x + side * inner * 1.4, yy - step * 0.55]
        const b = [x + side * r * R(0.45, 0.8), yy + droop * 0.25]
        snow.push(poly([a, [b[0], b[1] - R(1.5, 3)], b, [a[0], a[1] + R(2, 3.5)]]))
      }
    }
  }
  const tip = [x + R(-1.5, 1.5), y - h]
  const body = poly([[x - 1.6, y + 3], ...left, tip, ...right.reverse(), [x + 1.6, y + 3]])
  return { body, snow: snow.join('') }
}
const groundY = x => 892 + 16 * Math.sin(x / 260 + 0.6) + 9 * Math.sin(x / 97 + 1.9)
const treeRow = (from, to, count, hMin, hMax, yOff, withSnow) => {
  let body = ''
  let snow = ''
  const xs = Array.from({ length: count }, () => R(from, to)).sort((a, b) => a - b)
  for (const x of xs) {
    const t = spruce(x, groundY(x) + yOff + R(-4, 6), R(hMin, hMax), withSnow)
    body += t.body
    snow += t.snow
  }
  return { body, snow }
}
const back = [treeRow(-30, 420, 24, 70, 150, -8, false), treeRow(1290, 1640, 20, 70, 150, -8, false), treeRow(560, 760, 5, 40, 70, -6, false)]
const front = [treeRow(-40, 330, 13, 150, 260, 6, true), treeRow(1360, 1650, 11, 150, 250, 6, true)]
const stand = (k, row, cx, fill, withSnow) => {
  const dur = [6.4, 7.6, 5.2, 7, 5.8][k]
  loop(`tr${k}`, dur, (t, w) => `transform:skewX(${(-w * 1.6 + (0.25 + 1.1 * Math.abs(w)) * (0.7 * wave(t) + 0.3 * wave(t * 3 + 0.2))).toFixed(2)}deg)`, { samples: 12, delay: k * 1.3, wind: true, fps: 10 })
  anims.push(`.tr${k}{transform-origin:${cx}px ${Math.round(groundY(cx))}px}`)
  return `<g class="tr${k}"><path d="${row.body}" fill="${fill}"/>${withSnow ? `<path d="${row.snow}" fill="#8299b8" opacity=".42"/>` : ''}</g>`
}
const backPines = [195, 1465, 660].map((cx, k) => stand(k, back[k], cx, '#0a101b', false)).join('')
const frontShadows = [[-40, 330], [1360, 1650]].map(([a, b]) => `<ellipse cx="${(a + b) / 2}" cy="${Math.round(groundY((a + b) / 2) + 22)}" rx="${(b - a) / 2 + 40}" ry="20" fill="#05080f" opacity=".5"/>`).join('')
const frontPines = frontShadows + [145, 1505].map((cx, k) => stand(k + 3, front[k], cx, '#060a12', true)).join('')

// ---------- the log cabin ----------
const cx = 1238
const cy = Math.round(groundY(cx) + 4)
const wall = { l: cx - 56, r: cx + 56, t: cy - 54 }
const roofPeak = [cx, cy - 104]
const eaveL = [cx - 74, cy - 50]
const eaveR = [cx + 74, cy - 50]
let logs = ''
for (let y = wall.t + 7; y < cy; y += 7.5) logs += `M${wall.l} ${Math.round(y)}h${wall.r - wall.l}`
let logEnds = ''
for (let y = wall.t + 4; y < cy; y += 7.5) logEnds += `<circle cx="${wall.l - 2}" cy="${Math.round(y)}" r="3.6"/><circle cx="${wall.r + 2}" cy="${Math.round(y)}" r="3.6"/>`
// snow on the roof: a thick blanket that curls over the eaves
const snowRoof = poly([
  [eaveL[0] - 6, eaveL[1] + 3], [eaveL[0] - 4, eaveL[1] - 4],
  [roofPeak[0] - 2, roofPeak[1] - 9], [roofPeak[0] + 3, roofPeak[1] - 9],
  [eaveR[0] + 4, eaveR[1] - 4], [eaveR[0] + 6, eaveR[1] + 3], [eaveR[0] + 1, eaveR[1] + 5],
  [roofPeak[0] + 2, roofPeak[1] + 3], [roofPeak[0] - 2, roofPeak[1] + 3], [eaveL[0] - 1, eaveL[1] + 5],
])
let icicles = ''
for (const [ex, dir] of [[eaveL[0], 1], [eaveR[0], -1]]) {
  for (let k = 0; k < 7; k++) {
    const ix = ex + dir * (6 + k * 9 + R(-2, 2))
    const iy = eaveL[1] + 4 + k * 0.6
    const len = Math.round(R(4, 11))
    icicles += `M${Math.round(ix - 1.5)} ${Math.round(iy)}l1.5 ${len} 1.5-${len}z`
  }
}
const wood = (x, y) => Array.from({ length: 3 }, (_, row) => Array.from({ length: 4 - row }, (_, k) => `<circle cx="${x + k * 7 + row * 3.5}" cy="${y - row * 6.5}" r="3.4"/>`).join('')).join('')
let steps = ''
const door = { x: cx + 16, w: 22 }
const hx = 1112
const hy = Math.round(groundY(hx) + 4)
for (let k = 0; k < 14; k++) {
  const t = k / 13
  const px = door.x + door.w / 2 + (hx + 30 - door.x - door.w / 2) * t
  const py = cy + 6 + Math.sin(t * Math.PI) * 14 + (hy - cy) * t
  steps += `<ellipse cx="${Math.round(px + (k % 2 ? 4 : -4))}" cy="${Math.round(py)}" rx="3.4" ry="1.6"/>`
}
const cabin = `
<ellipse cx="${cx - 10}" cy="${cy + 12}" rx="170" ry="30" fill="url(#warmSpill)"/>
<g class="win"><circle cx="${cx - 26}" cy="${cy - 30}" r="90" fill="url(#warmGlow)"/></g>
<g fill="#0b1019" opacity=".55">${steps}</g>
<rect x="${cx + 34}" y="${cy - 110}" width="15" height="40" fill="#121820"/>
<path d="M${cx + 34} ${cy - 100}h15M${cx + 34} ${cy - 90}h15M${cx + 34} ${cy - 80}h15M${cx + 41} ${cy - 110}v10M${cx + 38} ${cy - 100}v10M${cx + 44} ${cy - 90}v10" stroke="#1d2532" stroke-width="1.2"/>
<path d="${poly([[cx + 31, cy - 110], [cx + 52, cy - 110], [cx + 51, cy - 115], [cx + 41, cy - 118], [cx + 32, cy - 115]])}" fill="#9fb4d0"/>
<rect x="${wall.l}" y="${wall.t}" width="${wall.r - wall.l}" height="${cy - wall.t}" fill="#17120f"/>
<path d="${logs}" stroke="#2a201a" stroke-width="2"/>
<g fill="#2b211b" stroke="#120d0b" stroke-width="1">${logEnds}</g>
<path d="${poly([eaveL, roofPeak, eaveR, [eaveR[0] - 6, eaveR[1] + 4], [eaveL[0] + 6, eaveL[1] + 4]])}" fill="#0f0c0b"/>
<path d="${poly([[cx - 16, wall.t + 2], [cx, roofPeak[1] + 16], [cx + 16, wall.t + 2]])}" fill="#1c1612"/>
<path d="${snowRoof}" fill="url(#roofSnow)"/>
<path d="${icicles}" fill="#a9c2df" opacity=".7"/>
<g class="win">
  <rect x="${cx - 40}" y="${cy - 40}" width="28" height="22" fill="url(#windowLight)"/>
  <path d="M${cx - 26} ${cy - 40}v22M${cx - 40} ${cy - 29}h28" stroke="#3a2416" stroke-width="2.2"/>
  <rect x="${cx - 40}" y="${cy - 40}" width="28" height="22" fill="none" stroke="#2a1a10" stroke-width="2.4"/>
</g>
<path d="${poly([[cx - 44, cy - 17], [cx - 8, cy - 17], [cx - 9, cy - 21], [cx - 26, cy - 23], [cx - 43, cy - 21]])}" fill="#9fb4d0"/>
<rect x="${door.x}" y="${cy - 38}" width="${door.w}" height="38" fill="#0c0907"/>
<path d="M${door.x + 7} ${cy - 38}v38M${door.x + 14} ${cy - 38}v38" stroke="#1a130f" stroke-width="1.4"/>
<circle cx="${door.x + 18}" cy="${cy - 18}" r="1.3" fill="#c79a5a"/>
<g class="lamp"><circle cx="${door.x + 29}" cy="${cy - 34}" r="16" fill="url(#lampGlow)"/><rect x="${door.x + 26}" y="${cy - 38}" width="6" height="8" rx="1" fill="#ffd28a"/></g>
<g fill="#3a2a1f" stroke="#140f0b" stroke-width="1">${wood(wall.l - 30, cy - 4)}</g>
<path d="${poly([[wall.l - 34, cy - 20], [wall.l - 22, cy - 26], [wall.l - 6, cy - 24], [wall.l + 2, cy - 18], [wall.l - 4, cy - 17], [wall.l - 30, cy - 17]])}" fill="#8ea6c4"/>
<path d="${poly([[wall.l - 50, cy + 6], [wall.l - 30, cy - 6], [wall.l + 10, cy - 4], [cx - 10, cy - 2], [wall.r - 10, cy - 3], [wall.r + 14, cy - 6], [wall.r + 40, cy + 6]])}" fill="url(#drift)"/>`
loop('win', 6, t => `opacity:${n(0.84 + 0.16 * (0.5 + 0.5 * wave(t)) - 0.05 * (0.5 + 0.5 * wave(t * 3)))}`, { samples: 12 })
loop('lamp', 3.4, t => `opacity:${n(0.85 + 0.15 * (0.5 + 0.5 * wave(t)))}`, { samples: 8 })
// Chimney smoke: eight soft puffs share two smooth (unstepped) paths. Each
// rises, drifts with the wind in a slow curl, swells and thins out.
let smoke = ''
const plume = (name, spread, curl) =>
  windKf(name, 12, (t, w) => {
    const x = (w * 125 + spread) * Math.pow(t, 1.3) + curl * Math.sin(t * 5.2) * t
    const y = -150 * (1 - 0.4 * Math.abs(w)) * Math.pow(t, 0.85)
    const fade = t < 0.12 ? t / 0.12 : Math.pow(1 - t, 1.4) / Math.pow(0.88, 1.4)
    return `transform:translate(${n(x)}px,${n(y)}px) scale(${n(0.45 + 2.4 * t)});opacity:${(0.5 * fade).toFixed(2)}`
  })
plume('smkA', -10, 9)
plume('smkB', 8, -7)
const SMOKE = 22
for (let i = 0; i < 8; i++) {
  const big = 7 + (i % 3) * 2
  // per-puff rules instead of style attributes, which a surface may strip
  anims.push(`.sm${i}{animation-name:smk${i % 2 ? 'B' : 'A'};animation-delay:-${n((i * SMOKE) / 8)}s}`)
  smoke += `<g class="sm sm${i}"><circle cx="${cx + 41 + (i % 2 ? 2 : -2)}" cy="${cy - 121}" r="${big}" fill="url(#smoke)"/><circle cx="${cx + 41 + (i % 2 ? -3 : 4)}" cy="${cy - 125}" r="${big - 2}" fill="url(#smoke)"/></g>`
}
anims.push(`.sm{transform-box:fill-box;transform-origin:center;opacity:0;animation-duration:${SMOKE}s;animation-timing-function:linear;animation-iteration-count:infinite}`)

// ---------- the husky ----------
// Sitting in the snow in profile, head raised to the sky: grey saddle, white
// chest, legs and mask, the aurora catching the top of its coat and the cabin
// light warming its back.
const husky = `<g transform="translate(${hx} ${hy}) scale(.6)">
<ellipse cx="2" cy="1" rx="34" ry="5" fill="#04060b" opacity=".6"/>
<g class="hBreathe">
<g transform="translate(22 -5)"><g class="hTail"><g transform="translate(-22 5)">
<path d="M22 -5C32 -3 40 -8 38 -16C36 -22 29 -21 29 -16C29 -12 33 -12 32 -9C30 -6 25 -7 21 -8Z" fill="#454d5d"/>
<path d="M32 -9C30 -6 25 -7 21 -8L22 -5C30 -3 36 -6 37 -10Z" fill="#b8c3d3"/>
<path d="M30 -6l3 2M34 -9l3 1M37 -14l3 0M35 -19l2 -2" stroke="#59627380" stroke-width="1" stroke-linecap="round"/>
</g></g></g>
<path d="M-20 0C-21 -10 -22 -20 -22 -28C-22 -38 -21 -44 -16 -50C-15 -54 -17 -58 -18 -62L-8 -70C-2 -62 4 -50 11 -40C17 -32 24 -22 24 -12C24 -4 19 0 10 0Z" fill="#3e4655"/>
<path d="M-8 -70C-2 -62 4 -50 11 -40C14 -36 17 -32 19 -27C12 -33 6 -40 2 -48C-1 -55 -4 -62 -8 -70Z" fill="#2c323e"/>
<path d="M3 -3C2 -14 9 -25 17 -23C25 -20 25 -7 18 0H6Z" fill="#4a5262"/>
<path d="M-2 -3H10C11 -1 10 1 8 1H-2C-4 1 -4 -3 -2 -3Z" fill="#c4cedc"/>
<path d="M-16 -50C-20 -46 -22 -40 -22 -33L-24 -30L-21 -28L-22 -24L-19 -22C-17 -20 -14 -19 -10 -19C-10 -28 -9 -40 -7 -50Z" fill="#c4cedc"/>
<path d="M-11 -20C-10 -12 -10 -6 -9 -1H-4C-5 -7 -5 -14 -6 -21Z" fill="#a3aebf"/>
<path d="M-19 -21C-18 -13 -19 -6 -20 -1H-13C-13 -7 -12 -14 -11 -21Z" fill="#c4cedc"/>
<path d="M-21 -44l-3 2 3 1-3 3 3 1-2 3M-12 -46l-1 5M-15 -40l-1 5M-12 -33l-1 5M-17 -30l0 4" stroke="#8f9bad" stroke-width=".9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
<path d="M0 -52l3 6M5 -44l4 6M10 -36l4 7M15 -28l3 7M8 -24l2 6M18 -18l1 6M12 -12l-1 5" stroke="#2a303b" stroke-width="1" stroke-linecap="round" opacity=".7"/>
<path d="M-9 -66l-3 3 3 0-2 3" stroke="#c4cedc" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".8"/>
<ellipse cx="-16.5" cy="-.6" rx="4.6" ry="1.8" fill="#d2dae6"/><ellipse cx="-6.5" cy="-.6" rx="3.6" ry="1.6" fill="#b3bdcc"/>
<path d="M-9 -79L-8 -95L-2 -80Z" fill="#3e4655"/><path d="M-7.6 -82L-7 -91L-4 -82Z" fill="#7d6a72"/>
<g transform="translate(1 -77)"><g class="hEar"><path d="M-4 0L0 -15L4 1Z" fill="#363d4b"/></g></g>
<path d="M-4 -63C-1 -71 -5 -79 -13 -82C-17 -83 -21 -85 -26 -89L-31 -91C-34 -90 -34 -86 -31 -84L-24 -75C-20 -69 -15 -65 -4 -63Z" fill="#3e4655"/>
<path d="M-31 -84L-24 -75C-20 -69 -15 -66 -9 -65C-12 -70 -16 -73 -21 -76L-28 -83Z" fill="#c4cedc"/>
<path d="M-15 -76C-13 -74 -11 -72 -8 -71C-10 -74 -12 -76 -14 -78Z" fill="#c4cedc"/>
<circle cx="-16" cy="-79.5" r="1.4" fill="#0a0d12"/><circle cx="-16.4" cy="-80" r=".45" fill="#9fd8ff"/>
<path d="M-17 -82.5C-15.5 -83.5 -14 -83.5 -13 -82.6" stroke="#c4cedc" stroke-width="1.1" fill="none" stroke-linecap="round"/>
<ellipse cx="-32" cy="-88.5" rx="2" ry="1.6" fill="#0a0d12"/>
<path d="M-31 -91C-26 -89 -21 -85 -13 -82C-5 -79 -1 -71 -4 -63M-8 -95L-2 -80M1 -92L5 -76M-8 -70C-2 -62 4 -50 11 -40C17 -32 24 -22 24 -12" stroke="#6fe0b8" stroke-width="1" fill="none" opacity=".55" stroke-linecap="round"/>
<path d="M11 -40C17 -32 24 -22 24 -12C24 -4 19 0 12 0M38 -16C40 -8 32 -3 22 -5" stroke="#ffb66a" stroke-width="1.3" fill="none" opacity=".5" stroke-linecap="round"/>
</g>
</g>`

// The sitting husky is alive: it breathes, sweeps its tail over the snow now
// and then, and flicks an ear.
css.push(
  kf('hBreathe', [[0, 'transform:scale(1,1)'], [50, 'transform:scale(1.006,1.018)'], [100, 'transform:scale(1,1)']]),
  kf('hTail', [[0, 'transform:rotate(0deg)'], [62, 'transform:rotate(0deg)'], [68, 'transform:rotate(9deg)'], [76, 'transform:rotate(-5deg)'], [84, 'transform:rotate(7deg)'], [92, 'transform:rotate(-2deg)'], [100, 'transform:rotate(0deg)']]),
  kf('hEar', [[0, 'transform:rotate(0deg)'], [90, 'transform:rotate(0deg)'], [92.5, 'transform:rotate(-16deg)'], [95, 'transform:rotate(3deg)'], [97, 'transform:rotate(-9deg)'], [100, 'transform:rotate(0deg)']]),
)
anims.push('.hBreathe{animation:hBreathe 4.2s ease-in-out infinite}.hTail{animation:hTail 17s ease-in-out infinite}.hEar{animation:hEar 11s ease-in-out infinite}')

// ---------- the husky's zoomies ----------
// Now and then the husky bolts: to the far left and back, to the far right and
// back, or a quick zigzag. A galloping sprite (four frames) follows the ground
// while the sitting husky is hidden. The runner is display:none between runs,
// so its frames cost nothing, and a surface that can't animate display simply
// keeps the husky sitting.
// QUICK=1 packs the same three runs into 30 seconds, starting 3 seconds in,
// to check at a glance that a surface plays them.
const QUICK = process.env.QUICK === '1'
const RUN = QUICK ? 30 : 150 // s, one cycle of zoomies
const [s1, s2, s3] = QUICK ? [3, 13, 22] : [22, 79, 121]
const runs = [
  { start: s1, legs: [[-110, 3.0], ['wait', 1.4], [hx, 3.0]] },
  { start: s2, legs: [[1720, 1.5], ['wait', 2.2], [hx, 1.5]] },
  { start: s3, legs: [[900, 0.6], [1190, 0.75], [960, 0.6], [hx, 0.45]] },
]
const kf3 = (name, frames) => `@keyframes ${name}{${frames.map(([p, c]) => `${p.toFixed(3).replace(/\.?0+$/, '')}%{${c}}`).join('')}}`
const pct = t => (t / RUN) * 100
const at = (x, dir) => `transform:translate(${Math.round(x - hx)}px,${n(groundY(x) - groundY(hx))}px) scaleX(${dir})`
const pathFrames = [[0, at(hx, 1)]]
const runWindows = []
for (const run of runs) {
  let t = run.start
  let x = hx
  let dir = 1
  pathFrames.push([pct(t), at(x, dir)])
  for (const [to, dur] of run.legs) {
    if (to === 'wait') {
      t += dur
      pathFrames.push([pct(t), at(x, dir)])
      continue
    }
    const nextDir = to < x ? 1 : -1
    if (nextDir !== dir) {
      pathFrames.push([pct(t) + 0.003, at(x, nextDir)])
      dir = nextDir
    }
    const steps = Math.max(1, Math.round(Math.abs(to - x) / 80))
    for (let k = 1; k <= steps; k++) pathFrames.push([pct(t + (dur * k) / steps), at(x + ((to - x) * k) / steps, dir)])
    t += dur
    x = to
  }
  pathFrames.push([pct(t) + 0.003, at(hx, 1)])
  runWindows.push([pct(run.start), pct(t) + 0.003])
}
pathFrames.push([100, at(hx, 1)])
// Which husky shows is an opacity switch, which every surface draws. On top of
// that the runner is display:none between runs where a surface can animate
// display, so its galloping frames stop costing anything while it is away.
const switchAt = (name, prop, inside, outside) => {
  const f = [[0, outside]]
  for (const [a, b] of runWindows) f.push([a, outside], [a + 0.002, inside], [b, inside], [b + 0.002, outside])
  f.push([100, outside])
  return kf3(name, f.map(([p, v]) => [p, `${prop}:${v}`]))
}
css.push(kf3('runPath', pathFrames), switchAt('runGate', 'opacity', 1, 0), switchAt('sitGate', 'opacity', 0, 1), switchAt('runLive', 'display', 'inline', 'none'))
anims.push(`.hRunPath{animation:runPath ${RUN}s linear infinite}.hRunGate{opacity:0;animation:runGate ${RUN}s steps(1,end) infinite}.hRunLive{animation:runLive ${RUN}s linear infinite}.hSit{animation:sitGate ${RUN}s steps(1,end) infinite}`)

// The gallop: extended, front landing, gathered, hind push.
const shoulder = [-18, -16]
const hip = [18, -16]
const gait = [
  { front: [[-28, -10], [-37, -7]], hind: [[27, -11], [36, -9]] },
  { front: [[-22, -8], [-23, 0]], hind: [[23, -9], [27, -3]] },
  { front: [[-12, -8], [-6, -2]], hind: [[10, -9], [2, -2]] },
  { front: [[-26, -14], [-32, -12]], hind: [[22, -7], [25, 0]] },
]
const leg = (from, [knee, foot], dx) => `M${from[0] + dx} ${from[1]}L${knee[0] + dx} ${knee[1]}L${foot[0] + dx} ${foot[1]}`
const legsOf = (k, near) => {
  const g = gait[near ? k : (k + 1) % 4]
  const dx = near ? 0 : 3
  return leg(shoulder, g.front, dx) + leg(hip, g.hind, dx)
}
let farLegs = ''
let nearLegs = ''
for (let k = 0; k < 4; k++) {
  farLegs += `<path class="rf${k}" d="${legsOf(k, false)}"/>`
  nearLegs += `<path class="rf${k}" d="${legsOf(k, true)}"/>`
  const on = [k * 25, (k + 1) * 25]
  css.push(kf(`rf${k}`, [[0, `opacity:${k === 0 ? 1 : 0}`], [on[0], 'opacity:1'], [on[1], 'opacity:0'], [100, 'opacity:0']].filter(([p], i, a) => i === 0 || p > 0)))
  anims.push(`.rf${k}{animation:rf${k} .36s steps(1,end) infinite}`)
}
css.push(kf('rbob', [[0, 'transform:translateY(-3px)'], [25, 'transform:translateY(0px)'], [50, 'transform:translateY(-1px)'], [75, 'transform:translateY(0px)'], [100, 'transform:translateY(-3px)']]))
anims.push('.rbob{animation:rbob .36s steps(1,end) infinite}')
css.push(kf('puff', [[0, 'opacity:0'], [75, 'opacity:0'], [76, 'opacity:.6'], [100, 'opacity:0']]))
anims.push('.puff{animation:puff .36s linear infinite}')
const runner = `<g transform="translate(${hx} ${hy})"><g class="hRunPath"><g class="hRunGate"><g class="hRunLive"><g transform="scale(.68)">
<ellipse cx="-2" cy="1" rx="30" ry="3.5" fill="#04060b" opacity=".5"/>
<g class="puff" fill="#a9bdd8"><circle cx="31" cy="-3" r="3.2"/><circle cx="37" cy="-6" r="2.3"/><circle cx="34" cy="-9" r="1.6"/></g>
<g class="rbob">
<g stroke="#7f8a9c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none">${farLegs}</g>
<path d="M26 -25C32 -30 34 -38 28 -40C24 -41 22 -36 25 -34C28 -33 28 -29 24 -27Z" fill="#454d5d"/><path d="M28 -40C24 -41 22 -36 25 -34C25 -37 26 -39 28 -40Z" fill="#c4cedc"/>
<path d="M-24 -24C-14 -29 6 -29 18 -26C24 -25 28 -22 28 -17C27 -12 22 -10 16 -11C6 -10 -8 -10 -16 -12C-22 -13 -27 -16 -27 -20Z" fill="#3e4655"/>
<path d="M16 -11C6 -10 -8 -10 -16 -12C-22 -13 -27 -16 -27 -20L-24 -17C-18 -14 -6 -13 6 -14C12 -14 15 -13 16 -11Z" fill="#c4cedc"/>
<path d="M-22 -24C-24 -32 -28 -36 -34 -36L-44 -31C-46 -30 -45 -27 -43 -27L-34 -25C-30 -23 -26 -22 -22 -24Z" fill="#3e4655"/>
<path d="M-44 -29L-34 -26C-31 -25 -28 -25 -26 -27C-29 -28 -31 -30 -33 -31Z" fill="#c4cedc"/>
<path d="M-31 -35L-29 -44L-25 -35ZM-27 -35L-23 -43L-21 -34Z" fill="#363d4b"/>
<circle cx="-33" cy="-32" r="1.2" fill="#0a0d12"/><circle cx="-45" cy="-30" r="1.5" fill="#0a0d12"/>
<path d="M-44 -31L-34 -36C-28 -36 -24 -32 -22 -26M-24 -24C-14 -29 6 -29 18 -26C24 -25 28 -22 28 -17" stroke="#6fe0b8" stroke-width="1" fill="none" opacity=".5"/>
<g stroke="#c4cedc" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" fill="none">${nearLegs}</g>
</g></g></g></g></g></g>`

// ---------- foreground snow ----------
const groundPts = []
for (let x = -20; x <= W + 20; x += 8) groundPts.push([x, groundY(x)])
for (let i = 0; i < 90; i++) {
  const x = R(0, W)
  dot(x, groundY(x) + R(6, 100), pick([1, 1.6, 2.2]), '#cfe3ff', pick([0.15, 0.3, 0.45]))
}
const sparkles = flushDots()
let mounds = ''
for (let i = 0; i < 9; i++) {
  const x = R(60, W - 60)
  mounds += `<ellipse cx="${Math.round(x)}" cy="${Math.round(groundY(x) + R(22, 80))}" rx="${Math.round(R(60, 160))}" ry="${Math.round(R(5, 10))}"/>`
}

// ---------- test badge (DIAG=1) ----------
// 1 turns from red to green when the CSS applies, 2 blinks with a CSS
// animation, 3 blinks with a SMIL animation.
if (DIAG) {
  css.push(kf('dblink', [[0, 'opacity:1'], [50, 'opacity:.1'], [100, 'opacity:1']]))
  anims.push('.dA{fill:#30a46c}.dB{animation:dblink 1.2s linear infinite}')
}

// ---------- assemble ----------
// STILL=1 (with DIAG=1) keeps the whole drawing but drops every animation and
// rule except the test badge's: it tells apart a scene too heavy to animate
// from a rule that stops the animations.
// OFF=<regex> drops the animations whose class name matches, to find the one
// a surface chokes on (OFF='^(a[123]|glow|hue)' turns the aurora's off).
if (process.env.OFF) {
  const off = new RegExp(process.env.OFF)
  const keep = list => list.filter(rule => !off.test((rule.match(/^(?:\.|@keyframes )([\w-]+)/) ?? [])[1] ?? ''))
  anims.splice(0, anims.length, ...keep(anims))
  css.splice(0, css.length, ...keep(css))
}
const STILL = process.env.STILL === '1'
if (STILL) {
  anims.length = 0
  css.length = 0
  anims.push('.hRunGate{opacity:0}.dA{fill:#30a46c}.dB{animation:dblink 1.2s linear infinite}')
  css.push(kf('dblink', [[0, 'opacity:1'], [50, 'opacity:.1'], [100, 'opacity:1']]))
}
// Only class rules and keyframes go in the stylesheet. The desktop app froze
// every animation of the scene (CSS and SMIL alike) while the stylesheet also
// held the general rules this scene used to have: `*{transform-box:view-box}`,
// two aspect-ratio media queries and a prefers-reduced-motion query. Which of
// them does it was not narrowed down; without all three the scene animates.
const style = `.hRunGate{opacity:0}${anims.join('')}${css.join('')}@WIND@`
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#04060c"/><stop offset=".4" stop-color="#080d1a"/><stop offset=".7" stop-color="#0f1626"/><stop offset="1" stop-color="#172033"/></linearGradient>
  <radialGradient id="horizon"><stop offset="0" stop-color="#2b3a56" stop-opacity=".55"/><stop offset="1" stop-color="#2b3a56" stop-opacity="0"/></radialGradient>
  <radialGradient id="milky"><stop offset="0" stop-color="#9fb2d6" stop-opacity=".09"/><stop offset=".6" stop-color="#9fb2d6" stop-opacity=".04"/><stop offset="1" stop-color="#9fb2d6" stop-opacity="0"/></radialGradient>
  <radialGradient id="milkyCore"><stop offset="0" stop-color="#d9d2ff" stop-opacity=".07"/><stop offset="1" stop-color="#d9d2ff" stop-opacity="0"/></radialGradient>
  <radialGradient id="starGlow"><stop offset="0" stop-color="#eef3ff" stop-opacity=".7"/><stop offset="1" stop-color="#eef3ff" stop-opacity="0"/></radialGradient>
  <linearGradient id="ag1" x1="0" y1="0" x2="0" y2="1"><stop class="hue1" offset="0" stop-color="#7a5cff" stop-opacity="0"/><stop class="hue1" offset=".32" stop-color="#7a5cff" stop-opacity=".16"/><stop offset=".58" stop-color="#3fd0c4" stop-opacity=".42"/><stop offset=".78" stop-color="#4cf0a2" stop-opacity=".8"/><stop offset=".88" stop-color="#9df7cd" stop-opacity=".7"/><stop offset="1" stop-color="#9df7cd" stop-opacity="0"/></linearGradient>
  <linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1"><stop class="hue2" offset="0" stop-color="#c07bff" stop-opacity="0"/><stop class="hue2" offset=".38" stop-color="#c07bff" stop-opacity=".3"/><stop offset=".68" stop-color="#6ab8e8" stop-opacity=".38"/><stop offset=".84" stop-color="#6cf0b8" stop-opacity=".62"/><stop offset="1" stop-color="#6cf0b8" stop-opacity="0"/></linearGradient>
  <linearGradient id="ag3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4de8a0" stop-opacity="0"/><stop offset=".5" stop-color="#4de8a0" stop-opacity=".42"/><stop offset=".8" stop-color="#9df7cd" stop-opacity=".8"/><stop offset="1" stop-color="#9df7cd" stop-opacity="0"/></linearGradient>
  <filter id="aur" x="-5%" y="-60%" width="110%" height="220%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="5 12" result="fine"/><feGaussianBlur in="SourceGraphic" stdDeviation="26" result="wide"/><feMerge><feMergeNode in="wide"/><feMergeNode in="fine"/></feMerge></filter>
  <radialGradient id="glowGreen"><stop offset="0" stop-color="#2fd39a" stop-opacity=".2"/><stop offset="1" stop-color="#2fd39a" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowViolet"><stop offset="0" stop-color="#7d63ff" stop-opacity=".12"/><stop offset="1" stop-color="#7d63ff" stop-opacity="0"/></radialGradient>
  <linearGradient id="farFill" gradientUnits="userSpaceOnUse" x1="0" y1="470" x2="0" y2="780"><stop offset="0" stop-color="#2a3d54"/><stop offset=".25" stop-color="#1c2b40"/><stop offset=".6" stop-color="#152236"/><stop offset="1" stop-color="#111a29"/></linearGradient>
  <linearGradient id="farLit" gradientUnits="userSpaceOnUse" x1="0" y1="470" x2="0" y2="780"><stop offset="0" stop-color="#8aa2c0"/><stop offset=".2" stop-color="#5b7495"/><stop offset=".42" stop-color="#344a66"/><stop offset=".7" stop-color="#1f2e44"/><stop offset="1" stop-color="#16212f" stop-opacity="0"/></linearGradient>
  <linearGradient id="midFill" gradientUnits="userSpaceOnUse" x1="0" y1="680" x2="0" y2="880"><stop offset="0" stop-color="#18253b"/><stop offset=".4" stop-color="#0f182a"/><stop offset="1" stop-color="#0b111d"/></linearGradient>
  <linearGradient id="midLit" gradientUnits="userSpaceOnUse" x1="0" y1="680" x2="0" y2="860"><stop offset="0" stop-color="#4a6282"/><stop offset=".35" stop-color="#2a3b55"/><stop offset=".8" stop-color="#16223a" stop-opacity=".6"/><stop offset="1" stop-color="#16223a" stop-opacity="0"/></linearGradient>
  <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2a40" stop-opacity="0"/><stop offset=".55" stop-color="#22314a" stop-opacity=".55"/><stop offset="1" stop-color="#1d2a40" stop-opacity="0"/></linearGradient>
  <linearGradient id="snow" gradientUnits="userSpaceOnUse" x1="0" y1="870" x2="0" y2="1000"><stop offset="0" stop-color="#2c3d59"/><stop offset=".35" stop-color="#1c283d"/><stop offset="1" stop-color="#101827"/></linearGradient>
  <linearGradient id="roofSnow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c3d4ea"/><stop offset="1" stop-color="#7d93b2"/></linearGradient>
  <linearGradient id="drift" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d7393"/><stop offset="1" stop-color="#2a3a55"/></linearGradient>
  <radialGradient id="warmGlow"><stop offset="0" stop-color="#ffb764" stop-opacity=".42"/><stop offset=".5" stop-color="#ff9d4a" stop-opacity=".12"/><stop offset="1" stop-color="#ff9d4a" stop-opacity="0"/></radialGradient>
  <radialGradient id="warmSpill"><stop offset="0" stop-color="#ffb764" stop-opacity=".24"/><stop offset="1" stop-color="#ffb764" stop-opacity="0"/></radialGradient>
  <radialGradient id="lampGlow"><stop offset="0" stop-color="#ffd28a" stop-opacity=".6"/><stop offset="1" stop-color="#ffd28a" stop-opacity="0"/></radialGradient>
  <linearGradient id="windowLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe2a8"/><stop offset="1" stop-color="#ff9a45"/></linearGradient>
  <radialGradient id="smoke"><stop offset="0" stop-color="#a9b8d0" stop-opacity=".55"/><stop offset=".55" stop-color="#93a5c2" stop-opacity=".22"/><stop offset="1" stop-color="#8fa3c0" stop-opacity="0"/></radialGradient>
  <radialGradient id="vignette" cx=".5" cy=".46" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
  <pattern id="grain" width="160" height="160" patternUnits="userSpaceOnUse">${['#fff', '#000'].map(c => `<path d="${Array.from({ length: 130 }, () => `M${Math.floor(R(0, 160))} ${Math.floor(R(0, 160))}h1`).join('')}" stroke="${c}" stroke-width="1"/>`).join('')}</pattern>
</defs>
<style>${style.replace(/\s*\n\s*/g, '')}</style>
${sky}
<g class="heavens">${starsLayer}${auroraGlow}${aurora}</g>
<g class="land">
  ${farLayer}
  <rect y="650" width="${W}" height="150" fill="url(#mist)"/>
  ${midLayer}
  ${midForest}
  <rect y="800" width="${W}" height="110" fill="url(#mist)" opacity=".6"/>
  ${backPines}
  <path d="${poly([...groundPts, [W + 20, H + 40], [-20, H + 40]])}" fill="url(#snow)"/>
  <path d="${poly(groundPts, false)}" fill="none" stroke="#4d6585" stroke-width="1.5" opacity=".45"/>
  <g fill="#3a4e6c" opacity=".25">${mounds}</g>
  ${sparkles}
  <g class="homestead">${cabin}${smoke}<g class="hSit">${husky}</g>${runner}</g>
  ${frontPines}
</g>
<rect width="${W}" height="${H}" fill="url(#vignette)"/>
<rect width="${W}" height="${H}" fill="url(#grain)" opacity=".05"/>
${DIAG ? diagBadge : ''}
</svg>`
  .replace(/>\s+</g, '><')
  .replace(/\s{2,}/g, ' ')

if (svg.includes('`') || svg.includes('${')) throw new Error('the scene cannot contain ` or ${')
// Eleven wind levels, -5 to 5. Each also gives the aurora its own length.
const AURORA_LENGTH = [1.25, 0.85, 1.1, 0.92, 1.18, 1, 0.82, 1.15, 0.95, 1.3, 0.88]
const WINDS = AURORA_LENGTH.map((len, i) => {
  const w = (i - 5) / 5
  return windLoops.map(({ cls, samples, fn }) => kf(cls, Array.from({ length: samples + 1 }, (_, k) => [(k / samples) * 100, fn(k / samples, w, len)]))).join('')
})
const [HEAD, TAIL] = svg.split('@WIND@')
const longest = Math.max(...WINDS.map(css => HEAD.length + css.length + TAIL.length))
const svgOut = process.argv[2]
if (svgOut) writeFileSync(svgOut, HEAD + WINDS[Number(process.env.WIND ?? 2) + 5] + TAIL)
if (longest > 131072) throw new Error(`the scene is ${longest} characters; the limit is 131072`)
// The scene's name carries a hash of its markup, so a surface that keeps the
// drawing of a name it has seen still redraws when the scene changes.
const SCENE_ID = `nordic-night-${createHash('sha1').update(svg + WINDS.join('')).digest('hex').slice(0, 10)}`
writeFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'scene.js'),
  `// Generated by scene/build-scene.mjs: edit that file and run it again.\nexport const SCENE_ID = ${JSON.stringify(SCENE_ID)}\nexport const SCENE_HEAD = ${JSON.stringify(HEAD)}\nexport const SCENE_TAIL = ${JSON.stringify(TAIL)}\nexport const WINDS = ${JSON.stringify(WINDS)}\n`,
)
console.log(`scene ${SCENE_ID}: up to ${longest} characters (limit 131072), wind css ${WINDS[0].length}`)
