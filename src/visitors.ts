export type VisitorKind = 'submarine' | 'diver'

export interface Visitor {
  kind: VisitorKind
  x: number
  y: number
  baseY: number
  direction: 1 | -1
  speed: number
  length: number
  phase: number
  bobPhase: number
  bubbleTimer: number
}

export type BubbleSink = (x: number, y: number, r: number, speed: number) => void

type Ctx = CanvasRenderingContext2D

const TAU = Math.PI * 2
const gradients = new Map<string, CanvasGradient>()

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function linear(ctx: Ctx, key: string, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  let gradient = gradients.get(key)
  if (!gradient) {
    gradient = ctx.createLinearGradient(x0, y0, x1, y1)
    for (const [offset, color] of stops) gradient.addColorStop(offset, color)
    gradients.set(key, gradient)
  }
  return gradient
}

function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, rotation = 0) {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU)
}

function poly(ctx: Ctx, points: number[]) {
  ctx.beginPath()
  ctx.moveTo(points[0], points[1])
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1])
  ctx.closePath()
}

function rounded(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

export function createVisitor(kind: VisitorKind, width: number, top: number, bottom: number, scale: number): Visitor {
  const submarine = kind === 'submarine'
  const length = (submarine ? rand(170, 210) : rand(105, 125)) * scale
  const direction = Math.random() < 0.5 ? 1 : -1
  const y = top + (bottom - top) * (submarine ? rand(0.3, 0.65) : rand(0.15, 0.6))
  return {
    kind,
    // Start just off-screen; the submarine's headlight beam reaches in first.
    x: direction === 1 ? -length * 0.7 : width + length * 0.7,
    y,
    baseY: y,
    direction,
    speed: (submarine ? rand(38, 50) : rand(28, 38)) * scale,
    length,
    phase: 0,
    bobPhase: rand(0, TAU),
    bubbleTimer: submarine ? 0 : rand(0.6, 1.4),
  }
}

export function updateVisitor(v: Visitor, dt: number, time: number, emit: BubbleSink) {
  const submarine = v.kind === 'submarine'
  v.x += v.direction * v.speed * dt
  v.y = v.baseY + Math.sin(time * 0.8 + v.bobPhase) * v.length * (submarine ? 0.025 : 0.04)
  v.phase += dt * (submarine ? 10 : 3.4)
  v.bubbleTimer -= dt
  if (v.bubbleTimer > 0) return
  if (submarine) {
    v.bubbleTimer = 0.14
    emit(v.x - v.direction * v.length * 0.5, v.y + rand(-0.05, 0.05) * v.length, rand(1.2, 2.8), rand(30, 50))
  } else {
    v.bubbleTimer = rand(2.4, 3.4)
    const mouthX = v.x + v.direction * v.length * 0.4
    for (let i = 0; i < 5; i++) emit(mouthX + rand(-3, 3), v.y - i * 5, rand(1.8, 4.2), rand(40, 65))
  }
}

export function visitorGone(v: Visitor, width: number) {
  return v.direction === 1 ? v.x - v.length * 0.7 > width : v.x + v.length * 0.7 < 0
}

/** Radius around a visitor that fish steer clear of. */
export function visitorReach(v: Visitor) {
  return v.length * (v.kind === 'submarine' ? 0.6 : 0.5)
}

export function drawVisitor(ctx: Ctx, v: Visitor) {
  ctx.save()
  ctx.translate(v.x, v.y)
  ctx.scale(v.direction * v.length, v.length)
  if (v.kind === 'submarine') drawSubmarine(ctx, v.phase)
  else drawDiver(ctx, v.phase)
  ctx.restore()
}

function drawSubmarine(ctx: Ctx, phase: number) {
  ctx.beginPath()
  ctx.moveTo(0.46, 0.01)
  ctx.lineTo(1.5, -0.3)
  ctx.lineTo(1.5, 0.44)
  ctx.closePath()
  ctx.fillStyle = linear(ctx, 'sub-beam', 0.46, 0, 1.5, 0, [[0, 'rgba(255, 249, 196, 0.4)'], [1, 'rgba(255, 249, 196, 0)']])
  ctx.fill()

  ctx.fillStyle = '#f59e0b'
  poly(ctx, [-0.36, -0.08, -0.47, -0.24, -0.44, -0.06])
  ctx.fill()
  poly(ctx, [-0.36, 0.08, -0.47, 0.24, -0.44, 0.06])
  ctx.fill()

  ctx.fillStyle = '#64748b'
  for (let i = 0; i < 3; i++) {
    const tip = Math.sin(phase + (i * TAU) / 3) * 0.12
    oval(ctx, -0.495, tip / 2, 0.016, Math.abs(tip) / 2 + 0.008)
    ctx.fill()
  }
  oval(ctx, -0.48, 0, 0.026, 0.026)
  ctx.fillStyle = '#334155'
  ctx.fill()

  rounded(ctx, -0.1, -0.31, 0.24, 0.2, 0.05)
  ctx.fillStyle = linear(ctx, 'sub-tower', 0, -0.31, 0, -0.11, [[0, '#ffe680'], [1, '#f2b01e']])
  ctx.fill()
  rounded(ctx, 0.03, -0.27, 0.075, 0.05, 0.02)
  ctx.fillStyle = '#0e7490'
  ctx.fill()
  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 0.022
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(-0.03, -0.31)
  ctx.lineTo(-0.03, -0.43)
  ctx.lineTo(0.04, -0.43)
  ctx.stroke()

  rounded(ctx, -0.43, -0.15, 0.89, 0.3, 0.15)
  ctx.fillStyle = linear(ctx, 'sub-hull', 0, -0.15, 0, 0.15, [[0, '#ffe27a'], [0.45, '#ffc83d'], [1, '#d98e04']])
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.fillStyle = '#f97316'
  ctx.fillRect(-0.5, 0.06, 1, 0.026)
  ctx.restore()

  for (const x of [0.24, 0.04, -0.16]) {
    oval(ctx, x, -0.015, 0.062, 0.062)
    ctx.fillStyle = '#b45309'
    ctx.fill()
    oval(ctx, x, -0.015, 0.045, 0.045)
    ctx.fillStyle = '#bff4ff'
    ctx.fill()
    oval(ctx, x - 0.014, -0.033, 0.016, 0.01, -0.6)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.fill()
  }

  ctx.fillStyle = 'rgba(146, 96, 10, 0.55)'
  for (let i = 0; i < 11; i++) {
    oval(ctx, -0.36 + i * 0.075, 0.11, 0.008, 0.008)
    ctx.fill()
  }
  oval(ctx, 0.452, 0.01, 0.026, 0.026)
  ctx.fillStyle = '#fffbe6'
  ctx.fill()
}

function drawDiver(ctx: Ctx, phase: number) {
  const suit = '#1e293b'
  const kick = Math.sin(phase)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const leg = (sign: number, color: string) => {
    const k = kick * sign
    const kneeX = -0.34
    const kneeY = 0.03 + k * 0.05
    const ankleX = -0.5
    const ankleY = 0.03 + k * 0.13
    ctx.strokeStyle = color
    ctx.lineWidth = 0.07
    ctx.beginPath()
    ctx.moveTo(-0.16, 0.01)
    ctx.lineTo(kneeX, kneeY)
    ctx.lineTo(ankleX, ankleY)
    ctx.stroke()
    ctx.save()
    ctx.translate(ankleX, ankleY)
    ctx.rotate(k * 0.45)
    ctx.beginPath()
    ctx.moveTo(0.01, -0.03)
    ctx.lineTo(-0.17, -0.055)
    ctx.quadraticCurveTo(-0.21, 0, -0.17, 0.055)
    ctx.lineTo(0.01, 0.03)
    ctx.closePath()
    ctx.fillStyle = sign > 0 ? '#f97316' : '#c2410c'
    ctx.fill()
    ctx.restore()
  }

  leg(-1, '#0f172a')

  rounded(ctx, -0.13, -0.19, 0.34, 0.1, 0.05)
  ctx.fillStyle = linear(ctx, 'diver-tank', 0, -0.19, 0, -0.09, [[0, '#fde047'], [1, '#ca8a04']])
  ctx.fill()
  ctx.fillStyle = '#94a3b8'
  ctx.fillRect(0.2, -0.165, 0.035, 0.05)

  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 0.014
  ctx.beginPath()
  ctx.moveTo(0.225, -0.15)
  ctx.quadraticCurveTo(0.31, -0.17, 0.38, 0.02)
  ctx.stroke()

  rounded(ctx, -0.2, -0.1, 0.46, 0.17, 0.085)
  ctx.fillStyle = suit
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.fillStyle = '#14b8a6'
  ctx.fillRect(-0.22, -0.035, 0.5, 0.028)
  ctx.restore()

  leg(1, suit)

  ctx.strokeStyle = suit
  ctx.lineWidth = 0.055
  ctx.beginPath()
  ctx.moveTo(0.17, -0.02)
  ctx.lineTo(0.09, 0.08)
  ctx.lineTo(0.23, 0.11)
  ctx.stroke()

  oval(ctx, 0.31, -0.04, 0.085, 0.085)
  ctx.fillStyle = suit
  ctx.fill()
  rounded(ctx, 0.33, -0.09, 0.08, 0.065, 0.022)
  ctx.fillStyle = linear(ctx, 'diver-mask', 0, -0.09, 0, -0.025, [[0, '#bae6fd'], [1, '#38bdf8']])
  ctx.fill()
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 0.012
  ctx.stroke()
  oval(ctx, 0.39, 0.03, 0.024, 0.024)
  ctx.fillStyle = '#475569'
  ctx.fill()
}
