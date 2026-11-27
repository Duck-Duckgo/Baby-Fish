/** Cartoon seabed town: original homage characters and landmarks (no logos). */

const TAU = Math.PI * 2

export type TownCharacterKind = 'sponge' | 'star' | 'tentacle' | 'crab'
export type TownBuildingKind = 'pineapple' | 'burger-stand'

export interface TownBuilding {
  kind: TownBuildingKind
  x: number
  scale: number
}

export interface TownCharacter {
  kind: TownCharacterKind
  name: string
  x: number
  y: number
  facing: 1 | -1
  speed: number
  phase: number
  bobPhase: number
  wanderTimer: number
  targetX: number
  scale: number
}

export interface TownState {
  buildings: TownBuilding[]
  characters: TownCharacter[]
}

const NAMES: Record<TownCharacterKind, string> = {
  sponge: '方块海绵',
  star: '粉星',
  tentacle: '触手管家',
  crab: '红蟹掌柜',
}

export function createTown(width: number, sandTop: (x: number) => number, scale: number): TownState {
  const s = Math.max(0.7, Math.min(1.35, scale))
  const left = width * 0.16
  const right = width * 0.78

  const buildings: TownBuilding[] = [
    { kind: 'pineapple', x: left, scale: s * 1.05 },
    { kind: 'burger-stand', x: right, scale: s * 1.0 },
  ]

  const kinds: TownCharacterKind[] = ['sponge', 'star', 'tentacle', 'crab']
  const characters: TownCharacter[] = kinds.map((kind, i) => {
    const x = width * (0.28 + i * 0.14)
    return {
      kind,
      name: NAMES[kind],
      x,
      y: sandTop(x),
      facing: i % 2 === 0 ? 1 : -1,
      speed: (18 + i * 4) * s,
      phase: Math.random() * TAU,
      bobPhase: Math.random() * TAU,
      wanderTimer: 1 + Math.random() * 2,
      targetX: x,
      scale: s,
    }
  })

  return { buildings, characters }
}

export function updateTown(
  town: TownState,
  dt: number,
  width: number,
  sandTop: (x: number) => number,
  time: number,
) {
  const margin = Math.max(40, width * 0.08)
  const left = margin
  const right = Math.max(left + 20, width - margin)

  for (const c of town.characters) {
    c.phase += dt * 6
    c.wanderTimer -= dt
    if (c.wanderTimer <= 0 || Math.abs(c.x - c.targetX) < 6) {
      c.targetX = left + Math.random() * (right - left)
      c.wanderTimer = 2.5 + Math.random() * 4
    }

    const dir = Math.sign(c.targetX - c.x) || c.facing
    c.facing = dir < 0 ? -1 : 1
    c.x += dir * c.speed * dt
    c.x = Math.min(right, Math.max(left, c.x))
    c.y = sandTop(c.x) - 2 + Math.sin(time * 2.2 + c.bobPhase) * 1.2
  }
}

export function drawTownBuildings(ctx: CanvasRenderingContext2D, town: TownState, sandTop: (x: number) => number) {
  for (const b of town.buildings) {
    const y = sandTop(b.x)
    ctx.save()
    ctx.translate(b.x, y)
    ctx.scale(b.scale, b.scale)
    if (b.kind === 'pineapple') drawPineappleHouse(ctx)
    else drawBurgerStand(ctx)
    ctx.restore()
  }
}

export function drawTownCharacters(ctx: CanvasRenderingContext2D, town: TownState) {
  const ordered = [...town.characters].sort((a, b) => a.y - b.y)
  for (const c of ordered) {
    ctx.save()
    ctx.translate(c.x, c.y)
    ctx.scale(c.facing * c.scale, c.scale)
    if (c.kind === 'sponge') drawSponge(ctx, c.phase)
    else if (c.kind === 'star') drawStar(ctx, c.phase)
    else if (c.kind === 'tentacle') drawTentacle(ctx, c.phase)
    else drawCrab(ctx, c.phase)
    ctx.restore()
  }
}

