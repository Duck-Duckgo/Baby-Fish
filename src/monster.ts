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
  const chew = m.phase === 'eat' ? Math.sin(m.age * 18) * 2 : 0

  // Shadow
  ctx.fillStyle = 'rgba(10, 30, 50, 0.18)'
  ctx.beginPath()
  ctx.ellipse(0, 22, 16, 5, 0, 0, TAU)
  ctx.fill()

  // Legs (short chibi)
  ctx.strokeStyle = '#f5c9a0'
  ctx.lineWidth = 3.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-5, 10)
  ctx.lineTo(-6, 18)
  ctx.moveTo(5, 10)
  ctx.lineTo(6, 18)
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.fillRect(-9, 17, 6, 3)
  ctx.fillRect(3, 17, 6, 3)
  ctx.fillStyle = '#c45c26'
  ctx.fillRect(-9, 19.5, 6, 2.5)
  ctx.fillRect(3, 19.5, 6, 2.5)

  // Arms
  ctx.strokeStyle = '#f5c9a0'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-12, -2)
  ctx.lineTo(-18, 4 + chew)
  ctx.moveTo(12, -2)
  ctx.lineTo(18, 2 - chew)
  ctx.stroke()

  // Red dress
  ctx.fillStyle = '#e11d48'
  ctx.beginPath()
  ctx.moveTo(-13, -4)
  ctx.lineTo(-16, 12)
  ctx.quadraticCurveTo(0, 16, 16, 12)
  ctx.lineTo(13, -4)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.fillRect(-13, -4, 26, 2.5)

  // Head (big round)
  ctx.fillStyle = '#f7d3b0'
  ctx.beginPath()
  ctx.arc(0, -16, 16, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1.3
  ctx.stroke()

  // Short bob hair with side puffs
  ctx.fillStyle = '#1f2937'
  ctx.beginPath()
  ctx.arc(0, -20, 15.5, Math.PI, 0)
  ctx.lineTo(15, -14)
  ctx.quadraticCurveTo(12, -6, 8, -8)
  ctx.lineTo(-8, -8)
  ctx.quadraticCurveTo(-12, -6, -15, -14)
  ctx.closePath()
  ctx.fill()
  // Side hair bulbs
  ctx.beginPath()
  ctx.ellipse(-14, -12, 5, 7, -0.2, 0, TAU)
  ctx.ellipse(14, -12, 5, 7, 0.2, 0, TAU)
  ctx.fill()

  // Tiny hair clips (plain dots, no logos)
  ctx.fillStyle = '#f472b6'
  ctx.beginPath()
  ctx.arc(-7, -28, 2.2, 0, TAU)
  ctx.arc(7, -28, 2.2, 0, TAU)
  ctx.fill()

  // Eyes
  ctx.fillStyle = '#111827'
  ctx.beginPath()
  ctx.ellipse(-5.5, -16, 2.2, 3.2, 0, 0, TAU)
  ctx.ellipse(5.5, -16, 2.2, 3.2, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(-4.8, -17.2, 0.8, 0, TAU)
  ctx.arc(6.2, -17.2, 0.8, 0, TAU)
  ctx.fill()

  // Blush
  ctx.fillStyle = 'rgba(248, 113, 113, 0.45)'
  ctx.beginPath()
  ctx.ellipse(-9, -11, 3, 1.6, 0, 0, TAU)
  ctx.ellipse(9, -11, 3, 1.6, 0, 0, TAU)
  ctx.fill()

  // Mouth
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1.3
  ctx.beginPath()
  if (m.phase === 'eat') {
    ctx.ellipse(0, -9 + chew * 0.15, 3.5, 2.8, 0, 0, TAU)
    ctx.fillStyle = '#7f1d1d'
    ctx.fill()
  } else if (m.phase === 'chase') {
    ctx.moveTo(-3, -9)
    ctx.lineTo(3, -9)
    ctx.stroke()
  } else {
    ctx.arc(0, -10, 2.8, 0.15, Math.PI - 0.15)
    ctx.stroke()
  }

  // Speech puff when eating
  if (m.phase === 'eat') {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.beginPath()
    ctx.arc(18, -26, 4, 0, TAU)
    ctx.arc(24, -32, 3, 0, TAU)
    ctx.fill()
  }

  ctx.restore()
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}
