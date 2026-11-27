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
      // Slightly larger so the homage silhouettes read clearly on the sand.
      scale: s * 1.25,
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
  const bounce = Math.abs(Math.sin(phase)) * 2.4
  ctx.translate(0, -bounce)

  // Shoes + socks
  ctx.fillStyle = '#111827'
  roundRect(ctx, -12, 0, 8, 4, 1.5)
  roundRect(ctx, 4, 0, 8, 4, 1.5)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.fillRect(-11, -3, 6, 3.5)
  ctx.fillRect(5, -3, 6, 3.5)

  // Legs
  ctx.strokeStyle = '#facc15'
  ctx.lineWidth = 3.4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-7, -10)
  ctx.lineTo(-8, -2 + Math.sin(phase) * 1.5)
  ctx.moveTo(7, -10)
  ctx.lineTo(8, -2 + Math.sin(phase + 1) * 1.5)
  ctx.stroke()

  // Square pants (brown with black belt)
  ctx.fillStyle = '#a16207'
  roundRect(ctx, -16, -16, 32, 10, 2)
  ctx.fill()
  ctx.fillStyle = '#111827'
  ctx.fillRect(-16, -16, 32, 2.4)
  // Belt buckle
  ctx.fillStyle = '#fbbf24'
  roundRect(ctx, -3, -16.5, 6, 3.2, 1)
  ctx.fill()

  // White shirt collar strip
  ctx.fillStyle = '#fff'
  ctx.fillRect(-16, -19, 32, 3.2)

  // Arms
  ctx.strokeStyle = '#facc15'
  ctx.lineWidth = 3.2
  ctx.beginPath()
  ctx.moveTo(-16, -28)
  ctx.lineTo(-24, -18 + Math.sin(phase) * 3)
  ctx.moveTo(16, -28)
  ctx.lineTo(24, -20 + Math.cos(phase) * 3)
  ctx.stroke()
  // Cuffs
  ctx.fillStyle = '#fff'
  roundRect(ctx, -27, -20 + Math.sin(phase) * 3, 6, 3, 1)
  roundRect(ctx, 21, -22 + Math.cos(phase) * 3, 6, 3, 1)
  ctx.fill()

  // Body square
  roundRect(ctx, -16, -46, 32, 28, 4)
  ctx.fillStyle = '#fde047'
  ctx.fill()
  ctx.strokeStyle = '#ca8a04'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Pores
  ctx.fillStyle = '#eab308'
  for (const [x, y, r] of [
    [-9, -40, 2.4],
    [8, -38, 2],
    [-4, -30, 2.6],
    [10, -28, 1.8],
    [-11, -24, 1.6],
    [3, -22, 2.1],
  ] as const) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.fill()
  }

  // Red necktie
  ctx.fillStyle = '#dc2626'
  ctx.beginPath()
  ctx.moveTo(0, -19)
  ctx.lineTo(-3.5, -16)
  ctx.lineTo(0, -8)
  ctx.lineTo(3.5, -16)
  ctx.closePath()
  ctx.fill()

  // Eyes with lashes
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(-5.5, -34, 5.2, 0, TAU)
  ctx.arc(5.5, -34, 5.2, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.fillStyle = '#111827'
  ctx.beginPath()
  ctx.arc(-4.2, -34, 2, 0, TAU)
  ctx.arc(6.8, -34, 2, 0, TAU)
  ctx.fill()
  // Lashes
  ctx.beginPath()
  ctx.moveTo(-9, -38)
  ctx.lineTo(-11, -41)
  ctx.moveTo(-5.5, -39.5)
  ctx.lineTo(-5.5, -43)
  ctx.moveTo(-2, -38)
  ctx.lineTo(0, -41)
  ctx.moveTo(2, -38)
  ctx.lineTo(0.5, -41)
  ctx.moveTo(5.5, -39.5)
  ctx.lineTo(5.5, -43)
  ctx.moveTo(9, -38)
  ctx.lineTo(11, -41)
  ctx.stroke()

  // Freckles + smile + buck teeth
  ctx.fillStyle = '#b45309'
  for (const [x, y] of [
    [-8, -26],
    [-5, -24],
    [6, -26],
    [9, -24],
  ] as const) {
    ctx.beginPath()
    ctx.arc(x, y, 1.1, 0, TAU)
    ctx.fill()
  }
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(0, -25, 6.5, 0.15, Math.PI - 0.15)
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.fillRect(-3.2, -24.5, 3, 3.2)
  ctx.fillRect(0.2, -24.5, 3, 3.2)
  ctx.strokeStyle = '#111827'
  ctx.strokeRect(-3.2, -24.5, 3, 3.2)
  ctx.strokeRect(0.2, -24.5, 3, 3.2)
}

