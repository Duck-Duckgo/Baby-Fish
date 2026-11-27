export type Zone = 'surface' | 'upper' | 'middle' | 'lower' | 'floor' | 'any'
export type SwimStyle = 'cruise' | 'glide' | 'hover' | 'dart' | 'eel' | 'bottom'

/** Animation inputs for one frame. Drawing happens in unit space: the fish faces +x and is about 1 unit long. */
export interface FishPose {
  wag: number
  phase: number
  time: number
  speed: number
  puff: number
  /** One screen pixel expressed in unit space, for line widths. */
  px: number
}

export interface Species {
  id: string
  name: string
  fact: string
  /** Body length range in px at the default scale. */
  size: [number, number]
  /** Cruising speed range in px/s at the default scale. */
  speed: [number, number]
  zone: Zone
  style: SwimStyle
  /** Tail beats (or fin strokes) per second at cruising speed. */
  tailHz: number
  /** Mouth position in unit space, used to line the mouth up with food. */
  mouth: [number, number]
  /** Half of the drawn height in units, used to keep the fish inside the tank. */
  halfHeight: number
  /** Distance from the center to the belly in units, for fish that sit on the sand. */
  floor?: number
  /** Only chase food within this many px (at the default scale). */
  chase?: number
  /** Drawn without pitching toward the swimming direction. */
  upright?: boolean
  /** Vertical bobbing amplitude while swimming, in units. */
  bob?: number
  puffs?: boolean
  draw: (ctx: CanvasRenderingContext2D, pose: FishPose) => void
}

type Ctx = CanvasRenderingContext2D
type Fill = string | CanvasGradient
type Stops = [number, string][]
interface Point {
  x: number
  y: number
}
interface Body {
  nose: number
  tail: number
  top: number
  bottom: number
  ped: number
  peak?: number
  snout?: number
  round?: number
}
type TailKind = 'round' | 'forked' | 'lunate' | 'shark'

const TAU = Math.PI * 2

// Gradients are defined in unit space, so one per species can be reused for every fish at any size or position.
const gradients = new Map<string, CanvasGradient>()

function vertical(ctx: Ctx, key: string, top: number, bottom: number, stops: Stops) {
  let gradient = gradients.get(key)
  if (!gradient) {
    gradient = ctx.createLinearGradient(0, top, 0, bottom)
    for (const [offset, color] of stops) gradient.addColorStop(offset, color)
    gradients.set(key, gradient)
  }
  return gradient
}

function radial(ctx: Ctx, key: string, x: number, y: number, r: number, stops: Stops) {
  let gradient = gradients.get(key)
  if (!gradient) {
    gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
    for (const [offset, color] of stops) gradient.addColorStop(offset, color)
    gradients.set(key, gradient)
  }
  return gradient
}

function paint(ctx: Ctx, fill: Fill, stroke?: string, width = 0) {
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = width
    ctx.stroke()
  }
}

function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, rotation = 0) {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU)
}

function circle(ctx: Ctx, x: number, y: number, r: number) {
  oval(ctx, x, y, r, r)
}

function poly(ctx: Ctx, points: number[]) {
  ctx.beginPath()
  ctx.moveTo(points[0], points[1])
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1])
  ctx.closePath()
}

function clipped(ctx: Ctx, path: () => void, draw: () => void) {
  ctx.save()
  path()
  ctx.clip()
  draw()
  ctx.restore()
}

function eye(ctx: Ctx, x: number, y: number, r: number, iris = '#10243a') {
  circle(ctx, x, y, r)
  paint(ctx, '#ffffff')
  circle(ctx, x + r * 0.18, y, r * 0.58)
  paint(ctx, iris)
  circle(ctx, x + r * 0.32, y - r * 0.3, r * 0.2)
  paint(ctx, '#ffffff')
}

function dot(ctx: Ctx, x: number, y: number, r: number, color: string) {
  circle(ctx, x, y, r)
  paint(ctx, color)
  circle(ctx, x + r * 0.3, y - r * 0.3, r * 0.32)
  paint(ctx, 'rgba(255, 255, 255, 0.8)')
}

/** A smooth fish outline from the tail joint to the snout. */
function body(ctx: Ctx, b: Body) {
  const peak = b.peak ?? 0.04
  const snout = b.snout ?? 0
  const round = b.round ?? 0.45
  const back = peak - b.tail
  const front = b.nose - peak
  ctx.beginPath()
  ctx.moveTo(b.tail, -b.ped)
  ctx.bezierCurveTo(b.tail + back * 0.5, -b.ped, peak - back * 0.35, -b.top, peak, -b.top)
  ctx.bezierCurveTo(peak + front * 0.55, -b.top, b.nose, snout - b.top * round, b.nose, snout)
  ctx.bezierCurveTo(b.nose, snout + b.bottom * round, peak + front * 0.55, b.bottom, peak, b.bottom)
  ctx.bezierCurveTo(peak - back * 0.35, b.bottom, b.tail + back * 0.5, b.ped, b.tail, b.ped)
  ctx.closePath()
}

function tailFin(ctx: Ctx, x: number, kind: TailKind, s: number, angle: number, fill: Fill, stroke?: string, width = 0) {
  ctx.save()
  ctx.translate(x, 0)
  ctx.rotate(angle)
  ctx.beginPath()
  if (kind === 'round') {
    ctx.moveTo(0.02, -s * 0.22)
    ctx.quadraticCurveTo(-s * 0.45, -s * 0.95, -s, -s * 0.6)
    ctx.quadraticCurveTo(-s * 1.2, 0, -s, s * 0.6)
    ctx.quadraticCurveTo(-s * 0.45, s * 0.95, 0.02, s * 0.22)
  } else if (kind === 'forked') {
    ctx.moveTo(0.02, -s * 0.18)
    ctx.quadraticCurveTo(-s * 0.45, -s * 0.5, -s * 0.95, -s * 0.9)
    ctx.quadraticCurveTo(-s * 0.62, -s * 0.28, -s * 0.52, 0)
    ctx.quadraticCurveTo(-s * 0.62, s * 0.28, -s * 0.95, s * 0.9)
    ctx.quadraticCurveTo(-s * 0.45, s * 0.5, 0.02, s * 0.18)
  } else if (kind === 'lunate') {
    ctx.moveTo(0.02, -s * 0.1)
    ctx.quadraticCurveTo(-s * 0.3, -s * 0.3, -s * 0.8, -s * 1.05)
    ctx.quadraticCurveTo(-s * 0.5, -s * 0.25, -s * 0.42, 0)
    ctx.quadraticCurveTo(-s * 0.5, s * 0.25, -s * 0.8, s * 1.05)
    ctx.quadraticCurveTo(-s * 0.3, s * 0.3, 0.02, s * 0.1)
  } else {
    ctx.moveTo(0.02, -s * 0.1)
    ctx.quadraticCurveTo(-s * 0.4, -s * 0.4, -s, -s * 1.1)
    ctx.quadraticCurveTo(-s * 0.62, -s * 0.3, -s * 0.5, 0)
    ctx.quadraticCurveTo(-s * 0.58, s * 0.22, -s * 0.7, s * 0.6)
    ctx.quadraticCurveTo(-s * 0.28, s * 0.3, 0.02, s * 0.1)
  }
  ctx.closePath()
  paint(ctx, fill, stroke, width)
  ctx.restore()
}

/** A closed outline around a center line, `widths` being the half-width at each point. */
function ribbon(ctx: Ctx, points: Point[], widths: number[]) {
  const left: Point[] = []
  const right: Point[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)]
    const b = points[Math.min(points.length - 1, i + 1)]
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = -(b.y - a.y) / length
    const ny = (b.x - a.x) / length
    left.push({ x: points[i].x + nx * widths[i], y: points[i].y + ny * widths[i] })
    right.push({ x: points[i].x - nx * widths[i], y: points[i].y - ny * widths[i] })
  }
  ctx.beginPath()
  ctx.moveTo(left[0].x, left[0].y)
  for (const p of left) ctx.lineTo(p.x, p.y)
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y)
  ctx.closePath()
}

