/** Cute homage kaiju guardian — original drawing, no logos. */

const TAU = Math.PI * 2

export const GODZILLA_MAX_LEVEL = 10

export type GodzillaPhase = 'enter' | 'patrol' | 'drive' | 'vanish'

export interface WaveBlast {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  r: number
}

export interface Godzilla {
  x: number
  y: number
  vx: number
  vy: number
  facing: 1 | -1
  /** Base draw scale (grows ×1.2 per level). */
  scale: number
  phase: GodzillaPhase
  age: number
  bobPhase: number
  driveTimer: number
  vanishTimer: number
  targetX: number
  targetY: number
  level: number
  /** Remaining KiKi drive-aways before leaving. */
  charges: number
  waves: WaveBlast[]
  spitCooldown: number
}

export function createGodzilla(width: number, sandBase: number, scale: number): Godzilla {
  const s = Math.max(0.85, Math.min(1.5, scale)) * 1.05
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
    driveTimer: 0,
    vanishTimer: 0,
    targetX: width * 0.5,
    targetY: y,
    level: 1,
    charges: 1,
    waves: [],
    spitCooldown: 0,
  }
}

export function godzillaGone(g: Godzilla): boolean {
  return g.phase === 'vanish' && g.vanishTimer <= 0
}

/** +1 level, +20% size, +1 drive charge. Returns false at cap. */
export function upgradeGodzilla(g: Godzilla): boolean {
  if (g.level >= GODZILLA_MAX_LEVEL) return false
  g.level += 1
  g.charges += 1
  g.scale *= 1.2
  return true
}

/**
 * Start a wave-spit drive-away. Closer contact finishes sooner.
 * Returns false if already driving / vanishing / out of charges.
 */
export function startGodzillaDrive(g: Godzilla, hx: number, hy: number): boolean {
  if (g.phase === 'drive' || g.phase === 'vanish' || g.charges <= 0) return false
  g.charges -= 1
  g.phase = 'drive'
  const dist = Math.hypot(hx - g.x, hy - g.y)
  // Earlier / closer contact → shorter drive.
  g.driveTimer = clamp(0.4 + dist / 320, 0.4, 1.05)
  g.targetX = hx
  g.targetY = hy
  g.facing = hx >= g.x ? 1 : -1
  g.spitCooldown = 0
  spitWave(g, hx, hy)
  return true
}

function spitWave(g: Godzilla, hx: number, hy: number) {
  const dx = hx - g.x
  const dy = hy - g.y
  const dist = Math.hypot(dx, dy) || 1
  const speed = 210 + g.level * 8
  const mouthX = g.x + g.facing * 22 * g.scale
  const mouthY = g.y - 6 * g.scale
  g.waves.push({
    x: mouthX,
    y: mouthY,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    age: 0,
    life: 0.85,
    r: 10 + g.level * 0.8,
  })
}