function drawStar(ctx: CanvasRenderingContext2D, phase: number) {
  const wiggle = Math.sin(phase) * 0.1
  ctx.rotate(wiggle)

  // Soft chubby star body (less pointy = more Patrick-like)
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 5
    const b = a + TAU / 10
    ctx.lineTo(Math.cos(a) * 20, Math.sin(a) * 18 - 18)
    ctx.lineTo(Math.cos(b) * 10, Math.sin(b) * 9 - 18)
  }
  ctx.closePath()
  ctx.fillStyle = '#fb7185'
  ctx.fill()
  ctx.strokeStyle = '#be123c'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Belly highlight
  ctx.fillStyle = '#fda4af'
  ctx.beginPath()
  ctx.ellipse(0, -14, 8, 6, 0, 0, TAU)
  ctx.fill()

  // Flower shorts
  ctx.fillStyle = '#22c55e'
  ctx.beginPath()
  ctx.moveTo(-10, -12)
  ctx.quadraticCurveTo(0, -6, 10, -12)
  ctx.lineTo(9, -2)
  ctx.quadraticCurveTo(0, 2, -9, -2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#f472b6'
  for (const [x, y] of [
    [-4, -7],
    [3, -5],
    [-1, -3],
  ] as const) {
    ctx.beginPath()
    ctx.arc(x, y, 1.6, 0, TAU)
    ctx.fill()
  }

  // Face
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(-5, -22, 3.6, 0, TAU)
  ctx.arc(5, -22, 3.6, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#111827'
  ctx.beginPath()
  ctx.arc(-4, -22, 1.5, 0, TAU)
  ctx.arc(6, -22, 1.5, 0, TAU)
  ctx.fill()
  // Eyebrows
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(-8, -27)
  ctx.lineTo(-2, -26)
  ctx.moveTo(2, -26)
  ctx.lineTo(8, -27)
  ctx.stroke()
  // Smile
  ctx.beginPath()
  ctx.arc(0, -16, 4.5, 0.2, Math.PI - 0.2)
  ctx.stroke()
}

function drawTentacle(ctx: CanvasRenderingContext2D, phase: number) {
  // Four walking tentacles
  ctx.strokeStyle = '#4d7c0f'
  ctx.lineWidth = 4.2
  ctx.lineCap = 'round'
  for (let i = 0; i < 4; i++) {
    const sway = Math.sin(phase + i * 0.9) * 5
    const x0 = -9 + i * 6
    ctx.beginPath()
    ctx.moveTo(x0, -12)
    ctx.quadraticCurveTo(x0 - 2 + sway, 2, x0 - 4 + sway * 1.3, 12)
    ctx.stroke()
  }

  // Tall forehead head
  ctx.fillStyle = '#65a30d'
  ctx.beginPath()
  ctx.moveTo(-14, -18)
  ctx.bezierCurveTo(-16, -52, 16, -52, 14, -18)
  ctx.quadraticCurveTo(0, -14, -14, -18)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#3f6212'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Big nose
  ctx.fillStyle = '#a3e635'
  ctx.beginPath()
  ctx.ellipse(11, -30, 9, 5.5, 0.15, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#3f6212'
  ctx.stroke()

  // Eyes
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.ellipse(-4, -36, 4.5, 5, 0, 0, TAU)
  ctx.ellipse(4, -36, 4.5, 5, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#111827'
  ctx.beginPath()
  ctx.arc(-3, -36, 1.7, 0, TAU)
  ctx.arc(5, -36, 1.7, 0, TAU)
  ctx.fill()

  // Unimpressed brows
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(-9, -42)
  ctx.lineTo(-1, -40)
  ctx.moveTo(1, -40)
  ctx.lineTo(9, -42)
  ctx.stroke()

  // Mouth
  ctx.beginPath()
  ctx.moveTo(-4, -24)
  ctx.quadraticCurveTo(0, -22, 4, -24)
  ctx.stroke()

  // Turquoise shirt + collar
  ctx.fillStyle = '#2dd4bf'
  roundRect(ctx, -13, -18, 26, 12, 3)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(-4, -18)
  ctx.lineTo(0, -13)
  ctx.lineTo(4, -18)
  ctx.fill()
}

function drawCrab(ctx: CanvasRenderingContext2D, phase: number) {
  const pinch = Math.sin(phase) * 0.3

  // Legs
  ctx.strokeStyle = '#b91c1c'
  ctx.lineWidth = 2.6
  ctx.lineCap = 'round'
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(side * 9, -12)
      ctx.lineTo(side * (16 + i * 2.5), -1 + i + Math.sin(phase + i) * 1.8)
      ctx.stroke()
    }
  }

  // Big claws
  for (const side of [-1, 1] as const) {
    ctx.save()
    ctx.translate(side * 18, -22)
    ctx.rotate(side * (0.35 + pinch))
    ctx.fillStyle = '#dc2626'
    ctx.beginPath()
    ctx.ellipse(0, 0, 9, 6.5, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#fecaca'
    ctx.beginPath()
    ctx.moveTo(3, -3)
    ctx.lineTo(14, -8)
    ctx.quadraticCurveTo(16, 0, 12, 6)
    ctx.lineTo(3, 3)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#7f1d1d'
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.restore()
  }

  // Blue collar shirt
  ctx.fillStyle = '#1d4ed8'
  roundRect(ctx, -12, -20, 24, 10, 3)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(-5, -20)
  ctx.lineTo(0, -15)
  ctx.lineTo(5, -20)
  ctx.fill()

  // Round red body
  ctx.fillStyle = '#ef4444'
  ctx.beginPath()
  ctx.ellipse(0, -26, 15, 12, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#7f1d1d'
  ctx.lineWidth = 1.4
  ctx.stroke()

  // Tall eyestalks
  ctx.strokeStyle = '#b91c1c'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(-5, -34)
  ctx.lineTo(-7, -46)
  ctx.moveTo(5, -34)
  ctx.lineTo(7, -46)
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(-7, -48, 4, 0, TAU)
  ctx.arc(7, -48, 4, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1.1
  ctx.stroke()
  ctx.fillStyle = '#111827'
  ctx.beginPath()
  ctx.arc(-6, -48, 1.7, 0, TAU)
  ctx.arc(8, -48, 1.7, 0, TAU)
  ctx.fill()

  // Nose + smile
  ctx.fillStyle = '#fecaca'
  ctx.beginPath()
  ctx.ellipse(0, -24, 3.2, 2.4, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#7f1d1d'
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.arc(0, -20, 5, 0.15, Math.PI - 0.15)
  ctx.stroke()
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
