/** Homage “little round-faced girl” monster — original drawing, no logos. */

const TAU = Math.PI * 2

export type MonsterPhase = 'enter' | 'chase' | 'eat' | 'leave'

export interface Monster {
  x: number
  y: number
  vx: number
  vy: number
  facing: 1 | -1
  scale: number
  phase: MonsterPhase
  age: number
  chaseLeft: number
  eatTimer: number
  bobPhase: number
  targetId: number | null
  eaten: boolean
}

export function createMonster(width: number, _height: number, sandBase: number, scale: number): Monster {
  const s = Math.max(0.75, Math.min(1.4, scale)) * 1.15
  const fromLeft = Math.random() < 0.5
  const y = 40 + Math.random() * Math.max(40, sandBase - 80)
  return {
    x: fromLeft ? -40 : width + 40,
    y,
    vx: 0,
    vy: 0,
    facing: fromLeft ? 1 : -1,
    scale: s,
    phase: 'enter',
    age: 0,
    chaseLeft: 5.5 + Math.random() * 2.5,
    eatTimer: 0,
    bobPhase: Math.random() * TAU,
    targetId: null,
    eaten: false,
  }
}

export function monsterGone(m: Monster, width: number): boolean {
  return m.phase === 'leave' && (m.x < -60 || m.x > width + 60)
}

/** Pick a fish index to hunt, preferring mid-sized swimmers. */
export function pickMonsterTarget(count: number): number | null {
  if (count <= 0) return null
  return Math.floor(Math.random() * count)
}

export function updateMonster(
  m: Monster,
  dt: number,
  width: number,
  sandBase: number,
  fish: { x: number; y: number; length: number }[],
  removeFishAt: (index: number) => void,
) {
  m.age += dt
  const top = 28
  const bottom = Math.max(top + 20, sandBase - 24)
  const speed = 95 * m.scale

  if (m.phase === 'enter') {
    m.vx = m.facing * speed * 0.85
    m.x += m.vx * dt
    m.y += Math.sin(m.age * 3 + m.bobPhase) * 8 * dt
    m.y = clamp(m.y, top, bottom)
    if ((m.facing === 1 && m.x > width * 0.2) || (m.facing === -1 && m.x < width * 0.8)) {
      m.phase = 'chase'
      m.targetId = pickMonsterTarget(fish.length)
    }
    return
  }

  if (m.phase === 'chase') {
    m.chaseLeft -= dt
    if (m.targetId === null || m.targetId >= fish.length) {
      m.targetId = pickMonsterTarget(fish.length)
    }
    if (m.targetId === null || fish.length === 0) {
      m.phase = 'leave'
      m.facing = m.x < width / 2 ? -1 : 1
      m.vx = m.facing * speed
      return
    }

    const target = fish[m.targetId]
    const dx = target.x - m.x
    const dy = target.y - m.y
    const dist = Math.hypot(dx, dy) || 1
    m.facing = dx >= 0 ? 1 : -1
    m.vx = (dx / dist) * speed
    m.vy = (dy / dist) * speed * 0.85
    m.x += m.vx * dt
    m.y += m.vy * dt + Math.sin(m.age * 4 + m.bobPhase) * 6 * dt
    m.y = clamp(m.y, top, bottom)

    const catchRadius = 22 * m.scale + target.length * 0.25
    const readyToEat = dist < catchRadius && (m.chaseLeft < 3.5 || Math.random() < dt * 0.35)
    if (readyToEat || (m.chaseLeft <= 0 && dist < catchRadius * 1.8)) {
      // Eat this fish (or a random one if the target fled indexing).
      const index = m.targetId < fish.length ? m.targetId : pickMonsterTarget(fish.length)
      if (index !== null) {
        removeFishAt(index)
        m.eaten = true
        m.phase = 'eat'
        m.eatTimer = 0.85
        m.vx = 0
        m.vy = 0
      } else {
        m.phase = 'leave'
        m.facing = m.x < width / 2 ? -1 : 1
        m.vx = m.facing * speed
      }
      return
    }

    if (m.chaseLeft <= 0) {
      // Failed catch — leave without eating.
      m.phase = 'leave'
      m.facing = m.x < width / 2 ? -1 : 1
      m.vx = m.facing * speed * 1.1
    }
    return
  }

  if (m.phase === 'eat') {
    m.eatTimer -= dt
    m.y += Math.sin(m.age * 10) * 10 * dt
    if (m.eatTimer <= 0) {
      m.phase = 'leave'
      m.facing = m.x < width / 2 ? -1 : 1
      m.vx = m.facing * speed * 1.15
    }
    return
  }

  // leave
  m.x += m.vx * dt
  m.y += Math.sin(m.age * 3 + m.bobPhase) * 10 * dt
  m.y = clamp(m.y, top, bottom)
}

