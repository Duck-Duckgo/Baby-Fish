/** Homage kaiju guardian — original drawing, no logos. */

const TAU = Math.PI * 2

export type GodzillaPhase = 'enter' | 'patrol' | 'fight' | 'vanish'

export interface Godzilla {
  x: number
  y: number
  vx: number
  vy: number
  facing: 1 | -1
  scale: number
  phase: GodzillaPhase
  age: number
  bobPhase: number
  fightTimer: number
  vanishTimer: number
  targetX: number
  targetY: number
}

export function createGodzilla(width: number, sandBase: number, scale: number): Godzilla {
  const s = Math.max(0.85, Math.min(1.5, scale)) * 1.35
  const fromLeft = Math.random() < 0.5
  const y = 50 + Math.random() * Math.max(40, sandBase - 100)
  return {
    x: fromLeft ? -70 : width + 70,
    y,
    vx: 0,
    vy: 0,
    facing: fromLeft ? 1 : -1,
    scale: s,
    phase: 'enter',
    age: 0,
    bobPhase: Math.random() * TAU,
    fightTimer: 0,
    vanishTimer: 0,
    targetX: width * 0.5,
    targetY: y,
  }
}

export function godzillaGone(g: Godzilla): boolean {
  return g.phase === 'vanish' && g.vanishTimer <= 0
}

/** Rush the hunter and start the clash animation. */
export function startGodzillaFight(g: Godzilla, hx: number, hy: number) {
  g.phase = 'fight'
  g.fightTimer = 1.15
  g.targetX = hx
  g.targetY = hy
  g.facing = hx >= g.x ? 1 : -1
}

export function updateGodzilla(
  g: Godzilla,
  dt: number,
  width: number,
  sandBase: number,
  hunter: { x: number; y: number } | null,
) {
  g.age += dt
  const top = 36
  const bottom = Math.max(top + 30, sandBase - 30)
  const speed = 70 * g.scale

  if (g.phase === 'enter') {
    g.vx = g.facing * speed * 0.9
    g.x += g.vx * dt
    g.y += Math.sin(g.age * 2.2 + g.bobPhase) * 10 * dt
    g.y = clamp(g.y, top, bottom)
    if ((g.facing === 1 && g.x > width * 0.18) || (g.facing === -1 && g.x < width * 0.82)) {
      g.phase = 'patrol'
      g.targetX = width * (0.3 + Math.random() * 0.4)
      g.targetY = top + Math.random() * (bottom - top)
    }
    return
  }

  if (g.phase === 'patrol') {
    // Prefer lingering near the hunter when she's around.
    if (hunter) {
      g.targetX = hunter.x + (hunter.x < width / 2 ? 80 : -80)
      g.targetY = hunter.y
    } else if (Math.hypot(g.targetX - g.x, g.targetY - g.y) < 20) {
      g.targetX = 40 + Math.random() * Math.max(40, width - 80)
      g.targetY = top + Math.random() * (bottom - top)
    }
    const dx = g.targetX - g.x
    const dy = g.targetY - g.y
    const dist = Math.hypot(dx, dy) || 1
    g.facing = dx >= 0 ? 1 : -1
    const pace = hunter ? 1.15 : 0.7
    g.vx = (dx / dist) * speed * pace
    g.vy = (dy / dist) * speed * pace * 0.8
    g.x += g.vx * dt
    g.y += g.vy * dt + Math.sin(g.age * 2 + g.bobPhase) * 5 * dt
    g.y = clamp(g.y, top, bottom)
    g.x = clamp(g.x, -40, width + 40)
    return
  }

  if (g.phase === 'fight') {
    g.fightTimer -= dt
    const dx = g.targetX - g.x
    const dy = g.targetY - g.y
    const dist = Math.hypot(dx, dy) || 1
    g.facing = dx >= 0 ? 1 : -1
    g.x += (dx / dist) * speed * 2.2 * dt
    g.y += (dy / dist) * speed * 2.2 * dt
    if (g.fightTimer <= 0) {
      g.phase = 'vanish'
      g.vanishTimer = 0.85
    }
    return
  }

  // vanish — fade while drifting up a bit
  g.vanishTimer -= dt
  g.y -= 18 * dt
  g.x += g.facing * 12 * dt
}

