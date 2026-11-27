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
  /** Seconds left to show the “Ki Ki!” warning bubble. */
  alertLeft: number
}

export function createMonster(width: number, _height: number, sandBase: number, scale: number): Monster {
  const s = Math.max(0.75, Math.min(1.4, scale)) * 1.2
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
    alertLeft: 2.6,
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

/** Two short “Ki Ki” beeps via Web Audio (no asset files). */
export function playKikiAlert() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ac = new AC()
    const now = ac.currentTime
    for (const [t, freq] of [
      [0, 920],
      [0.14, 1100],
    ] as const) {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + t)
      gain.gain.exponentialRampToValueAtTime(0.07, now + t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.11)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(now + t)
      osc.stop(now + t + 0.13)
    }
    window.setTimeout(() => void ac.close(), 600)
  } catch {
    // Autoplay / AudioContext may be blocked — visual alert still works.
  }
}

export function updateMonster(
  m: Monster,
  dt: number,
  width: number,
  sandBase: number,
  fish: { x: number; y: number; length: number }[],
  /** Return false to cancel the catch (e.g. guardian blocked it). */
  removeFishAt: (index: number) => boolean,
) {
  m.age += dt
  if (m.alertLeft > 0) m.alertLeft -= dt
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
      const index = m.targetId < fish.length ? m.targetId : pickMonsterTarget(fish.length)
      if (index !== null) {
        const ok = removeFishAt(index)
        if (!ok) {
          // Guardian blocked the catch — flee without eating.
          m.eaten = false
          m.phase = 'leave'
          m.facing = m.x < width / 2 ? -1 : 1
          m.vx = m.facing * speed * 1.35
          return
        }
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

  m.x += m.vx * dt
  m.y += Math.sin(m.age * 3 + m.bobPhase) * 10 * dt
  m.y = clamp(m.y, top, bottom)
}

/**
 * Classic round-faced homage: oversized round head, three sawtooth bangs,
 * red dress + white collar. Menacing shadow / lightning while hunting.
 */
export function drawMonster(ctx: CanvasRenderingContext2D, m: Monster) {
  ctx.save()
  ctx.translate(m.x, m.y)
  ctx.scale(m.facing * m.scale, m.scale)
  const menacing = m.phase === 'enter' || m.phase === 'chase' || m.phase === 'eat'
  const chew = m.phase === 'eat' ? Math.sin(m.age * 18) * 1.5 : 0
  const pulse = 0.85 + 0.15 * Math.sin(m.age * 8)

  if (menacing) {
    const bolts = [
      [-30, -42, -46, -68, -36, -52],
      [28, -44, 48, -72, 34, -54],
      [-10, -52, -8, -78, 4, -62],
      [12, -50, 20, -76, 6, -60],
      [-38, -20, -60, -32, -48, -12],
      [38, -18, 62, -34, 50, -8],
    ] as const
    ctx.save()
    ctx.globalAlpha = (m.phase === 'enter' ? 0.95 : 0.65) * pulse
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
    ctx.globalAlpha = m.phase === 'enter' ? 0.32 : 0.18
    const halo = ctx.createRadialGradient(0, -14, 8, 0, -14, 52)
    halo.addColorStop(0, 'rgba(30, 20, 60, 0.55)')
    halo.addColorStop(1, 'rgba(30, 20, 60, 0)')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(0, -14, 52, 0, TAU)
    ctx.fill()
    ctx.restore()
  }

  ctx.fillStyle = 'rgba(10, 30, 50, 0.2)'
  ctx.beginPath()
  ctx.ellipse(0, 22, 15, 4.5, 0, 0, TAU)
  ctx.fill()

  // Stick arms
  ctx.strokeStyle = '#f0c2a0'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-12, 4)
  ctx.lineTo(-18, 11 + chew)
  ctx.moveTo(12, 4)
  ctx.lineTo(18, 9 - chew)
  ctx.stroke()

  // Classic red dress
  ctx.fillStyle = '#e11d48'
  ctx.beginPath()
  ctx.moveTo(-12, 0)
  ctx.lineTo(-16, 16)
  ctx.quadraticCurveTo(0, 20, 16, 16)
  ctx.lineTo(12, 0)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#9f1239'
  ctx.lineWidth = 1.2
  ctx.stroke()

  // White pointed collar
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(-9, 0)
  ctx.lineTo(0, 6)
  ctx.lineTo(9, 0)
  ctx.lineTo(4, -1)
  ctx.lineTo(0, 2.5)
  ctx.lineTo(-4, -1)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1
  ctx.stroke()

  // Legs
  ctx.strokeStyle = '#f0c2a0'
  ctx.lineWidth = 2.6
  ctx.beginPath()
  ctx.moveTo(-5, 16)
  ctx.lineTo(-6, 20)
  ctx.moveTo(5, 16)
  ctx.lineTo(6, 20)
  ctx.stroke()
  ctx.fillStyle = '#1e293b'
  ctx.beginPath()
  ctx.ellipse(-6, 21, 3.2, 1.6, 0, 0, TAU)
  ctx.ellipse(6, 21, 3.2, 1.6, 0, 0, TAU)
  ctx.fill()

  // Oversized round head (classic silhouette)
  const headY = -18
  const headR = 19
  ctx.fillStyle = '#f7c9a8'
  ctx.beginPath()
  ctx.arc(0, headY, headR, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1.6
  ctx.stroke()

  // Menacing upper-face shadow
  if (menacing) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(0, headY, headR - 0.5, 0, TAU)
    ctx.clip()
    ctx.fillStyle = 'rgba(130, 78, 50, 0.58)'
    ctx.fillRect(-headR, headY - headR, headR * 2, headR * 0.92)
    ctx.restore()
  }

  // Black bob + side curves
  ctx.fillStyle = '#111827'
  ctx.beginPath()
  ctx.arc(0, headY - 3, headR + 1, Math.PI * 1.08, -0.08, false)
  ctx.lineTo(headR - 0.5, headY + 3)
  ctx.quadraticCurveTo(14, headY + 10, 9, headY + 5)
  ctx.lineTo(-9, headY + 5)
  ctx.quadraticCurveTo(-14, headY + 10, -headR + 0.5, headY + 3)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-16.5, headY + 3, 6, 9, -0.12, 0, TAU)
  ctx.ellipse(16.5, headY + 3, 6, 9, 0.12, 0, TAU)
  ctx.fill()

  // Three classic sawtooth bangs
  for (const tipX of [-7.5, 0, 7.5]) {
    ctx.beginPath()
    ctx.moveTo(tipX - 5, headY - 9)
    ctx.lineTo(tipX, headY - 0.5)
    ctx.lineTo(tipX + 5, headY - 9)
    ctx.closePath()
    ctx.fill()
  }

  // Thin arched brows
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1.35
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-10, headY - 10)
  ctx.quadraticCurveTo(-6, headY - 13.5, -2.5, headY - 10.5)
  ctx.moveTo(2.5, headY - 10.5)
  ctx.quadraticCurveTo(6, headY - 13.5, 10, headY - 10)
  ctx.stroke()

  // Classic slit eyes + inward pupils
  ctx.fillStyle = menacing ? '#5b6472' : '#374151'
  ctx.beginPath()
  ctx.ellipse(-5.8, headY + 1.2, 4.6, 1.2, 0, 0, TAU)
  ctx.ellipse(5.8, headY + 1.2, 4.6, 1.2, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#111827'
  ctx.beginPath()
  ctx.arc(-4.2, headY + 1.2, 1.2, 0, TAU)
  ctx.arc(4.2, headY + 1.2, 1.2, 0, TAU)
  ctx.fill()

  // Round pink blush
  ctx.fillStyle = '#fb7185'
  ctx.beginPath()
  ctx.arc(-10.5, headY + 7, 3, 0, TAU)
  ctx.arc(10.5, headY + 7, 3, 0, TAU)
  ctx.fill()

  // Tiny nose
  ctx.strokeStyle = '#c0846a'
  ctx.lineWidth = 1.1
  ctx.beginPath()
  ctx.moveTo(0, headY + 4)
  ctx.lineTo(0, headY + 6.5)
  ctx.stroke()

  // Mischievous half-moon grin (or chew)
  ctx.fillStyle = '#7f1d1d'
  ctx.beginPath()
  ctx.moveTo(-8, headY + 10)
  ctx.quadraticCurveTo(0, headY + 18.5 + chew * 0.25, 8, headY + 10)
  ctx.quadraticCurveTo(0, headY + 12.2, -8, headY + 10)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1.15
  ctx.stroke()

  ctx.restore()

  // “Ki Ki!” speech bubble (screen-space, not mirrored)
  if (m.alertLeft > 0) {
    drawKikiBubble(ctx, m)
  }
}