export function drawMonster(ctx: CanvasRenderingContext2D, m: Monster) {
  ctx.save()
  ctx.translate(m.x, m.y)
  ctx.scale(m.facing * m.scale, m.scale)
  const menacing = m.phase === 'enter' || m.phase === 'chase' || m.phase === 'eat'
  const chew = m.phase === 'eat' ? Math.sin(m.age * 18) * 1.5 : 0
  const pulse = 0.85 + 0.15 * Math.sin(m.age * 8)

  // Lightning / pressure aura (stronger on enter & chase)
  if (menacing) {
    const bolts = [
      [-28, -38, -42, -62, -34, -48],
      [26, -40, 44, -66, 32, -50],
      [-8, -48, -6, -72, 4, -58],
      [10, -46, 18, -70, 6, -56],
      [-34, -18, -56, -28, -44, -10],
      [34, -16, 58, -30, 46, -6],
    ] as const
    ctx.save()
    ctx.globalAlpha = (m.phase === 'enter' ? 0.95 : 0.7) * pulse
    for (const [x0, y0, x1, y1, x2, y2] of bolts) {
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.closePath()
      ctx.fillStyle = '#7dd3fc'
      ctx.fill()
      ctx.strokeStyle = '#e0f2fe'
      ctx.lineWidth = 1.2
      ctx.stroke()
    }
    // Dark pressure halo
    ctx.globalAlpha = m.phase === 'enter' ? 0.35 : 0.2
    const halo = ctx.createRadialGradient(0, -12, 8, 0, -12, 48)
    halo.addColorStop(0, 'rgba(30, 20, 60, 0.55)')
    halo.addColorStop(1, 'rgba(30, 20, 60, 0)')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(0, -12, 48, 0, TAU)
    ctx.fill()
    ctx.restore()
  }

  // Ground shadow
  ctx.fillStyle = 'rgba(10, 30, 50, 0.2)'
  ctx.beginPath()
  ctx.ellipse(0, 20, 14, 4.5, 0, 0, TAU)
  ctx.fill()

  // Arms
  ctx.strokeStyle = '#f2c4a0'
  ctx.lineWidth = 3.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-11, 2)
  ctx.lineTo(-17, 8 + chew)
  ctx.moveTo(11, 2)
  ctx.lineTo(17, 6 - chew)
  ctx.stroke()

  // Yellow sweater body
  ctx.fillStyle = '#facc15'
  ctx.beginPath()
  ctx.moveTo(-13, -2)
  ctx.lineTo(-15, 14)
  ctx.quadraticCurveTo(0, 17, 15, 14)
  ctx.lineTo(13, -2)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#ca8a04'
  ctx.lineWidth = 1.2
  ctx.stroke()

  // White pointed collar
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(-8, -2)
  ctx.lineTo(0, 5)
  ctx.lineTo(8, -2)
  ctx.lineTo(4, -3)
  ctx.lineTo(0, 1)
  ctx.lineTo(-4, -3)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1
  ctx.stroke()

  // Head
  const headY = -16
  const headR = 17
  ctx.fillStyle = '#f6c9a8'
  ctx.beginPath()
  ctx.arc(0, headY, headR, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Face shadow band (menacing upper half)
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, headY, headR - 0.5, 0, TAU)
  ctx.clip()
  ctx.fillStyle = 'rgba(120, 72, 48, 0.55)'
  ctx.fillRect(-headR, headY - headR, headR * 2, headR * 0.95)
  ctx.restore()

  // Hair bob + three jagged bangs
  ctx.fillStyle = '#111827'
  ctx.beginPath()
  ctx.arc(0, headY - 2, headR + 0.5, Math.PI * 1.05, -0.05, false)
  ctx.lineTo(headR - 1, headY + 2)
  ctx.quadraticCurveTo(12, headY + 8, 8, headY + 4)
  ctx.lineTo(-8, headY + 4)
  ctx.quadraticCurveTo(-12, headY + 8, -headR + 1, headY + 2)
  ctx.closePath()
  ctx.fill()
  // Side hair
  ctx.beginPath()
  ctx.ellipse(-15, headY + 2, 5.5, 8, -0.15, 0, TAU)
  ctx.ellipse(15, headY + 2, 5.5, 8, 0.15, 0, TAU)
  ctx.fill()
  // Sawtooth bangs — three short triangles on the forehead (above the eyes)
  for (const tipX of [-7, 0, 7]) {
    ctx.beginPath()
    ctx.moveTo(tipX - 4.5, headY - 8)
    ctx.lineTo(tipX, headY - 1.5)
    ctx.lineTo(tipX + 4.5, headY - 8)
    ctx.closePath()
    ctx.fill()
  }

  // Thin arched brows sitting above the fringe tips
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1.4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-9, headY - 9.5)
  ctx.quadraticCurveTo(-5.5, headY - 12.5, -2, headY - 10)
  ctx.moveTo(2, headY - 10)
  ctx.quadraticCurveTo(5.5, headY - 12.5, 9, headY - 9.5)
  ctx.stroke()

  // Squinting slit eyes + inward pupils (scheming look)
  ctx.fillStyle = '#6b7280'
  ctx.beginPath()
  ctx.ellipse(-5.5, headY + 1.5, 4.4, 1.25, 0, 0, TAU)
  ctx.ellipse(5.5, headY + 1.5, 4.4, 1.25, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#111827'
  ctx.beginPath()
  ctx.arc(-4.0, headY + 1.5, 1.15, 0, TAU)
  ctx.arc(4.0, headY + 1.5, 1.15, 0, TAU)
  ctx.fill()

  // Pink circular blush
  ctx.fillStyle = '#fb7185'
  ctx.beginPath()
  ctx.arc(-9.5, headY + 6.5, 2.8, 0, TAU)
  ctx.arc(9.5, headY + 6.5, 2.8, 0, TAU)
  ctx.fill()

  // Mischievous half-moon grin
  ctx.fillStyle = '#7f1d1d'
  ctx.beginPath()
  ctx.moveTo(-7.5, headY + 9.5)
  ctx.quadraticCurveTo(0, headY + 17.5 + chew * 0.2, 7.5, headY + 9.5)
  ctx.quadraticCurveTo(0, headY + 11.5, -7.5, headY + 9.5)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1.2
  ctx.stroke()

  ctx.restore()
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}