export function updateGodzilla(
  g: Godzilla,
  dt: number,
  width: number,
  sandBase: number,
  hunter: { x: number; y: number; phase: string } | null,
  onWaveHitHunter: () => void,
) {
  g.age += dt
  const top = 36
  const bottom = Math.max(top + 30, sandBase - 30)
  const speed = (58 + g.level * 3) * g.scale

  // Wave projectiles
  for (const w of g.waves) {
    w.age += dt
    w.x += w.vx * dt
    w.y += w.vy * dt
    w.r += 28 * dt
    if (hunter && (hunter.phase === 'enter' || hunter.phase === 'chase')) {
      if (Math.hypot(w.x - hunter.x, w.y - hunter.y) < w.r + 16) {
        onWaveHitHunter()
        w.age = w.life
      }
    }
  }
  g.waves = g.waves.filter((w) => w.age < w.life)

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
    if (hunter && (hunter.phase === 'enter' || hunter.phase === 'chase')) {
      g.targetX = hunter.x
      g.targetY = hunter.y
      const dist = Math.hypot(hunter.x - g.x, hunter.y - g.y)
      const engage = 72 + g.scale * 28
      if (dist < engage && g.charges > 0) {
        startGodzillaDrive(g, hunter.x, hunter.y)
        return
      }
    } else if (Math.hypot(g.targetX - g.x, g.targetY - g.y) < 20) {
      g.targetX = 40 + Math.random() * Math.max(40, width - 80)
      g.targetY = top + Math.random() * (bottom - top)
    }
    const dx = g.targetX - g.x
    const dy = g.targetY - g.y
    const dist = Math.hypot(dx, dy) || 1
    g.facing = dx >= 0 ? 1 : -1
    const pace = hunter ? 1.25 : 0.7
    g.vx = (dx / dist) * speed * pace
    g.vy = (dy / dist) * speed * pace * 0.8
    g.x += g.vx * dt
    g.y += g.vy * dt + Math.sin(g.age * 2 + g.bobPhase) * 5 * dt
    g.y = clamp(g.y, top, bottom)
    g.x = clamp(g.x, -40, width + 40)
    return
  }

  if (g.phase === 'drive') {
    g.driveTimer -= dt
    if (hunter) {
      g.targetX = hunter.x
      g.targetY = hunter.y
      g.facing = hunter.x >= g.x ? 1 : -1
      g.spitCooldown -= dt
      if (g.spitCooldown <= 0) {
        spitWave(g, hunter.x, hunter.y)
        g.spitCooldown = 0.16
      }
      // Ease toward hunter while spitting
      const dx = hunter.x - g.x
      const dy = hunter.y - g.y
      const dist = Math.hypot(dx, dy) || 1
      g.x += (dx / dist) * speed * 0.55 * dt
      g.y += (dy / dist) * speed * 0.55 * dt
    }
    if (g.driveTimer <= 0) {
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
  const palettes = [
    { body: '#8fd99a', dark: '#3d7a48', belly: '#f0fdf2', plate: '#5bbf6c', cheek: '#fda4af', eye: '#ffffff' },
    { body: '#6ecf7a', dark: '#2f6b3c', belly: '#e8fce9', plate: '#86efac', cheek: '#fda4af', eye: '#ffffff' },
    { body: '#7dd3a0', dark: '#2f6b4a', belly: '#ecfdf5', plate: '#f59e0b', cheek: '#fb7185', eye: '#ffffff' },
    { body: '#5ec8ff', dark: '#1d6fa8', belly: '#e0f7ff', plate: '#fbbf24', cheek: '#fb7185', eye: '#fff7ed' },
    { body: '#60a5fa', dark: '#1e40af', belly: '#dbeafe', plate: '#93c5fd', cheek: '#f9a8d4', eye: '#ffffff' },
    { body: '#a78bfa', dark: '#5b21b6', belly: '#ede9fe', plate: '#c4b5fd', cheek: '#fb7185', eye: '#ffffff' },
    { body: '#f472b6', dark: '#9d174d', belly: '#fce7f3', plate: '#f9a8d4', cheek: '#fda4af', eye: '#ffffff' },
    { body: '#fb923c', dark: '#9a3412', belly: '#ffedd5', plate: '#fdba74', cheek: '#fb7185', eye: '#fff7ed' },
    { body: '#facc15', dark: '#a16207', belly: '#fef9c3', plate: '#fde047', cheek: '#fb7185', eye: '#ffffff' },
    { body: '#fbbf24', dark: '#92400e', belly: '#fffbeb', plate: '#fef08a', cheek: '#fb7185', eye: '#fff7ed' },
  ]
  return palettes[clamp(level, 1, GODZILLA_MAX_LEVEL) - 1]
}

/** Chibi kaiju — level grows size/color; Lv.10 shoots golden rays. */
export function drawGodzilla(ctx: CanvasRenderingContext2D, g: Godzilla) {
  // Waves behind the body
  for (const w of g.waves) {
    const t = 1 - w.age / w.life
    ctx.save()
    ctx.globalAlpha = 0.55 * t
    ctx.translate(w.x, w.y)
    const rings = 3
    for (let i = 0; i < rings; i++) {
      const rr = w.r * (0.45 + i * 0.28)
      ctx.beginPath()
      ctx.ellipse(0, 0, rr * 1.35, rr * 0.72, Math.atan2(w.vy, w.vx), 0, TAU)
      ctx.strokeStyle = g.level >= GODZILLA_MAX_LEVEL ? '#fde68a' : '#7dd3fc'
      ctx.lineWidth = 2.2 - i * 0.4
      ctx.stroke()
    }
    ctx.restore()
  }

  ctx.save()
  const fade = g.phase === 'vanish' ? Math.max(0, g.vanishTimer / 0.85) : 1
  ctx.globalAlpha = fade
  ctx.translate(g.x, g.y)
  ctx.scale(g.facing * g.scale, g.scale)

  const shake = g.phase === 'drive' ? Math.sin(g.age * 36) * 1.6 : 0
  ctx.translate(shake, -shake * 0.3)
  const pal = paletteForLevel(g.level)
  const bob = Math.sin(g.age * 3 + g.bobPhase) * 1.2

  // Soft shadow
  ctx.fillStyle = 'rgba(10, 30, 50, 0.22)'
  ctx.beginPath()
  ctx.ellipse(0, 26, 22, 6, 0, 0, TAU)
  ctx.fill()

  // Tail
  ctx.fillStyle = pal.body
  ctx.beginPath()
  ctx.moveTo(-16, 6 + bob)
  ctx.quadraticCurveTo(-36, 2 + Math.sin(g.age * 4) * 2, -42, 10 + bob)
  ctx.quadraticCurveTo(-30, 14, -16, 12 + bob)
  ctx.closePath()
  ctx.fill()

  // Body
  ctx.fillStyle = pal.body
  ctx.beginPath()
  ctx.ellipse(0, 6 + bob, 18, 14, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = pal.dark
  ctx.lineWidth = 1.4
  ctx.stroke()

  ctx.fillStyle = pal.belly
  ctx.beginPath()
  ctx.ellipse(1, 9 + bob, 10, 8, 0, 0, TAU)
  ctx.fill()

  // Dorsal plates — taller at higher levels
  ctx.fillStyle = pal.plate
  const plateH = 7 + Math.min(8, g.level)
  for (const [x, h] of [
    [-8, plateH * 0.85],
    [-1, plateH],
    [6, plateH * 0.85],
  ] as const) {
    ctx.beginPath()
    ctx.moveTo(x - 3.2, -4 + bob)
    ctx.quadraticCurveTo(x, -4 - h + bob, x + 3.2, -4 + bob)
    ctx.closePath()
    ctx.fill()
  }

  // Legs / arms
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

  ctx.strokeStyle = pal.body
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(12, 4 + bob)
  ctx.lineTo(20, 8 + bob + Math.sin(g.age * 5) * 1.5)
  ctx.moveTo(-10, 5 + bob)
  ctx.lineTo(-17, 9 + bob)
  ctx.stroke()

  // Head
  ctx.fillStyle = pal.body
  ctx.beginPath()
  ctx.arc(14, -8 + bob, 14, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = pal.dark
  ctx.lineWidth = 1.4
  ctx.stroke()

  ctx.fillStyle = pal.cheek
  ctx.globalAlpha = fade * 0.75
  ctx.beginPath()
  ctx.ellipse(8, -4 + bob, 3.2, 2.2, 0, 0, TAU)
  ctx.ellipse(20, -4 + bob, 3.2, 2.2, 0, 0, TAU)
  ctx.fill()
  ctx.globalAlpha = fade

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

  ctx.strokeStyle = pal.dark
  ctx.lineWidth = 1.3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(16, -3.5 + bob, 3.5, 0.15, Math.PI - 0.15)
  ctx.stroke()

  if (g.level >= 2) {
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
  }

  if (g.level >= 6) {
    // Shoulder jewels
    ctx.fillStyle = '#fef08a'
    ctx.beginPath()
    ctx.arc(-12, 2 + bob, 2.4, 0, TAU)
    ctx.arc(10, 0 + bob, 2.4, 0, TAU)
    ctx.fill()
  }

  if (g.level >= 8) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.lineWidth = 1.2
    for (const [sx, sy] of [
      [-20, -14],
      [30, -16],
      [-14, 16],
      [26, 12],
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

  // Lv.10 golden flash rays
  if (g.level >= GODZILLA_MAX_LEVEL) {
    ctx.save()
    ctx.globalAlpha = fade * (0.45 + 0.35 * Math.sin(g.age * 6))
    const rays = 10
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * TAU + g.age * 0.7
      const len = 36 + 10 * Math.sin(g.age * 5 + i)
      ctx.beginPath()
      ctx.moveTo(14, -8 + bob)
      ctx.lineTo(14 + Math.cos(a) * len, -8 + bob + Math.sin(a) * len)
      ctx.strokeStyle = i % 2 === 0 ? '#fde68a' : '#fbbf24'
      ctx.lineWidth = 2.2
      ctx.stroke()
    }
    ctx.restore()
  }

  // Drive mouth glow while spitting
  if (g.phase === 'drive') {
    ctx.fillStyle = g.level >= GODZILLA_MAX_LEVEL ? 'rgba(253, 224, 71, 0.85)' : 'rgba(125, 211, 252, 0.85)'
    ctx.beginPath()
    ctx.ellipse(24, -2 + bob, 5, 3.5, 0.2, 0, TAU)
    ctx.fill()
  }

  ctx.restore()
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}