/** Warning bubble + soft screen subtitle while she enters. */
export function drawKikiBubble(ctx: CanvasRenderingContext2D, m: Monster) {
  const fade = Math.min(1, m.alertLeft / 0.35)
  const bounce = 1 + 0.06 * Math.sin(m.age * 14)
  const bx = m.x + m.facing * 28 * m.scale
  const by = m.y - 42 * m.scale

  ctx.save()
  ctx.globalAlpha = fade
  ctx.translate(bx, by)
  ctx.scale(bounce, bounce)

  // Comic bubble
  ctx.beginPath()
  roundRectPath(ctx, -36, -22, 72, 36, 12)
  ctx.fillStyle = '#fff7ed'
  ctx.fill()
  ctx.strokeStyle = '#ea580c'
  ctx.lineWidth = 2.4
  ctx.stroke()

  // Tail toward character
  ctx.beginPath()
  ctx.moveTo(-6, 12)
  ctx.lineTo(-2, 22)
  ctx.lineTo(8, 12)
  ctx.closePath()
  ctx.fillStyle = '#fff7ed'
  ctx.fill()
  ctx.strokeStyle = '#ea580c'
  ctx.lineWidth = 2.2
  ctx.stroke()
  // Cover stroke seam
  ctx.fillStyle = '#fff7ed'
  ctx.fillRect(-5, 10, 12, 4)

  ctx.fillStyle = '#c2410c'
  ctx.font = 'bold 16px "Segoe UI", "PingFang SC", "Hiragino Sans", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Ki Ki！', 0, -2)

  ctx.restore()
}

/** Top-of-tank subtitle banner while alert is active. */
export function drawKikiBanner(ctx: CanvasRenderingContext2D, width: number, m: Monster) {
  if (m.alertLeft <= 0) return
  const fade = Math.min(1, m.alertLeft / 0.4)
  const pulse = 0.92 + 0.08 * Math.sin(m.age * 12)
  ctx.save()
  ctx.globalAlpha = fade * pulse
  const w = 160
  const h = 28
  const x = (width - w) / 2
  const y = 14
  roundRectPath(ctx, x, y, w, h, 8)
  ctx.fillStyle = 'rgba(234, 88, 12, 0.92)'
  ctx.fill()
  ctx.fillStyle = '#fff7ed'
  ctx.font = 'bold 15px "Segoe UI", "PingFang SC", "Hiragino Sans", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('⚠ Ki Ki！', width / 2, y + h / 2 + 0.5)
  ctx.restore()
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}
