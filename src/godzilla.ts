/** Cute homage kaiju guardian — original drawing, no logos. */

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
  /** Visual / power tier (starts at 1). */
  level: number
  /** Remaining KiKi intercepts before leaving. */
  charges: number
}

export function createGodzilla(width: number, sandBase: number, scale: number): Godzilla {
  const s = Math.max(0.85, Math.min(1.5, scale)) * 1.15
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
    level: 1,
    charges: 1,
  }
}

export function godzillaGone(g: Godzilla): boolean {
  return g.phase === 'vanish' && g.vanishTimer <= 0
}

/** +1 level appearance and +1 remaining intercept. */
export function upgradeGodzilla(g: Godzilla) {
  g.level += 1
  g.charges += 1
  g.scale = Math.min(g.scale * 1.06, 2.2)
}

/** Rush the hunter; spends one charge. Vanishes only when charges hit 0 after the clash. */
export function startGodzillaFight(g: Godzilla, hx: number, hy: number) {
  g.charges = Math.max(0, g.charges - 1)
  g.phase = 'fight'
  g.fightTimer = g.charges <= 0 ? 1.05 : 0.7
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
  const speed = (62 + g.level * 4) * g.scale

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
      if (g.charges <= 0) {
        g.phase = 'vanish'
        g.vanishTimer = 0.85
      } else {
        g.phase = 'patrol'
      }
    }
    return
  }

  g.vanishTimer -= dt
  g.y -= 18 * dt
  g.x += g.facing * 12 * dt
}

function paletteForLevel(level: number) {
  if (level >= 4) {
    return {
      body: '#5ec8ff',
      dark: '#1d6fa8',
      belly: '#e0f7ff',
      plate: '#fbbf24',
      cheek: '#fb7185',
      eye: '#fff7ed',
    }
  }
  if (level >= 3) {
    return {
      body: '#7dd3a0',
      dark: '#2f6b4a',
      belly: '#ecfdf5',
      plate: '#f59e0b',
      cheek: '#fb7185',
      eye: '#ffffff',
    }
  }
  if (level >= 2) {
    return {
      body: '#6ecf7a',
      dark: '#2f6b3c',
      belly: '#e8fce9',
      plate: '#86efac',
      cheek: '#fda4af',
      eye: '#ffffff',
    }
  }
  return {
    body: '#8fd99a',
    dark: '#3d7a48',
    belly: '#f0fdf2',
    plate: '#5bbf6c',
    cheek: '#fda4af',
    eye: '#ffffff',
  }
}