function drawPineappleHouse(ctx: CanvasRenderingContext2D) {
  // Leaf crown
  ctx.fillStyle = '#2f9e3a'
  for (const [dx, rot, h] of [
    [-10, -0.45, 34],
    [0, 0, 40],
    [10, 0.45, 34],
    [-4, -0.2, 28],
    [4, 0.2, 28],
  ] as const) {
    ctx.save()
    ctx.translate(dx, -78)
    ctx.rotate(rot)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(6, -h * 0.45, 0, -h)
    ctx.quadraticCurveTo(-6, -h * 0.45, 0, 0)
    ctx.fill()
    ctx.restore()
  }

  // Body
  const body = ctx.createLinearGradient(0, -72, 0, 0)
  body.addColorStop(0, '#f6c84c')
  body.addColorStop(1, '#d97706')
  roundRect(ctx, -28, -72, 56, 72, 18)
  ctx.fillStyle = body
  ctx.fill()

  // Diamond texture
  ctx.strokeStyle = 'rgba(146, 64, 14, 0.35)'
  ctx.lineWidth = 1.2
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      const x = -16 + col * 16 + (row % 2) * 8
      const y = -62 + row * 12
      ctx.strokeRect(x, y, 10, 10)
    }
  }

  // Window + door
  ctx.fillStyle = '#7dd3fc'
  roundRect(ctx, -8, -52, 16, 14, 4)
  ctx.fill()
  ctx.strokeStyle = '#0e7490'
  ctx.stroke()

  ctx.fillStyle = '#7c2d12'
  roundRect(ctx, -9, -22, 18, 22, 4)
  ctx.fill()
  ctx.fillStyle = '#fbbf24'
  ctx.beginPath()
  ctx.arc(5, -11, 2, 0, TAU)
  ctx.fill()
}