export function drawGodzilla(ctx: CanvasRenderingContext2D, g: Godzilla) {
  ctx.save()
  const fade = g.phase === 'vanish' ? Math.max(0, g.vanishTimer / 0.85) : 1
  ctx.globalAlpha = fade
  ctx.translate(g.x, g.y)
  ctx.scale(g.facing * g.scale, g.scale)

  const shake = g.phase === 'fight' ? Math.sin(g.age * 40) * 2.5 : 0
  ctx.translate(shake, -shake * 0.4)

  // Shadow
  ctx.fillStyle = 'rgba(10, 30, 50, 0.25)'
  ctx.beginPath()
  ctx.ellipse(0, 28, 28, 7, 0, 0, TAU)
  ctx.fill()

  // Tail
  ctx.fillStyle = '#3f7d3a'
  ctx.beginPath()
  ctx.moveTo(-22, 4)
  ctx.quadraticCurveTo(-48, -2 + Math.sin(g.age * 4) * 3, -58, 10)
  ctx.quadraticCurveTo(-42, 14, -24, 12)
  ctx.closePath()
  ctx.fill()

  // Body
  ctx.fillStyle = '#4a9444'
  ctx.beginPath()
  ctx.ellipse(0, 4, 26, 16, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#1f4d1c'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Belly
  ctx.fillStyle = '#b7d68a'
  ctx.beginPath()
  ctx.ellipse(2, 8, 14, 9, 0, 0, TAU)
  ctx.fill()

  // Dorsal plates
  ctx.fillStyle = '#2f6b2c'
  for (const [x, h] of [
    [-14, 10],
    [-6, 14],
    [2, 16],
    [10, 12],
  ] as const) {
    ctx.beginPath()
    ctx.moveTo(x - 4, -6)
    ctx.lineTo(x, -6 - h)
    ctx.lineTo(x + 4, -6)
    ctx.closePath()
    ctx.fill()
  }

  // Legs
  ctx.strokeStyle = '#3f7d3a'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-10, 14)
  ctx.lineTo(-14, 24)
  ctx.moveTo(8, 14)
  ctx.lineTo(12, 24)
  ctx.stroke()
  ctx.fillStyle = '#2f6b2c'
  ctx.beginPath()
  ctx.ellipse(-14, 25, 5, 2.2, 0, 0, TAU)
  ctx.ellipse(12, 25, 5, 2.2, 0, 0, TAU)
  ctx.fill()

  // Arms
  ctx.strokeStyle = '#3f7d3a'
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.moveTo(16, 0)
  ctx.lineTo(28, 6 + Math.sin(g.age * 5) * 2)
  ctx.moveTo(-8, 2)
  ctx.lineTo(-18, 8)
  ctx.stroke()

  // Head
  ctx.fillStyle = '#4a9444'
  ctx.beginPath()
  ctx.ellipse(22, -6, 12, 10, 0.1, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#1f4d1c'
  ctx.lineWidth = 1.4
  ctx.stroke()

  // Jaw
  ctx.fillStyle = '#3f7d3a'
  ctx.beginPath()
  ctx.ellipse(28, -2, 7, 4.5, 0.2, 0, TAU)
  ctx.fill()

  // Eye
  ctx.fillStyle = '#fef08a'
  ctx.beginPath()
  ctx.ellipse(26, -9, 3.2, 2.6, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#111827'
  ctx.beginPath()
  ctx.arc(27, -9, 1.3, 0, TAU)
  ctx.fill()

  // Nostril puff / fight flash
  if (g.phase === 'fight') {
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 2
    ctx.globalAlpha = fade * 0.85
    for (const a of [-0.4, 0, 0.4]) {
      ctx.beginPath()
      ctx.moveTo(34, -4)
      ctx.lineTo(34 + Math.cos(a) * 16, -4 + Math.sin(a) * 10)
      ctx.stroke()
    }
  }

  ctx.restore()
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}