/** Chibi round kaiju — big eyes, blush, soft spikes; level tints / accessories. */
export function drawGodzilla(ctx: CanvasRenderingContext2D, g: Godzilla) {
  ctx.save()
  const fade = g.phase === 'vanish' ? Math.max(0, g.vanishTimer / 0.85) : 1
  ctx.globalAlpha = fade
  ctx.translate(g.x, g.y)
  const grow = 1 + Math.min(0.28, (g.level - 1) * 0.07)
  ctx.scale(g.facing * g.scale * grow, g.scale * grow)

  const shake = g.phase === 'fight' ? Math.sin(g.age * 40) * 2 : 0
  ctx.translate(shake, -shake * 0.35)
  const pal = paletteForLevel(g.level)
  const bob = Math.sin(g.age * 3 + g.bobPhase) * 1.2

  // Soft shadow
  ctx.fillStyle = 'rgba(10, 30, 50, 0.22)'
  ctx.beginPath()
  ctx.ellipse(0, 26, 22, 6, 0, 0, TAU)
  ctx.fill()

  // Cute stubby tail
  ctx.fillStyle = pal.body
  ctx.beginPath()
  ctx.moveTo(-16, 6 + bob)
  ctx.quadraticCurveTo(-36, 2 + Math.sin(g.age * 4) * 2, -42, 10 + bob)
  ctx.quadraticCurveTo(-30, 14, -16, 12 + bob)
  ctx.closePath()
  ctx.fill()

  // Round body
  ctx.fillStyle = pal.body
  ctx.beginPath()
  ctx.ellipse(0, 6 + bob, 18, 14, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = pal.dark
  ctx.lineWidth = 1.4
  ctx.stroke()

  // Soft belly
  ctx.fillStyle = pal.belly
  ctx.beginPath()
  ctx.ellipse(1, 9 + bob, 10, 8, 0, 0, TAU)
  ctx.fill()

  // Tiny dorsal nubbins (cute, not scary)
  ctx.fillStyle = pal.plate
  for (const [x, h] of [
    [-8, 7],
    [-1, 9],
    [6, 7],
  ] as const) {
    ctx.beginPath()
    ctx.moveTo(x - 3.2, -4 + bob)
    ctx.quadraticCurveTo(x, -4 - h + bob, x + 3.2, -4 + bob)
    ctx.closePath()
    ctx.fill()
  }

  // Stubby legs
  ctx.strokeStyle = pal.body
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-7, 16 + bob)
  ctx.lineTo(-9, 22 + bob)
  ctx.moveTo(7, 16 + bob)
  ctx.lineTo(9, 22 + bob)
  ctx.stroke()
  ctx.fillStyle = pal.dark
  ctx.beginPath()
  ctx.ellipse(-9, 23 + bob, 4.2, 2, 0, 0, TAU)
  ctx.ellipse(9, 23 + bob, 4.2, 2, 0, 0, TAU)
  ctx.fill()

  // Little arms
  ctx.strokeStyle = pal.body
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(12, 4 + bob)
  ctx.lineTo(20, 8 + bob + Math.sin(g.age * 5) * 1.5)
  ctx.moveTo(-10, 5 + bob)
  ctx.lineTo(-17, 9 + bob)
  ctx.stroke()

  // Oversized round head
  ctx.fillStyle = pal.body
  ctx.beginPath()
  ctx.arc(14, -8 + bob, 14, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = pal.dark
  ctx.lineWidth = 1.4
  ctx.stroke()

  // Blush
  ctx.fillStyle = pal.cheek
  ctx.globalAlpha = fade * 0.75
  ctx.beginPath()
  ctx.ellipse(8, -4 + bob, 3.2, 2.2, 0, 0, TAU)
  ctx.ellipse(20, -4 + bob, 3.2, 2.2, 0, 0, TAU)
  ctx.fill()
  ctx.globalAlpha = fade

  // Big sparkly eyes
  ctx.fillStyle = pal.eye
  ctx.beginPath()
  ctx.ellipse(11, -10 + bob, 4.2, 4.8, 0, 0, TAU)
  ctx.ellipse(19.5, -10 + bob, 4.2, 4.8, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#1e293b'
  ctx.beginPath()
  ctx.arc(12, -9.5 + bob, 2.1, 0, TAU)
  ctx.arc(20.5, -9.5 + bob, 2.1, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(13.1, -11 + bob, 0.9, 0, TAU)
  ctx.arc(21.6, -11 + bob, 0.9, 0, TAU)
  ctx.fill()

  // Tiny smile
  ctx.strokeStyle = pal.dark
  ctx.lineWidth = 1.3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(16, -3.5 + bob, 3.5, 0.15, Math.PI - 0.15)
  ctx.stroke()

  // Level accessories
  if (g.level >= 2) {
    // Little star mark on belly
    ctx.fillStyle = '#fde68a'
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const ro = i % 2 === 0 ? 4 : 1.7
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const px = 1 + Math.cos(a) * ro
      const py = 8 + bob + Math.sin(a) * ro
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
  }

  if (g.level >= 3) {
    // Mini crown
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.moveTo(6, -20 + bob)
    ctx.lineTo(8, -26 + bob)
    ctx.lineTo(11, -21 + bob)
    ctx.lineTo(14, -27 + bob)
    ctx.lineTo(17, -21 + bob)
    ctx.lineTo(20, -26 + bob)
    ctx.lineTo(22, -20 + bob)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#fef08a'
    ctx.beginPath()
    ctx.arc(14, -24 + bob, 1.4, 0, TAU)
    ctx.fill()
  }

  if (g.level >= 4) {
    // Sparkle aura
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.lineWidth = 1.2
    for (const [sx, sy] of [
      [-18, -16],
      [28, -18],
      [-12, 16],
      [24, 12],
    ] as const) {
      const twinkle = 0.7 + 0.3 * Math.sin(g.age * 8 + sx)
      ctx.globalAlpha = fade * twinkle
      ctx.beginPath()
      ctx.moveTo(sx, sy - 4)
      ctx.lineTo(sx, sy + 4)
      ctx.moveTo(sx - 4, sy)
      ctx.lineTo(sx + 4, sy)
      ctx.stroke()
    }
    ctx.globalAlpha = fade
  }

  // Fight sparkles
  if (g.phase === 'fight') {
    ctx.strokeStyle = '#fde68a'
    ctx.lineWidth = 2
    ctx.globalAlpha = fade * 0.9
    for (const a of [-0.5, 0, 0.5]) {
      ctx.beginPath()
      ctx.moveTo(28, -6 + bob)
      ctx.lineTo(28 + Math.cos(a) * 14, -6 + bob + Math.sin(a) * 9)
      ctx.stroke()
    }
  }

  ctx.restore()
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}