function drawBurgerStand(ctx: CanvasRenderingContext2D) {
  // Roof (boat-like hull, no lettering)
  ctx.fillStyle = '#b91c1c'
  ctx.beginPath()
  ctx.moveTo(-46, -58)
  ctx.quadraticCurveTo(0, -78, 46, -58)
  ctx.lineTo(40, -42)
  ctx.lineTo(-40, -42)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#f8fafc'
  ctx.beginPath()
  ctx.moveTo(-34, -56)
  ctx.quadraticCurveTo(0, -68, 34, -56)
  ctx.lineTo(30, -46)
  ctx.lineTo(-30, -46)
  ctx.closePath()
  ctx.fill()

  // Cabin
  ctx.fillStyle = '#fef3c7'
  roundRect(ctx, -36, -42, 72, 42, 6)
  ctx.fill()
  ctx.strokeStyle = '#92400e'
  ctx.lineWidth = 1.4
  ctx.stroke()

  // Counter window
  ctx.fillStyle = '#38bdf8'
  roundRect(ctx, -22, -34, 44, 18, 4)
  ctx.fill()

  // Chimney puff
  ctx.fillStyle = '#78716c'
  roundRect(ctx, 22, -70, 10, 16, 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.arc(30, -78, 6, 0, TAU)
  ctx.arc(36, -84, 4, 0, TAU)
  ctx.fill()

  // Sign board with a simple burger doodle (no brand text)
  ctx.fillStyle = '#f59e0b'
  roundRect(ctx, -18, -88, 36, 16, 4)
  ctx.fill()
  ctx.fillStyle = '#7c2d12'
  ctx.beginPath()
  ctx.ellipse(0, -82, 10, 4, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#22c55e'
  ctx.fillRect(-8, -83, 16, 2)
  ctx.fillStyle = '#fef3c7'
  ctx.beginPath()
  ctx.ellipse(0, -79, 10, 3.5, 0, 0, TAU)
  ctx.fill()
}

function drawSponge(ctx: CanvasRenderingContext2D, phase: number) {
  const bounce = Math.abs(Math.sin(phase)) * 2
  ctx.translate(0, -bounce)

  // Legs
  ctx.strokeStyle = '#b45309'
  ctx.lineWidth = 3.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-7, -6)
  ctx.lineTo(-9, 2 + Math.sin(phase) * 2)
  ctx.moveTo(7, -6)
  ctx.lineTo(9, 2 + Math.sin(phase + 1) * 2)
  ctx.stroke()

  // Arms
  ctx.beginPath()
  ctx.moveTo(-14, -22)
  ctx.lineTo(-22, -14 + Math.sin(phase) * 3)
  ctx.moveTo(14, -22)
  ctx.lineTo(22, -16 + Math.cos(phase) * 3)
  ctx.stroke()

  // Body
  roundRect(ctx, -14, -40, 28, 34, 5)
  ctx.fillStyle = '#facc15'
  ctx.fill()
  ctx.strokeStyle = '#ca8a04'
  ctx.lineWidth = 1.4
  ctx.stroke()

  // Pores
  ctx.fillStyle = '#eab308'
  for (const [x, y, r] of [
    [-6, -30, 2.2],
    [5, -28, 1.8],
    [-2, -18, 2.4],
    [7, -16, 1.6],
  ] as const) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.fill()
  }

  // Eyes
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(-5, -28, 4.2, 0, TAU)
  ctx.arc(5, -28, 4.2, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.arc(-4, -28, 1.6, 0, TAU)
  ctx.arc(6, -28, 1.6, 0, TAU)
  ctx.fill()

  // Smile
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.arc(0, -20, 5, 0.15, Math.PI - 0.15)
  ctx.stroke()

  // Shorts
  ctx.fillStyle = '#b45309'
  roundRect(ctx, -14, -12, 28, 8, 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.fillRect(-14, -12, 28, 2.2)
}

function drawStar(ctx: CanvasRenderingContext2D, phase: number) {
  const wiggle = Math.sin(phase) * 0.08
  ctx.rotate(wiggle)

  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 5
    const b = a + TAU / 10
    ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18 - 16)
    ctx.lineTo(Math.cos(b) * 8, Math.sin(b) * 8 - 16)
  }
  ctx.closePath()
  ctx.fillStyle = '#fb7185'
  ctx.fill()
  ctx.strokeStyle = '#be123c'
  ctx.lineWidth = 1.3
  ctx.stroke()

  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(-4, -20, 3.2, 0, TAU)
  ctx.arc(4, -20, 3.2, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.arc(-3.2, -20, 1.3, 0, TAU)
  ctx.arc(4.8, -20, 1.3, 0, TAU)
  ctx.fill()

  ctx.strokeStyle = '#0f172a'
  ctx.beginPath()
  ctx.moveTo(-3, -13)
  ctx.quadraticCurveTo(0, -10, 3, -13)
  ctx.stroke()
}

function drawTentacle(ctx: CanvasRenderingContext2D, phase: number) {
  // Legs / tentacles
  ctx.strokeStyle = '#15803d'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  for (let i = 0; i < 4; i++) {
    const sway = Math.sin(phase + i) * 4
    ctx.beginPath()
    ctx.moveTo(-8 + i * 5, -10)
    ctx.quadraticCurveTo(-10 + i * 5 + sway, 2, -12 + i * 5 + sway * 1.2, 10)
    ctx.stroke()
  }

  // Body
  ctx.fillStyle = '#22c55e'
  ctx.beginPath()
  ctx.ellipse(0, -28, 16, 20, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#166534'
  ctx.lineWidth = 1.4
  ctx.stroke()

  // Nose
  ctx.fillStyle = '#86efac'
  ctx.beginPath()
  ctx.ellipse(10, -28, 8, 5, 0.2, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#166534'
  ctx.stroke()

  // Eyes
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(-4, -34, 4, 0, TAU)
  ctx.arc(3, -34, 4, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.arc(-3, -34, 1.5, 0, TAU)
  ctx.arc(4, -34, 1.5, 0, TAU)
  ctx.fill()

  // Shirt
  ctx.fillStyle = '#38bdf8'
  roundRect(ctx, -12, -18, 24, 10, 3)
  ctx.fill()
}

function drawCrab(ctx: CanvasRenderingContext2D, phase: number) {
  const pinch = Math.sin(phase) * 0.25

  // Legs
  ctx.strokeStyle = '#b91c1c'
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(side * 8, -10)
      ctx.lineTo(side * (14 + i * 2), -2 + i + Math.sin(phase + i) * 1.5)
      ctx.stroke()
    }
  }

  // Claws
  for (const side of [-1, 1] as const) {
    ctx.save()
    ctx.translate(side * 16, -18)
    ctx.rotate(side * (0.4 + pinch))
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.ellipse(0, 0, 7, 5, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#fecaca'
    ctx.beginPath()
    ctx.moveTo(2, -2)
    ctx.lineTo(10, -6)
    ctx.lineTo(9, 1)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // Body
  ctx.fillStyle = '#dc2626'
  ctx.beginPath()
  ctx.ellipse(0, -16, 14, 10, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#7f1d1d'
  ctx.lineWidth = 1.3
  ctx.stroke()

  // Eyes on stalks
  ctx.strokeStyle = '#7f1d1d'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-5, -22)
  ctx.lineTo(-6, -30)
  ctx.moveTo(5, -22)
  ctx.lineTo(6, -30)
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(-6, -31, 3.2, 0, TAU)
  ctx.arc(6, -31, 3.2, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.arc(-5.2, -31, 1.3, 0, TAU)
  ctx.arc(6.8, -31, 1.3, 0, TAU)
  ctx.fill()

  // Tiny nose
  ctx.fillStyle = '#fecaca'
  ctx.beginPath()
  ctx.arc(0, -15, 2.2, 0, TAU)
  ctx.fill()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}