const clownBody: Body = { nose: 0.44, tail: -0.27, top: 0.23, bottom: 0.21, ped: 0.08, peak: -0.02, round: 0.5 }
const tangBody: Body = { nose: 0.43, tail: -0.3, top: 0.26, bottom: 0.24, ped: 0.06, peak: 0, snout: -0.01, round: 0.32 }
const angelBody: Body = { nose: 0.32, tail: -0.17, top: 0.27, bottom: 0.27, ped: 0.05, peak: 0.06, round: 0.25 }
const butterflyBody: Body = { nose: 0.4, tail: -0.26, top: 0.27, bottom: 0.25, ped: 0.06, peak: -0.02, snout: -0.02, round: 0.18 }
const triggerBody: Body = { nose: 0.43, tail: -0.26, top: 0.25, bottom: 0.24, ped: 0.07, peak: 0, snout: 0.03, round: 0.2 }
const goldBody: Body = { nose: 0.34, tail: -0.08, top: 0.24, bottom: 0.25, ped: 0.08, peak: 0.08, round: 0.55 }
const bettaBody: Body = { nose: 0.42, tail: -0.06, top: 0.1, bottom: 0.1, ped: 0.07, peak: 0.16, round: 0.4 }
const lionBody: Body = { nose: 0.43, tail: -0.3, top: 0.16, bottom: 0.15, ped: 0.06, peak: 0.06, round: 0.35 }
const wrasseBody: Body = { nose: 0.46, tail: -0.3, top: 0.24, bottom: 0.22, ped: 0.08, peak: 0.06, snout: 0.05, round: 0.35 }
const sharkBody: Body = { nose: 0.5, tail: -0.33, top: 0.12, bottom: 0.11, ped: 0.035, peak: 0.06, snout: -0.015, round: 0.14 }
const hammerBody: Body = { nose: 0.42, tail: -0.33, top: 0.11, bottom: 0.1, ped: 0.035, peak: 0.04, round: 0.3 }
const sailBody: Body = { nose: 0.3, tail: -0.33, top: 0.075, bottom: 0.075, ped: 0.025, peak: 0.02, round: 0.18 }
const flyBody: Body = { nose: 0.44, tail: -0.3, top: 0.085, bottom: 0.085, ped: 0.03, peak: 0.08, round: 0.4 }
const koiBody: Body = { nose: 0.46, tail: -0.3, top: 0.135, bottom: 0.125, ped: 0.05, peak: 0.06, round: 0.5 }
const sturgeonBody: Body = { nose: 0.5, tail: -0.33, top: 0.095, bottom: 0.085, ped: 0.03, peak: 0.12, snout: -0.035, round: 0.1 }
const neonBody: Body = { nose: 0.45, tail: -0.27, top: 0.14, bottom: 0.13, ped: 0.05, peak: 0.04, round: 0.5 }
const catBody: Body = { nose: 0.48, tail: -0.32, top: 0.13, bottom: 0.1, ped: 0.05, peak: 0.2, snout: 0.02, round: 0.35 }

export const SPECIES: readonly Species[] = [
  {
    id: 'clownfish',
    name: '小丑鱼',
    fact: '住在海葵里，游起来一扭一扭',
    size: [26, 36],
    speed: [40, 55],
    zone: 'lower',
    style: 'cruise',
    tailHz: 3.4,
    mouth: [0.44, 0.03],
    halfHeight: 0.32,
    draw(ctx, p) {
      const ink = '#1d1d1f'
      const fin = '#ff8a24'
      const edge = 1.3 * p.px
      ctx.beginPath()
      ctx.moveTo(-0.24, -0.12)
      ctx.quadraticCurveTo(-0.2, -0.36, -0.04, -0.3)
      ctx.quadraticCurveTo(0.08, -0.38, 0.18, -0.18)
      ctx.closePath()
      paint(ctx, fin, ink, edge)
      ctx.beginPath()
      ctx.moveTo(-0.2, 0.12)
      ctx.quadraticCurveTo(-0.14, 0.34, 0.02, 0.18)
      ctx.closePath()
      paint(ctx, fin, ink, edge)
      tailFin(ctx, -0.26, 'round', 0.25, p.wag * 0.45, fin, ink, edge)
      body(ctx, clownBody)
      paint(ctx, vertical(ctx, 'clownfish', -0.23, 0.21, [[0, '#ff7410'], [1, '#ffab55']]))
      clipped(ctx, () => body(ctx, clownBody), () => {
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = ink
        ctx.lineWidth = edge * 1.6
        for (const [x, w] of [[0.21, 0.07], [-0.03, 0.075], [-0.24, 0.045]]) {
          oval(ctx, x, 0, w, 0.3)
          ctx.fill()
          ctx.stroke()
        }
      })
      oval(ctx, 0.06, 0.07, 0.085, 0.045, 0.6 + p.wag * 0.3)
      paint(ctx, fin, ink, edge)
      eye(ctx, 0.31, -0.05, 0.055)
    },
  },
  {
    id: 'blue-tang',
    name: '蓝倒吊',
    fact: '尾柄上藏着锋利的骨刺',
    size: [36, 50],
    speed: [45, 62],
    zone: 'middle',
    style: 'cruise',
    tailHz: 2.4,
    mouth: [0.43, 0],
    halfHeight: 0.38,
    draw(ctx, p) {
      const ink = '#0b1020'
      const blue = '#2563eb'
      const edge = 1.2 * p.px
      ctx.beginPath()
      ctx.moveTo(0.24, -0.2)
      ctx.quadraticCurveTo(0.02, -0.38, -0.3, -0.1)
      ctx.lineTo(-0.26, -0.04)
      ctx.closePath()
      paint(ctx, blue, ink, edge)
      ctx.beginPath()
      ctx.moveTo(0.16, 0.2)
      ctx.quadraticCurveTo(-0.04, 0.36, -0.3, 0.1)
      ctx.lineTo(-0.26, 0.04)
      ctx.closePath()
      paint(ctx, blue, ink, edge)
      tailFin(ctx, -0.3, 'lunate', 0.22, p.wag * 0.35, '#ffd21f', ink, edge)
      body(ctx, tangBody)
      paint(ctx, vertical(ctx, 'blue-tang', -0.26, 0.24, [[0, '#1d4ed8'], [1, '#4f8ff7']]))
      clipped(ctx, () => body(ctx, tangBody), () => {
        ctx.strokeStyle = ink
        ctx.lineWidth = 0.07
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(0.26, -0.12)
        ctx.bezierCurveTo(0.12, -0.25, -0.16, -0.22, -0.32, -0.02)
        ctx.stroke()
        oval(ctx, -0.04, 0.03, 0.15, 0.075, -0.15)
        paint(ctx, ink)
        oval(ctx, -0.03, 0.035, 0.085, 0.035, -0.15)
        paint(ctx, '#3b7cf3')
      })
      oval(ctx, 0.12, 0.08, 0.09, 0.04, 0.5 + p.wag * 0.3)
      paint(ctx, '#ffd21f')
      eye(ctx, 0.3, -0.06, 0.05)
    },
  },
  {
    id: 'angelfish',
    name: '神仙鱼',
    fact: '拖着长长的背鳍和臀鳍',
    size: [42, 56],
    speed: [26, 36],
    zone: 'middle',
    style: 'glide',
    tailHz: 1.4,
    mouth: [0.32, 0],
    halfHeight: 0.85,
    draw(ctx, p) {
      const sway = Math.sin(p.phase * 0.5) * 0.05
      const finFill = 'rgba(226, 232, 240, 0.78)'
      const dorsal = () => {
        ctx.beginPath()
        ctx.moveTo(0.16, -0.22)
        ctx.quadraticCurveTo(-0.02, -0.6, -0.36 + sway, -0.82)
        ctx.quadraticCurveTo(-0.2, -0.42, -0.16, -0.1)
        ctx.closePath()
      }
      const anal = () => {
        ctx.beginPath()
        ctx.moveTo(0.12, 0.22)
        ctx.quadraticCurveTo(-0.02, 0.6, -0.36 - sway, 0.82)
        ctx.quadraticCurveTo(-0.2, 0.42, -0.16, 0.1)
        ctx.closePath()
      }
      for (const fin of [dorsal, anal]) {
        fin()
        paint(ctx, finFill)
        clipped(ctx, fin, () => {
          ctx.fillStyle = 'rgba(17, 24, 39, 0.55)'
          ctx.fillRect(-0.045, -1, 0.09, 2)
        })
      }
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.9)'
      ctx.lineWidth = 1.2 * p.px
      ctx.beginPath()
      ctx.moveTo(0.14, 0.18)
      ctx.quadraticCurveTo(0.1, 0.5, -0.04 - sway, 0.8)
      ctx.stroke()
      tailFin(ctx, -0.17, 'round', 0.22, p.wag * 0.3, finFill)
      body(ctx, angelBody)
      paint(ctx, vertical(ctx, 'angelfish', -0.27, 0.27, [[0, '#f8fafc'], [1, '#cbd5e1']]))
      clipped(ctx, () => body(ctx, angelBody), () => {
        ctx.fillStyle = 'rgba(17, 24, 39, 0.85)'
        for (const [x, w] of [[0.2, 0.03], [0, 0.045], [-0.15, 0.03]]) ctx.fillRect(x - w, -0.4, w * 2, 0.8)
      })
      eye(ctx, 0.21, -0.07, 0.045, '#9b1c1c')
    },
  },
  {
    id: 'butterflyfish',
    name: '蝴蝶鱼',
    fact: '尾巴附近的黑点是假眼睛',
    size: [28, 38],
    speed: [32, 44],
    zone: 'middle',
    style: 'hover',
    tailHz: 2.6,
    mouth: [0.5, -0.01],
    halfHeight: 0.38,
    bob: 0.015,
    draw(ctx, p) {
      const ink = '#111827'
      const edge = 1.1 * p.px
      ctx.beginPath()
      ctx.moveTo(0.18, -0.22)
      ctx.quadraticCurveTo(-0.08, -0.42, -0.3, -0.12)
      ctx.lineTo(-0.25, -0.04)
      ctx.closePath()
      paint(ctx, '#ffd60a', ink, edge)
      ctx.beginPath()
      ctx.moveTo(0.1, 0.22)
      ctx.quadraticCurveTo(-0.1, 0.38, -0.3, 0.12)
      ctx.lineTo(-0.25, 0.04)
      ctx.closePath()
      paint(ctx, '#ffd60a', ink, edge)
      tailFin(ctx, -0.26, 'round', 0.2, p.wag * 0.4, 'rgba(255, 236, 153, 0.85)')
      poly(ctx, [0.34, -0.05, 0.5, -0.025, 0.5, 0.005, 0.34, 0.03])
      paint(ctx, '#f5f5f4')
      body(ctx, butterflyBody)
      paint(ctx, vertical(ctx, 'butterflyfish', -0.27, 0.25, [[0, '#ffe14d'], [1, '#ffc300']]))
      clipped(ctx, () => body(ctx, butterflyBody), () => {
        ctx.fillStyle = '#fafaf9'
        ctx.fillRect(0.21, -0.4, 0.3, 0.8)
        ctx.fillStyle = ink
        ctx.fillRect(0.235, -0.4, 0.06, 0.8)
      })
      circle(ctx, -0.14, -0.12, 0.06)
      paint(ctx, ink, '#ffffff', 2 * p.px)
      oval(ctx, 0.08, 0.08, 0.08, 0.035, 0.5 + p.wag * 0.3)
      paint(ctx, 'rgba(255, 255, 255, 0.8)')
      dot(ctx, 0.265, -0.06, 0.03, '#000000')
    },
  },
  {
    id: 'triggerfish',
    name: '毕加索炮弹鱼',
    fact: '身上的花纹像一幅抽象画',
    size: [32, 44],
    speed: [30, 42],
    zone: 'lower',
    style: 'cruise',
    tailHz: 1.6,
    mouth: [0.44, 0.03],
    halfHeight: 0.38,
    draw(ctx, p) {
      const ripple = Math.sin(p.phase * 1.3) * 0.03
      const finFill = 'rgba(214, 196, 160, 0.9)'
      ctx.beginPath()
      ctx.moveTo(0.02, -0.22)
      ctx.quadraticCurveTo(-0.1, -0.38 + ripple, -0.25, -0.16 - ripple)
      ctx.lineTo(-0.24, -0.07)
      ctx.closePath()
      paint(ctx, finFill)
      ctx.beginPath()
      ctx.moveTo(0.02, 0.22)
      ctx.quadraticCurveTo(-0.1, 0.38 - ripple, -0.25, 0.16 + ripple)
      ctx.lineTo(-0.24, 0.07)
      ctx.closePath()
      paint(ctx, finFill)
      tailFin(ctx, -0.26, 'round', 0.18, p.wag * 0.15, '#cdb991')
      body(ctx, triggerBody)
      paint(ctx, vertical(ctx, 'triggerfish', -0.25, 0.24, [[0, '#d6c39a'], [0.55, '#efe6d2'], [1, '#ffffff']]))
      clipped(ctx, () => body(ctx, triggerBody), () => {
        poly(ctx, [0.2, 0, 0.09, 0.3, -0.02, 0.3, 0.1, -0.02])
        paint(ctx, '#1f2937')
        poly(ctx, [-0.06, -0.06, -0.3, -0.14, -0.3, 0.13, -0.08, 0.15])
        paint(ctx, '#433d35')
        ctx.lineCap = 'round'
        ctx.strokeStyle = '#f5f0e6'
        ctx.lineWidth = 0.018
        ctx.beginPath()
        for (const x of [-0.1, -0.16, -0.22]) {
          ctx.moveTo(x, 0.13)
          ctx.lineTo(x - 0.06, -0.08)
        }
        ctx.stroke()
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 0.016
        ctx.beginPath()
        ctx.moveTo(0.14, -0.13)
        ctx.lineTo(0.38, -0.06)
        ctx.moveTo(0.16, -0.06)
        ctx.lineTo(0.42, -0.01)
        ctx.moveTo(0.14, 0)
        ctx.lineTo(0.4, 0.05)
        ctx.stroke()
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 0.02
        ctx.beginPath()
        ctx.moveTo(0.42, 0.06)
        ctx.lineTo(0.12, 0.1)
        ctx.stroke()
      })
      oval(ctx, 0.43, 0.03, 0.03, 0.022)
      paint(ctx, '#f59e0b')
      eye(ctx, 0.12, -0.1, 0.045, '#1d4ed8')
    },
  },
  {
    id: 'goldfish',
    name: '金鱼',
    fact: '双尾像一条飘逸的裙摆',
    size: [34, 46],
    speed: [20, 30],
    zone: 'upper',
    style: 'glide',
    tailHz: 1.5,
    mouth: [0.34, 0.02],
    halfHeight: 0.45,
    draw(ctx, p) {
      const lagNear = Math.sin(p.phase - 0.6) * 0.06
      const lagFar = Math.sin(p.phase - 1.3) * 0.1
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(-0.05, 0)
        ctx.quadraticCurveTo(-0.25, side * 0.36 + lagNear, -0.64, side * 0.34 + lagFar)
        ctx.quadraticCurveTo(-0.5, side * 0.16 + lagFar * 0.6, -0.58, side * 0.04 + lagFar * 0.4)
        ctx.quadraticCurveTo(-0.3, side * 0.06 + lagNear * 0.5, -0.05, 0)
        ctx.closePath()
        paint(ctx, 'rgba(255, 112, 40, 0.72)')
      }
      ctx.beginPath()
      ctx.moveTo(0.18, -0.22)
      ctx.quadraticCurveTo(0.05, -0.5, -0.14 + lagNear, -0.44)
      ctx.quadraticCurveTo(-0.06, -0.28, -0.04, -0.2)
      ctx.closePath()
      paint(ctx, 'rgba(255, 112, 40, 0.8)')
      body(ctx, goldBody)
      paint(ctx, vertical(ctx, 'goldfish', -0.24, 0.25, [[0, '#ff6a14'], [0.6, '#ff9a3c'], [1, '#ffe1b8']]))
      oval(ctx, 0.12, 0.13, 0.07, 0.035, 0.7 + p.wag * 0.3)
      paint(ctx, 'rgba(255, 140, 60, 0.75)')
      eye(ctx, 0.21, -0.05, 0.06)
    },
  },
  {
    id: 'betta',
    name: '斗鱼',
    fact: '大尾巴展开像一把扇子',
    size: [32, 42],
    speed: [16, 26],
    zone: 'upper',
    style: 'hover',
    tailHz: 1.2,
    mouth: [0.42, 0],
    halfHeight: 0.45,
    bob: 0.02,
    draw(ctx, p) {
      const fins = radial(ctx, 'betta-fins', -0.04, 0, 0.62, [[0, '#e11d48'], [0.55, '#be123c'], [1, '#4c1d95']])
      const wave = Math.sin(p.phase * 0.9) * 0.04
      ctx.beginPath()
      ctx.moveTo(-0.02, -0.07)
      const steps = 10
      for (let i = 0; i <= steps; i++) {
        const a = Math.PI + 1.05 - (2.1 * i) / steps
        const r = 0.55 + Math.sin(p.phase * 0.9 - i * 0.8) * 0.035
        ctx.lineTo(-0.04 + Math.cos(a) * r, Math.sin(a) * r * 0.82)
      }
      ctx.lineTo(-0.02, 0.07)
      ctx.closePath()
      paint(ctx, fins)
      ctx.beginPath()
      ctx.moveTo(0.2, -0.09)
      ctx.quadraticCurveTo(0, -0.3, -0.3, -0.38 + wave)
      ctx.quadraticCurveTo(-0.12, -0.16, -0.04, -0.07)
      ctx.closePath()
      paint(ctx, fins)
      ctx.beginPath()
      ctx.moveTo(0.24, 0.08)
      ctx.quadraticCurveTo(0, 0.34, -0.34, 0.42 - wave)
      ctx.quadraticCurveTo(-0.12, 0.18, -0.04, 0.07)
      ctx.closePath()
      paint(ctx, fins)
      body(ctx, bettaBody)
      paint(ctx, vertical(ctx, 'betta', -0.1, 0.1, [[0, '#9f1239'], [0.5, '#e11d48'], [1, '#f43f5e']]))
      clipped(ctx, () => body(ctx, bettaBody), () => {
        oval(ctx, 0.12, -0.04, 0.2, 0.05)
        paint(ctx, 'rgba(99, 102, 241, 0.35)')
      })
      eye(ctx, 0.32, -0.02, 0.035)
    },
  },
  {
    id: 'lionfish',
    name: '狮子鱼',
    fact: '鳍棘有毒，看看就好',
    size: [40, 54],
    speed: [16, 26],
    zone: 'lower',
    style: 'hover',
    tailHz: 1.1,
    mouth: [0.43, 0.02],
    halfHeight: 0.6,
    bob: 0.012,
    draw(ctx, p) {
      const fan = Math.sin(p.phase * 0.5) * 0.1
      for (let i = 0; i < 6; i++) {
        ctx.save()
        ctx.translate(0.08, 0.06)
        ctx.rotate(1.75 + i * 0.2 + fan)
        oval(ctx, 0.24, 0, 0.25, 0.028)
        paint(ctx, 'rgba(255, 237, 213, 0.6)', 'rgba(185, 28, 28, 0.65)', p.px)
        ctx.restore()
      }
      poly(ctx, [0.24, -0.13, 0.16, -0.45, -0.28, -0.3, -0.25, -0.1])
      paint(ctx, 'rgba(254, 202, 202, 0.25)')
      ctx.lineCap = 'round'
      ctx.lineWidth = 1.6 * p.px
      for (let i = 0; i < 11; i++) {
        const x = 0.22 - i * 0.042
        const h = 0.44 - Math.abs(i - 3) * 0.03
        ctx.strokeStyle = i % 2 === 0 ? '#fff1f2' : '#b91c1c'
        ctx.beginPath()
        ctx.moveTo(x, -0.12)
        ctx.lineTo(x - 0.08, -0.12 - h)
        ctx.stroke()
      }
      tailFin(ctx, -0.3, 'round', 0.2, p.wag * 0.3, 'rgba(254, 226, 226, 0.75)', '#b91c1c', p.px)
      body(ctx, lionBody)
      paint(ctx, vertical(ctx, 'lionfish', -0.16, 0.15, [[0, '#c2410c'], [1, '#fde2d0']]))
      clipped(ctx, () => body(ctx, lionBody), () => {
        ctx.fillStyle = '#7f1d1d'
        for (let x = 0.36; x > -0.32; x -= 0.075) {
          ctx.save()
          ctx.translate(x, 0)
          ctx.rotate(0.15)
          ctx.fillRect(-0.016, -0.3, 0.032, 0.6)
          ctx.restore()
        }
      })
      ctx.strokeStyle = '#fde2d0'
      ctx.lineWidth = 1.4 * p.px
      ctx.beginPath()
      ctx.moveTo(0.3, -0.1)
      ctx.lineTo(0.33, -0.2)
      ctx.stroke()
      eye(ctx, 0.3, -0.05, 0.045, '#7f1d1d')
    },
  },
  {
    id: 'sunfish',
    name: '翻车鱼',
    fact: '没有尾巴，靠背鳍和臀鳍划水',
    size: [72, 100],
    speed: [14, 22],
    zone: 'middle',
    style: 'glide',
    tailHz: 0.6,
    mouth: [0.43, 0.03],
    halfHeight: 0.75,
    draw(ctx, p) {
      const flap = Math.sin(p.phase) * 0.35
      for (const side of [-1, 1]) {
        ctx.save()
        ctx.translate(-0.12, side * 0.26)
        ctx.rotate(side * flap)
        ctx.beginPath()
        ctx.moveTo(0.09, -side * 0.02)
        ctx.quadraticCurveTo(0.05, side * 0.3, -0.07, side * 0.5)
        ctx.quadraticCurveTo(-0.13, side * 0.22, -0.11, -side * 0.02)
        ctx.closePath()
        paint(ctx, '#7b8a99')
        ctx.restore()
      }
      ctx.fillStyle = '#8796a5'
      oval(ctx, -0.3, 0, 0.09, 0.27)
      ctx.fill()
      for (let i = 0; i < 5; i++) {
        circle(ctx, -0.37, -0.2 + i * 0.1, 0.045)
        ctx.fill()
      }
      const disc = () => oval(ctx, 0.05, 0, 0.38, 0.32)
      disc()
      paint(ctx, vertical(ctx, 'sunfish', -0.32, 0.32, [[0, '#8e9caa'], [0.6, '#c3ccd5'], [1, '#e6ebef']]))
      clipped(ctx, disc, () => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
        for (const [x, y, r] of [[-0.1, -0.12, 0.06], [0.08, 0.1, 0.05], [-0.18, 0.12, 0.04], [0.16, -0.18, 0.04]]) {
          circle(ctx, x, y, r)
          ctx.fill()
        }
      })
      circle(ctx, 0.42, 0.03, 0.022)
      paint(ctx, '#5b6773')
      circle(ctx, 0.42, 0.03, 0.011)
      paint(ctx, '#2d3640')
      oval(ctx, 0.16, 0.02, 0.06, 0.03, 0.3 + p.wag * 0.2)
      paint(ctx, '#7b8a99')
      eye(ctx, 0.28, -0.08, 0.04)
    },
  },
  {
    id: 'boxfish',
    name: '箱鲀',
    fact: '全身裹着硬壳，像个小盒子',
    size: [26, 36],
    speed: [18, 26],
    zone: 'middle',
    style: 'hover',
    tailHz: 3.2,
    mouth: [0.37, 0.06],
    halfHeight: 0.3,
    bob: 0.02,
    draw(ctx, p) {
      const buzz = Math.sin(p.phase * 2.5) * 0.3
      const shell = () => {
        ctx.beginPath()
        ctx.roundRect(-0.28, -0.2, 0.62, 0.4, 0.12)
      }
      tailFin(ctx, -0.27, 'round', 0.2, p.wag * 0.25, '#facc15', '#a16207', p.px)
      for (const side of [-1, 1]) {
        ctx.save()
        ctx.translate(-0.16, side * 0.18)
        ctx.rotate(side * (0.6 - buzz))
        oval(ctx, -0.05, 0, 0.06, 0.03)
        paint(ctx, 'rgba(250, 204, 21, 0.85)')
        ctx.restore()
      }
      shell()
      paint(ctx, vertical(ctx, 'boxfish', -0.2, 0.2, [[0, '#fde047'], [1, '#f5b700']]))
      clipped(ctx, shell, () => {
        ctx.fillStyle = '#1f2937'
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 5; col++) {
            circle(ctx, -0.22 + col * 0.13 + (row % 2) * 0.065, -0.12 + row * 0.12, 0.026)
            ctx.fill()
          }
        }
      })
      oval(ctx, 0.35, 0.06, 0.03, 0.025)
      paint(ctx, '#f59e0b')
      ctx.save()
      ctx.translate(0.06, 0.05)
      ctx.rotate(1 + buzz)
      oval(ctx, -0.05, 0, 0.06, 0.025)
      paint(ctx, 'rgba(255, 255, 255, 0.65)')
      ctx.restore()
      eye(ctx, 0.2, -0.07, 0.05)
    },
  },
  {
    id: 'pufferfish',
    name: '河豚',
    fact: '一紧张就鼓成刺球',
    size: [30, 42],
    speed: [20, 30],
    zone: 'middle',
    style: 'hover',
    tailHz: 2.6,
    mouth: [0.36, 0.04],
    halfHeight: 0.42,
    bob: 0.02,
    puffs: true,
    draw(ctx, p) {
      const cx = 0.03
      const rx = 0.3 * (1 + p.puff * 0.22)
      const ry = 0.23 * (1 + p.puff * 0.6)
      const shape = () => oval(ctx, cx, 0, rx, ry)
      tailFin(ctx, cx - rx + 0.03, 'round', 0.17, p.wag * 0.45, '#c9a66b')
      oval(ctx, cx - rx * 0.45, -ry * 0.92, 0.05, 0.03, 0.5)
      paint(ctx, '#c9a66b')
      oval(ctx, cx - rx * 0.45, ry * 0.92, 0.05, 0.03, -0.5)
      paint(ctx, '#c9a66b')
      if (p.puff > 0.05) {
        ctx.strokeStyle = '#7c5c2e'
        ctx.lineWidth = 1.2 * p.px
        ctx.beginPath()
        for (let i = 0; i < 22; i++) {
          const c = Math.cos((i / 22) * TAU)
          const s = Math.sin((i / 22) * TAU)
          ctx.moveTo(cx + c * rx * 0.96, s * ry * 0.96)
          ctx.lineTo(cx + c * (rx + 0.07 * p.puff), s * (ry + 0.07 * p.puff))
        }
        ctx.stroke()
      }
      shape()
      paint(ctx, vertical(ctx, 'pufferfish', -0.37, 0.37, [[0, '#a88650'], [0.5, '#d9c08f'], [0.56, '#f6f0e2'], [1, '#fbf8f1']]))
      clipped(ctx, shape, () => {
        ctx.fillStyle = 'rgba(92, 64, 28, 0.75)'
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 5; col++) {
            circle(ctx, cx - rx * 0.6 + col * rx * 0.3 + (row % 2) * rx * 0.15, -ry * 0.62 + row * ry * 0.24, 0.022)
            ctx.fill()
          }
        }
      })
      oval(ctx, cx + rx * 0.35, ry * 0.2, 0.06, 0.035, 0.7 + p.wag * 0.4)
      paint(ctx, '#e8d5a8')
      oval(ctx, cx + rx - 0.005, 0.04, 0.028, 0.024)
      paint(ctx, '#7c5c2e')
      eye(ctx, cx + rx * 0.55, -ry * 0.35, 0.06, '#365314')
    },
  },
  {
    id: 'humphead-wrasse',
    name: '苏眉',
    fact: '额头上鼓着一个大包',
    size: [58, 78],
    speed: [24, 34],
    zone: 'middle',
    style: 'cruise',
    tailHz: 1.1,
    mouth: [0.48, 0.06],
    halfHeight: 0.38,
    draw(ctx, p) {
      const dark = '#1f7a6d'
      ctx.beginPath()
      ctx.moveTo(0.24, -0.2)
      ctx.quadraticCurveTo(-0.05, -0.34, -0.3, -0.12)
      ctx.lineTo(-0.28, -0.06)
      ctx.closePath()
      paint(ctx, dark)
      ctx.beginPath()
      ctx.moveTo(0.06, 0.2)
      ctx.quadraticCurveTo(-0.1, 0.32, -0.3, 0.12)
      ctx.lineTo(-0.28, 0.06)
      ctx.closePath()
      paint(ctx, dark)
      tailFin(ctx, -0.3, 'round', 0.24, p.wag * 0.3, dark)
      const skin = vertical(ctx, 'humphead-wrasse', -0.3, 0.22, [[0, '#23867a'], [1, '#93d6cb']])
      body(ctx, wrasseBody)
      paint(ctx, skin)
      oval(ctx, 0.27, -0.17, 0.14, 0.11, -0.3)
      paint(ctx, skin)
      clipped(ctx, () => body(ctx, wrasseBody), () => {
        ctx.strokeStyle = 'rgba(12, 74, 66, 0.35)'
        ctx.lineWidth = p.px
        ctx.beginPath()
        for (let i = 0; i < 6; i++) {
          for (let j = 0; j < 3; j++) {
            const x = 0.1 - i * 0.07
            const y = -0.12 + j * 0.09
            ctx.moveTo(x + 0.025, y)
            ctx.arc(x, y, 0.025, 0, Math.PI)
          }
        }
        ctx.stroke()
      })
      ctx.strokeStyle = 'rgba(12, 74, 66, 0.6)'
      ctx.lineWidth = 1.1 * p.px
      ctx.beginPath()
      for (let i = 0; i < 4; i++) {
        const y = -0.1 + i * 0.045
        ctx.moveTo(0.4, y)
        ctx.bezierCurveTo(0.34, y - 0.04, 0.3, y + 0.04, 0.22, y)
      }
      ctx.stroke()
      oval(ctx, 0.46, 0.06, 0.05, 0.035)
      paint(ctx, '#b7e6dc')
      eye(ctx, 0.34, -0.06, 0.035, '#0f766e')
    },
  },
  {
    id: 'shark',
    name: '鲨鱼',
    fact: '尾鳍上叶比下叶长',
    size: [84, 112],
    speed: [32, 44],
    zone: 'middle',
    style: 'cruise',
    tailHz: 0.9,
    mouth: [0.4, 0.06],
    halfHeight: 0.36,
    draw(ctx, p) {
      const grey = '#768392'
      ctx.beginPath()
      ctx.moveTo(0.1, -0.1)
      ctx.quadraticCurveTo(0, -0.18, -0.07, -0.34)
      ctx.quadraticCurveTo(-0.07, -0.18, -0.13, -0.1)
      ctx.closePath()
      paint(ctx, grey)
      poly(ctx, [-0.19, -0.06, -0.24, -0.12, -0.26, -0.05])
      paint(ctx, grey)
      poly(ctx, [-0.17, 0.06, -0.22, 0.11, -0.24, 0.05])
      paint(ctx, grey)
      tailFin(ctx, -0.33, 'shark', 0.3, p.wag * 0.35, grey)
      body(ctx, sharkBody)
      paint(ctx, vertical(ctx, 'shark', -0.12, 0.11, [[0, '#66737f'], [0.5, '#8c98a4'], [0.56, '#e5eaee'], [1, '#f3f6f8']]))
      ctx.strokeStyle = 'rgba(40, 48, 58, 0.5)'
      ctx.lineWidth = 1.1 * p.px
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const x = 0.24 - i * 0.028
        ctx.moveTo(x, -0.05)
        ctx.quadraticCurveTo(x - 0.015, 0, x, 0.05)
      }
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0.15, 0.06)
      ctx.quadraticCurveTo(0.06, 0.2, -0.04, 0.28)
      ctx.quadraticCurveTo(0.04, 0.12, 0.05, 0.07)
      ctx.closePath()
      paint(ctx, grey)
      ctx.strokeStyle = 'rgba(40, 48, 58, 0.6)'
      ctx.lineWidth = 1.2 * p.px
      ctx.beginPath()
      ctx.moveTo(0.43, 0.045)
      ctx.quadraticCurveTo(0.37, 0.075, 0.31, 0.058)
      ctx.stroke()
      dot(ctx, 0.38, -0.035, 0.02, '#111827')
    },
  },
  {
    id: 'hammerhead',
    name: '锤头鲨',
    fact: '眼睛长在锤子的两头',
    size: [88, 116],
    speed: [30, 42],
    zone: 'lower',
    style: 'cruise',
    tailHz: 0.85,
    mouth: [0.42, 0.07],
    halfHeight: 0.38,
    draw(ctx, p) {
      const skin = '#8a8778'
      ctx.beginPath()
      ctx.moveTo(0.08, -0.09)
      ctx.quadraticCurveTo(0, -0.22, -0.1, -0.38)
      ctx.quadraticCurveTo(-0.06, -0.2, -0.13, -0.09)
      ctx.closePath()
      paint(ctx, skin)
      poly(ctx, [-0.2, -0.05, -0.24, -0.1, -0.26, -0.04])
      paint(ctx, skin)
      tailFin(ctx, -0.33, 'shark', 0.3, p.wag * 0.35, skin)
      const hide = vertical(ctx, 'hammerhead', -0.2, 0.16, [[0, '#7a776a'], [0.5, '#9a978a'], [0.58, '#ecebe3'], [1, '#f6f5ef']])
      body(ctx, hammerBody)
      paint(ctx, hide)
      ctx.beginPath()
      ctx.roundRect(0.4, -0.2, 0.085, 0.36, 0.04)
      paint(ctx, hide)
      ctx.strokeStyle = 'rgba(50, 48, 40, 0.5)'
      ctx.lineWidth = 1.1 * p.px
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const x = 0.22 - i * 0.028
        ctx.moveTo(x, -0.045)
        ctx.quadraticCurveTo(x - 0.014, 0, x, 0.045)
      }
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0.14, 0.055)
      ctx.quadraticCurveTo(0.06, 0.19, -0.04, 0.26)
      ctx.quadraticCurveTo(0.04, 0.11, 0.05, 0.065)
      ctx.closePath()
      paint(ctx, skin)
      dot(ctx, 0.455, -0.175, 0.018, '#111827')
      dot(ctx, 0.455, 0.135, 0.018, '#111827')
    },
  },
  {
    id: 'sailfish',
    name: '旗鱼',
    fact: '海里游得最快的鱼之一',
    size: [86, 112],
    speed: [55, 72],
    zone: 'upper',
    style: 'cruise',
    tailHz: 1.8,
    mouth: [0.3, 0.02],
    halfHeight: 0.38,
    draw(ctx, p) {
      const fold = 1 - Math.min(0.55, Math.max(0, p.speed - 1.1) * 0.6)
      const sail = () => {
        ctx.beginPath()
        ctx.moveTo(0.24, -0.06)
        ctx.lineTo(0.2, -0.34 * fold)
        for (let i = 1; i <= 6; i++) ctx.lineTo(0.2 - i * 0.065, (-0.34 + i * 0.026 + (i % 2) * 0.02) * fold)
        ctx.lineTo(-0.2, -0.05)
        ctx.closePath()
      }
      sail()
      paint(ctx, 'rgba(30, 64, 175, 0.82)')
      clipped(ctx, sail, () => {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)'
        for (let i = 0; i < 12; i++) {
          circle(ctx, 0.17 - (i % 6) * 0.065, -0.12 - Math.floor(i / 6) * 0.1, 0.014)
          ctx.fill()
        }
      })
      poly(ctx, [0.27, -0.02, 0.52, 0.004, 0.27, 0.022])
      paint(ctx, '#1e3a8a')
      tailFin(ctx, -0.33, 'lunate', 0.24, p.wag * 0.3, '#1e3a8a')
      body(ctx, sailBody)
      paint(ctx, vertical(ctx, 'sailfish', -0.075, 0.075, [[0, '#1e3a8a'], [0.45, '#3b82f6'], [0.6, '#e0f2fe'], [1, '#f8fafc']]))
      clipped(ctx, () => body(ctx, sailBody), () => {
        ctx.fillStyle = 'rgba(147, 197, 253, 0.75)'
        for (let i = 0; i < 9; i++) ctx.fillRect(0.16 - i * 0.055, -0.07, 0.012, 0.11)
      })
      ctx.strokeStyle = '#1e3a8a'
      ctx.lineWidth = 1.2 * p.px
      ctx.beginPath()
      ctx.moveTo(0.12, 0.06)
      ctx.lineTo(-0.02, 0.17)
      ctx.stroke()
      eye(ctx, 0.23, -0.02, 0.026)
    },
  },
  {
    id: 'flying-fish',
    name: '飞鱼',
    fact: '胸鳍像翅膀，能滑翔出水',
    size: [38, 50],
    speed: [55, 72],
    zone: 'surface',
    style: 'cruise',
    tailHz: 3.2,
    mouth: [0.44, 0.01],
    halfHeight: 0.55,
    draw(ctx, p) {
      const spread = 0.62 + 0.38 * Math.abs(Math.sin(p.phase * 0.18))
      const wing = (sign: number, fill: string) => {
        ctx.beginPath()
        ctx.moveTo(0.14, sign * 0.03)
        ctx.quadraticCurveTo(0.02, sign * 0.32 * spread, -0.28, sign * 0.5 * spread)
        ctx.quadraticCurveTo(-0.48, sign * 0.22 * spread, -0.22, sign * 0.06)
        ctx.quadraticCurveTo(-0.02, sign * 0.1 * spread, 0.04, sign * 0.02)
        ctx.closePath()
        paint(ctx, fill)
        ctx.strokeStyle = 'rgba(30, 58, 138, 0.4)'
        ctx.lineWidth = 1.2 * p.px
        ctx.beginPath()
        for (let i = 1; i <= 4; i++) {
          ctx.moveTo(0.08, sign * 0.03)
          ctx.quadraticCurveTo(-0.04, sign * 0.1 * i * spread, -0.16 - i * 0.05, sign * (0.06 + 0.1 * i) * spread)
        }
        ctx.stroke()
      }
      wing(-1, 'rgba(96, 165, 250, 0.5)')
      ctx.save()
      ctx.translate(-0.3, 0)
      ctx.rotate(p.wag * 0.35)
      ctx.beginPath()
      ctx.moveTo(0.02, -0.03)
      ctx.quadraticCurveTo(-0.08, -0.08, -0.17, -0.15)
      ctx.quadraticCurveTo(-0.12, -0.04, -0.12, 0)
      ctx.quadraticCurveTo(-0.14, 0.06, -0.26, 0.17)
      ctx.quadraticCurveTo(-0.1, 0.1, 0.02, 0.03)
      ctx.closePath()
      paint(ctx, '#1e40af')
      ctx.restore()
      body(ctx, flyBody)
      paint(ctx, vertical(ctx, 'flying-fish', -0.085, 0.085, [[0, '#1e3a8a'], [0.5, '#3b82f6'], [0.58, '#e2e8f0'], [1, '#f8fafc']]))
      wing(1, 'rgba(191, 219, 254, 0.92)')
      eye(ctx, 0.31, -0.02, 0.04)
    },
  },
  {
    id: 'koi',
    name: '锦鲤',
    fact: '嘴边有两对小胡须',
    size: [52, 70],
    speed: [24, 34],
    zone: 'upper',
    style: 'glide',
    tailHz: 1.1,
    mouth: [0.46, 0.02],
    halfHeight: 0.26,
    draw(ctx, p) {
      ctx.beginPath()
      ctx.moveTo(0.14, -0.12)
      ctx.quadraticCurveTo(0, -0.23, -0.2, -0.17)
      ctx.lineTo(-0.2, -0.09)
      ctx.closePath()
      paint(ctx, 'rgba(255, 250, 245, 0.85)')
      tailFin(ctx, -0.3, 'forked', 0.24, p.wag * 0.45, 'rgba(255, 238, 225, 0.85)')
      body(ctx, koiBody)
      paint(ctx, vertical(ctx, 'koi', -0.135, 0.125, [[0, '#ffffff'], [1, '#efe9de']]))
      clipped(ctx, () => body(ctx, koiBody), () => {
        ctx.fillStyle = '#e8482a'
        oval(ctx, 0.24, -0.1, 0.12, 0.09, 0.3)
        ctx.fill()
        oval(ctx, -0.02, -0.12, 0.14, 0.08, -0.2)
        ctx.fill()
        oval(ctx, -0.22, -0.06, 0.08, 0.06)
        ctx.fill()
        ctx.fillStyle = '#111827'
        circle(ctx, 0.07, -0.04, 0.018)
        ctx.fill()
        circle(ctx, -0.13, -0.01, 0.014)
        ctx.fill()
      })
      ctx.strokeStyle = '#e9d5c0'
      ctx.lineWidth = 1.2 * p.px
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0.44, 0.04)
      ctx.quadraticCurveTo(0.46, 0.09, 0.41, 0.11)
      ctx.moveTo(0.42, 0.05)
      ctx.quadraticCurveTo(0.42, 0.08, 0.38, 0.09)
      ctx.stroke()
      oval(ctx, 0.2, 0.08, 0.07, 0.03, 0.6 + p.wag * 0.3)
      paint(ctx, 'rgba(255, 255, 255, 0.7)')
      eye(ctx, 0.34, -0.035, 0.03)
    },
  },
  {
    id: 'sturgeon',
    name: '鲟鱼',
    fact: '背上有一排排骨板',
    size: [72, 96],
    speed: [20, 30],
    zone: 'floor',
    style: 'cruise',
    tailHz: 0.9,
    mouth: [0.38, 0.07],
    halfHeight: 0.2,
    floor: 0.12,
    chase: 260,
    draw(ctx, p) {
      const skin = '#5b5f4f'
      poly(ctx, [-0.14, -0.07, -0.2, -0.14, -0.24, -0.05])
      paint(ctx, skin)
      tailFin(ctx, -0.33, 'shark', 0.24, p.wag * 0.3, skin)
      body(ctx, sturgeonBody)
      paint(ctx, vertical(ctx, 'sturgeon', -0.095, 0.085, [[0, '#585d4c'], [0.6, '#8a8d78'], [1, '#d6d3bd']]))
      clipped(ctx, () => body(ctx, sturgeonBody), () => {
        ctx.fillStyle = '#efeadc'
        for (const [y, count, s] of [[-0.075, 9, 0.016], [-0.01, 11, 0.013], [0.06, 9, 0.011]]) {
          for (let i = 0; i < count; i++) {
            const x = 0.3 - i * 0.06
            poly(ctx, [x, y - s, x + s, y, x, y + s, x - s, y])
            ctx.fill()
          }
        }
      })
      ctx.strokeStyle = '#d6d3bd'
      ctx.lineWidth = 1.1 * p.px
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (let i = 0; i < 4; i++) {
        const x = 0.35 + i * 0.022
        ctx.moveTo(x, 0.035)
        ctx.lineTo(x - 0.012, 0.08)
      }
      ctx.stroke()
      dot(ctx, 0.38, -0.035, 0.016, '#111827')
    },
  },
  {
    id: 'neon-tetra',
    name: '霓虹灯鱼',
    fact: '身上的蓝线会反光',
    size: [15, 20],
    speed: [44, 58],
    zone: 'middle',
    style: 'dart',
    tailHz: 4.5,
    mouth: [0.45, 0.01],
    halfHeight: 0.25,
    draw(ctx, p) {
      tailFin(ctx, -0.27, 'forked', 0.22, p.wag * 0.45, 'rgba(226, 232, 240, 0.6)')
      body(ctx, neonBody)
      paint(ctx, 'rgba(214, 224, 236, 0.92)')
      clipped(ctx, () => body(ctx, neonBody), () => {
        ctx.fillStyle = '#ef233c'
        ctx.fillRect(-0.3, 0, 0.42, 0.2)
        ctx.fillStyle = '#22d3ee'
        ctx.fillRect(-0.3, -0.065, 0.68, 0.06)
      })
      eye(ctx, 0.3, -0.03, 0.06, '#0f172a')
    },
  },
  {
    id: 'catfish',
    name: '鲶鱼',
    fact: '靠长胡须在水底找吃的',
    size: [52, 70],
    speed: [18, 26],
    zone: 'floor',
    style: 'bottom',
    tailHz: 1.2,
    mouth: [0.48, 0.03],
    halfHeight: 0.22,
    floor: 0.13,
    chase: 260,
    draw(ctx, p) {
      const sway = Math.sin(p.time * 2 + p.phase * 0.1) * 0.03
      poly(ctx, [0.16, -0.12, 0.1, -0.27, 0.02, -0.12])
      paint(ctx, '#3f4a1f')
      oval(ctx, -0.19, -0.075, 0.05, 0.025)
      paint(ctx, '#4b5320')
      tailFin(ctx, -0.32, 'round', 0.2, p.wag * 0.35, '#3f4a1f')
      body(ctx, catBody)
      paint(ctx, vertical(ctx, 'catfish', -0.13, 0.1, [[0, '#3a4220'], [0.6, '#6b7340'], [1, '#c2bf98']]))
      clipped(ctx, () => body(ctx, catBody), () => {
        ctx.fillStyle = 'rgba(30, 36, 14, 0.55)'
        for (const [x, y, r] of [[0.28, -0.07, 0.03], [0.12, -0.05, 0.025], [-0.02, -0.08, 0.03], [-0.15, -0.04, 0.022], [0.2, 0, 0.018], [0.02, -0.01, 0.02]]) {
          circle(ctx, x, y, r)
          ctx.fill()
        }
      })
      ctx.strokeStyle = '#2a3016'
      ctx.lineWidth = 1.4 * p.px
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0.46, 0)
      ctx.quadraticCurveTo(0.42, 0.12 + sway, 0.2, 0.2 + sway)
      ctx.moveTo(0.47, 0.02)
      ctx.quadraticCurveTo(0.52, 0.15 - sway, 0.36, 0.25 - sway)
      ctx.moveTo(0.42, 0.08)
      ctx.lineTo(0.4, 0.14)
      ctx.moveTo(0.38, 0.085)
      ctx.lineTo(0.36, 0.14)
      ctx.stroke()
      eye(ctx, 0.38, -0.05, 0.024, '#1f2937')
    },
  },
  {
    id: 'eel',
    name: '鳗鱼',
    fact: '身体像缎带一样左右摆动',
    size: [96, 130],
    speed: [24, 34],
    zone: 'lower',
    style: 'eel',
    tailHz: 0.8,
    mouth: [0.5, 0.01],
    halfHeight: 0.14,
    chase: 320,
    draw(ctx, p) {
      const points: Point[] = []
      const widths: number[] = []
      const count = 18
      for (let i = 0; i <= count; i++) {
        const t = i / count
        points.push({ x: 0.5 - t, y: Math.sin(p.phase - t * 6.5) * (0.02 + 0.07 * t) })
        widths.push(t < 0.12 ? 0.05 + t * 0.2 : 0.074 * (1 - t) + 0.008)
      }
      ribbon(ctx, points, widths.map((w, i) => w + (i > 2 ? 0.022 : 0)))
      paint(ctx, 'rgba(132, 204, 22, 0.5)')
      ribbon(ctx, points, widths)
      paint(ctx, vertical(ctx, 'eel', -0.09, 0.09, [[0, '#365314'], [0.5, '#4d7c0f'], [1, '#a3c95a']]))
      ctx.fillStyle = 'rgba(26, 46, 5, 0.45)'
      for (let i = 3; i < count; i += 2) {
        circle(ctx, points[i].x, points[i].y - widths[i] * 0.3, widths[i] * 0.35)
        ctx.fill()
      }
      const headY = points[0].y
      circle(ctx, 0.48, headY, 0.05)
      paint(ctx, '#4d7c0f')
      poly(ctx, [0.53, headY - 0.004, 0.4, headY + 0.024, 0.51, headY + 0.042])
      paint(ctx, '#1a2e05')
      ctx.fillStyle = '#f8fafc'
      for (let i = 0; i < 3; i++) {
        const x = 0.5 - i * 0.03
        poly(ctx, [x, headY + 0.004, x - 0.012, headY + 0.004, x - 0.006, headY + 0.02])
        ctx.fill()
      }
      eye(ctx, 0.45, headY - 0.025, 0.022, '#1a2e05')
    },
  },
  {
    id: 'ray',
    name: '鳐鱼',
    fact: '扇着两片“翅膀”在水里飞',
    size: [72, 96],
    speed: [24, 34],
    zone: 'lower',
    style: 'glide',
    tailHz: 0.55,
    mouth: [0.3, 0],
    halfHeight: 0.45,
    upright: true,
    draw(ctx, p) {
      const flap = Math.cos(p.phase)
      const span = 0.42 * (0.72 + 0.28 * flap)
      const tipX = -0.02 - 0.06 * flap
      ctx.strokeStyle = '#334155'
      ctx.lineWidth = 1.6 * p.px
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-0.16, 0)
      ctx.quadraticCurveTo(-0.36, Math.sin(p.phase * 0.7) * 0.04, -0.58, Math.sin(p.phase * 0.7 - 1) * 0.06)
      ctx.stroke()
      const wings = () => {
        ctx.beginPath()
        ctx.moveTo(0.3, 0)
        ctx.quadraticCurveTo(0.2, -span * 0.5, tipX, -span)
        ctx.quadraticCurveTo(-0.05, -span * 0.35, -0.18, 0)
        ctx.quadraticCurveTo(-0.05, span * 0.35, tipX, span)
        ctx.quadraticCurveTo(0.2, span * 0.5, 0.3, 0)
        ctx.closePath()
      }
      wings()
      paint(ctx, radial(ctx, 'ray', 0.06, 0, 0.5, [[0, '#4b5b70'], [1, '#1e293b']]))
      clipped(ctx, wings, () => {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.3)'
        oval(ctx, 0.06, -0.15, 0.09, 0.05, -0.5)
        ctx.fill()
        oval(ctx, 0.06, 0.15, 0.09, 0.05, 0.5)
        ctx.fill()
      })
      ctx.fillStyle = '#334155'
      oval(ctx, 0.33, -0.055, 0.05, 0.016, 0.35)
      ctx.fill()
      oval(ctx, 0.33, 0.055, 0.05, 0.016, -0.35)
      ctx.fill()
      dot(ctx, 0.24, -0.085, 0.017, '#0f172a')
      dot(ctx, 0.24, 0.085, 0.017, '#0f172a')
    },
  },
  {
    id: 'flounder',
    name: '比目鱼',
    fact: '两只眼睛长在同一边',
    size: [46, 62],
    speed: [16, 24],
    zone: 'floor',
    style: 'bottom',
    tailHz: 1.2,
    mouth: [0.42, 0.03],
    halfHeight: 0.26,
    floor: 0.2,
    chase: 220,
    upright: true,
    draw(ctx, p) {
      ctx.beginPath()
      const steps = 32
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * TAU
        const wave = Math.sin(a * 7 - p.phase * 2) * 0.012
        const x = Math.cos(a) * (0.47 + wave)
        const y = Math.sin(a) * (0.245 + wave)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      paint(ctx, 'rgba(150, 112, 70, 0.8)')
      tailFin(ctx, -0.44, 'round', 0.14, p.wag * 0.3, '#94693f')
      const flat = () => oval(ctx, 0, 0, 0.42, 0.19)
      flat()
      paint(ctx, radial(ctx, 'flounder', 0, 0, 0.45, [[0, '#c49a63'], [1, '#9c7448']]))
      clipped(ctx, flat, () => {
        for (const [x, y, r, light] of [[0.1, -0.06, 0.04, 1], [-0.12, 0.05, 0.05, 0], [-0.25, -0.05, 0.035, 1], [0, 0.09, 0.03, 0], [0.22, 0.08, 0.03, 1], [-0.05, -0.11, 0.03, 0]]) {
          circle(ctx, x, y, r)
          paint(ctx, light ? 'rgba(236, 214, 170, 0.7)' : 'rgba(110, 76, 40, 0.6)')
        }
      })
      eye(ctx, 0.28, -0.09, 0.035, '#3f2a14')
      eye(ctx, 0.2, -0.13, 0.032, '#3f2a14')
      ctx.strokeStyle = '#5c3f1f'
      ctx.lineWidth = 1.2 * p.px
      ctx.beginPath()
      ctx.moveTo(0.41, 0.02)
      ctx.quadraticCurveTo(0.38, 0.06, 0.34, 0.05)
      ctx.stroke()
    },
  },
  {
    id: 'seahorse',
    name: '海马',
    fact: '竖着身子慢悠悠地游',
    size: [36, 48],
    speed: [10, 16],
    zone: 'middle',
    style: 'hover',
    tailHz: 2,
    mouth: [0.21, -0.35],
    halfHeight: 0.52,
    chase: 240,
    upright: true,
    bob: 0.05,
    draw(ctx, p) {
      const flutter = Math.sin(p.phase * 3) * 0.35
      const spine: Point[] = [
        { x: -0.02, y: -0.3 },
        { x: 0.04, y: -0.18 },
        { x: 0.08, y: -0.05 },
        { x: 0.07, y: 0.08 },
        { x: 0.01, y: 0.19 },
        { x: -0.05, y: 0.28 },
        { x: -0.06, y: 0.36 },
      ]
      const widths = [0.065, 0.085, 0.1, 0.095, 0.075, 0.055, 0.042]
      for (let i = 1; i <= 7; i++) {
        const a = Math.PI + 0.35 - i * 0.62
        const r = 0.065 * (1 - i / 9)
        spine.push({ x: Math.cos(a) * r, y: 0.41 + Math.sin(a) * r })
        widths.push(0.04 * (1 - i / 8) + 0.008)
      }
      ctx.save()
      ctx.translate(-0.05, 0.1)
      ctx.rotate(Math.PI - 0.4 + flutter * 0.3)
      oval(ctx, 0.05, 0, 0.06, 0.028)
      paint(ctx, 'rgba(254, 240, 138, 0.75)')
      ctx.restore()
      const skin = vertical(ctx, 'seahorse', -0.45, 0.47, [[0, '#fcd34d'], [1, '#d97706']])
      ribbon(ctx, spine, widths)
      paint(ctx, skin)
      oval(ctx, 0, -0.34, 0.085, 0.068, -0.35)
      paint(ctx, skin)
      ctx.beginPath()
      ctx.roundRect(0.04, -0.375, 0.16, 0.042, 0.02)
      paint(ctx, skin)
      oval(ctx, 0.2, -0.354, 0.018, 0.026)
      paint(ctx, '#d97706')
      poly(ctx, [-0.05, -0.39, -0.03, -0.46, 0, -0.4])
      paint(ctx, skin)
      ctx.strokeStyle = 'rgba(146, 64, 14, 0.45)'
      ctx.lineWidth = p.px
      ctx.beginPath()
      for (let i = 1; i < 9; i++) {
        const a = spine[i - 1]
        const b = spine[i + 1]
        const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
        const nx = (-(b.y - a.y) / length) * widths[i]
        const ny = ((b.x - a.x) / length) * widths[i]
        ctx.moveTo(spine[i].x - nx, spine[i].y - ny)
        ctx.lineTo(spine[i].x + nx, spine[i].y + ny)
      }
      ctx.stroke()
      eye(ctx, 0.025, -0.35, 0.026)
    },
  },
  {
    id: 'anglerfish',
    name: '鮟鱇',
    fact: '头顶挂着一盏会发光的小灯',
    size: [46, 60],
    speed: [12, 20],
    zone: 'lower',
    style: 'hover',
    tailHz: 1,
    mouth: [0.4, 0.05],
    halfHeight: 0.6,
    floor: 0.3,
    chase: 260,
    bob: 0.012,
    draw(ctx, p) {
      const glow = 0.65 + 0.35 * Math.sin(p.time * 2.4 + p.phase * 0.1)
      tailFin(ctx, -0.3, 'round', 0.18, p.wag * 0.35, '#3b2f3f')
      poly(ctx, [-0.18, -0.16, -0.31, -0.05, -0.31, 0.05, -0.18, 0.17])
      paint(ctx, '#3b2f3f')
      const head = () => oval(ctx, 0.06, 0, 0.34, 0.29)
      head()
      paint(ctx, radial(ctx, 'anglerfish', 0, -0.08, 0.42, [[0, '#5e4b61'], [1, '#2b2230']]))
      clipped(ctx, head, () => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
        for (const [x, y] of [[-0.1, -0.12], [0.05, -0.2], [-0.16, 0.05], [0.12, -0.05], [-0.02, 0.18]]) {
          circle(ctx, x, y, 0.025)
          ctx.fill()
        }
      })
      ctx.beginPath()
      ctx.moveTo(0.4, -0.06)
      ctx.quadraticCurveTo(0.3, 0.24, 0.02, 0.15)
      ctx.quadraticCurveTo(0.24, 0.1, 0.4, -0.06)
      ctx.closePath()
      paint(ctx, '#140b12')
      ctx.fillStyle = '#f1f5f9'
      for (let i = 1; i < 6; i++) {
        const t = i / 6
        const u = 1 - t
        const lowerX = u * u * 0.4 + 2 * u * t * 0.3 + t * t * 0.02
        const lowerY = u * u * -0.06 + 2 * u * t * 0.24 + t * t * 0.15
        poly(ctx, [lowerX - 0.015, lowerY, lowerX + 0.015, lowerY, lowerX, lowerY - 0.045])
        ctx.fill()
        const upperX = u * u * 0.02 + 2 * u * t * 0.24 + t * t * 0.4
        const upperY = u * u * 0.15 + 2 * u * t * 0.1 + t * t * -0.06
        poly(ctx, [upperX - 0.013, upperY, upperX + 0.013, upperY, upperX, upperY + 0.038])
        ctx.fill()
      }
      ctx.strokeStyle = '#4a3a4e'
      ctx.lineWidth = 1.5 * p.px
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0.16, -0.27)
      ctx.quadraticCurveTo(0.34, -0.62, 0.55, -0.42)
      ctx.stroke()
      ctx.globalAlpha = glow
      circle(ctx, 0.56, -0.41, 0.16)
      paint(ctx, radial(ctx, 'anglerfish-glow', 0.56, -0.41, 0.16, [[0, 'rgba(190, 255, 240, 0.95)'], [1, 'rgba(190, 255, 240, 0)']]))
      ctx.globalAlpha = 1
      circle(ctx, 0.56, -0.41, 0.03)
      paint(ctx, '#ecfeff')
      oval(ctx, 0, 0.12, 0.07, 0.035, 0.6 + p.wag * 0.3)
      paint(ctx, '#4a3a4e')
      eye(ctx, 0.2, -0.13, 0.03, '#a3e635')
    },
  },
]
