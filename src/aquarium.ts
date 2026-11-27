import { SPECIES, type FishPose, type Species, type SwimStyle, type Zone } from './species.ts'
import {
  createMonster,
  drawKikiBanner,
  drawMonster,
  monsterGone,
  playKikiAlert,
  updateMonster,
  type Monster,
} from './monster.ts'
import {
  createTown,
  drawTownBuildings,
  drawTownCharacters,
  updateTown,
  type TownState,
} from './town.ts'
import {
  createVisitor,
  drawVisitor,
  updateVisitor,
  visitorGone,
  visitorReach,
  type Visitor,
  type VisitorKind,
} from './visitors.ts'

/** Pellets one fish must eat before the next +5% length bump. */
export const MEALS_PER_GROWTH = 10
/** Length multiplier applied on each growth bump. */
export const GROWTH_STEP = 1.05
/** Cap relative to the fish's birth length. */
export const MAX_GROWTH_FACTOR = 3

export interface AquariumStats {
  fish: number
  species: number
  eaten: number
}

export interface AquariumOptions {
  reducedMotion: boolean
  onStatsChange?: (stats: AquariumStats) => void
}

interface Fish {
  species: Species
  x: number
  y: number
  vx: number
  vy: number
  /** Current body length used for drawing and physics. */
  length: number
  /** Length at birth; growth is capped at birthLength * MAX_GROWTH_FACTOR. */
  birthLength: number
  maxLength: number
  /** Pellets this individual has eaten (drives per-fish growth). */
  meals: number
  cruise: number
  tailPhase: number
  facing: number
  flip: number
  pitch: number
  targetX: number
  targetY: number
  wanderTimer: number
  restTimer: number
  burstTimer: number
  bursting: boolean
  puff: number
  puffTarget: number
  puffTimer: number
  bobPhase: number
}

interface Bounds {
  left: number
  right: number
  top: number
  bottom: number
}

interface Pellet {
  x: number
  y: number
  vy: number
  phase: number
  landed: boolean
  restTime: number
}

interface Bubble {
  x: number
  y: number
  r: number
  speed: number
  phase: number
  drift: number
}

interface Ripple {
  x: number
  y: number
  age: number
}

interface Weed {
  x: number
  height: number
  width: number
  phase: number
  speed: number
  color: string
  front: boolean
}

interface Pebble {
  x: number
  y: number
  rx: number
  ry: number
  color: string
}

type DecorKind = 'pearl' | 'shell' | 'coral' | 'star'

interface SandDecor {
  kind: DecorKind
  x: number
  y: number
  scale: number
  rot: number
  color: string
  accent: string
  variant: number
}

export const MAX_FISH = 30

const MAX_PELLETS = 80
const MAX_BUBBLES = 240
const PELLET_REST_SECONDS = 8
const RIPPLE_SECONDS = 0.7
const TAU = Math.PI * 2

// Depth bands as fractions of the swimmable height, from the surface down.
const ZONE_BANDS: Record<Exclude<Zone, 'floor'>, [number, number]> = {
  surface: [0, 0.16],
  upper: [0, 0.45],
  middle: [0.2, 0.75],
  lower: [0.5, 1],
  any: [0, 1],
}

const AGILITY: Record<SwimStyle, number> = {
  cruise: 1,
  glide: 0.55,
  hover: 0.9,
  dart: 1.6,
  eel: 0.7,
  bottom: 0.8,
}

const WEED_COLORS = ['#2f9e6e', '#3bb27c', '#25875c', '#4cc38a']
const PEBBLE_COLORS = ['#c9a974', '#b8956a', '#e2cda0', '#a88a64']

const rand = (min: number, max: number) => min + Math.random() * (max - min)
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

// Scenery uses a fixed seed so the seaweed doesn't jump around every time the window resizes.
function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Aquarium {
  private readonly ctx: CanvasRenderingContext2D
  private readonly reducedMotion: boolean
  private readonly onStatsChange?: (stats: AquariumStats) => void

  private width = 0
  private height = 0
  private time = 0
  private eaten = 0
  private bubbleTimer = 0
  private visitorTimer = rand(6, 11)
  private lastVisitor: VisitorKind | null = null
  private monsterTimer = rand(16, 22)
  private labels = false

  private fish: Fish[] = []
  private pellets: Pellet[] = []
  private bubbles: Bubble[] = []
  private ripples: Ripple[] = []
  private visitors: Visitor[] = []
  private monster: Monster | null = null
  private weeds: Weed[] = []
  private pebbles: Pebble[] = []
  private decors: SandDecor[] = []
  private town: TownState = { buildings: [], characters: [] }

  private waterFill: CanvasGradient | null = null
  private sandFill: CanvasGradient | null = null
  private rayFill: CanvasGradient | null = null

  private readonly pose: FishPose = { wag: 0, phase: 0, time: 0, speed: 0, puff: 0, px: 1 }

  constructor(ctx: CanvasRenderingContext2D, options: AquariumOptions) {
    this.ctx = ctx
    this.reducedMotion = options.reducedMotion
    this.onStatsChange = options.onStatsChange
  }

  get fishCount() {
    return this.fish.length
  }

  get speciesCount() {
    return new Set(this.fish.map((f) => f.species.id)).size
  }

  get activeVisitors(): readonly Visitor[] {
    return this.visitors
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height

    const { ctx } = this
    this.waterFill = ctx.createLinearGradient(0, 0, 0, height)
    this.waterFill.addColorStop(0, '#46c9d1')
    this.waterFill.addColorStop(0.45, '#1a8db0')
    this.waterFill.addColorStop(1, '#0b4a6e')

    this.sandFill = ctx.createLinearGradient(0, this.sandBase - 10, 0, height)
    this.sandFill.addColorStop(0, '#f3e2b3')
    this.sandFill.addColorStop(1, '#d6b47a')

    this.rayFill = ctx.createLinearGradient(0, 0, 0, height * 0.85)
    this.rayFill.addColorStop(0, 'rgba(255, 255, 255, 0.13)')
    this.rayFill.addColorStop(1, 'rgba(255, 255, 255, 0)')

    this.buildScenery()

    for (const f of this.fish) {
      const bounds = this.swimBounds(f)
      f.x = clamp(f.x, bounds.left, bounds.right)
      f.y = f.species.zone === 'floor' ? this.floorY(f, f.x) : clamp(f.y, bounds.top, bounds.bottom)
      this.pickWanderTarget(f)
    }
    for (const p of this.pellets) {
      p.x = clamp(p.x, 0, width)
      p.y = Math.min(p.y, this.sandTop(p.x) - 2)
    }
    for (const v of this.visitors) v.baseY = clamp(v.baseY, 30, Math.max(30, this.sandBase - 40))
    this.layoutTown()
  }

  /** Adds up to `count` fish, each of a different species, spread around the tank. */
  populate(count: number) {
    for (let i = 0; i < count; i++) this.addFish(false)
  }

  /** Lines every species up in a grid and holds them still, for reviewing silhouettes. */
  showcase() {
    this.fish = []
    this.visitors = []
    this.pellets = []
    this.monster = null
    this.visitorTimer = 1e9
    this.monsterTimer = 1e9
    this.labels = true
    for (const species of SPECIES) this.addFish(false, species)

    const cols = 5
    const rows = Math.ceil(this.fish.length / cols)
    const colW = this.width / cols
    const rowH = Math.max(40, (this.sandBase - 28) / rows)
    for (let i = 0; i < this.fish.length; i++) {
      const f = this.fish[i]
      const fit = Math.min(colW * 0.78, rowH * 0.72)
      f.length = fit / Math.max(1, f.species.halfHeight * 2)
      f.birthLength = f.length
      f.maxLength = f.birthLength * MAX_GROWTH_FACTOR
      f.meals = 0
      f.x = colW * ((i % cols) + 0.5)
      f.y = 20 + rowH * (Math.floor(i / cols) + 0.5)
      f.vx = 0
      f.vy = 0
      f.facing = 1
      f.flip = 1
      f.pitch = 0
      f.restTimer = 1e9
      f.wanderTimer = 1e9
      f.targetX = f.x
      f.targetY = f.y
    }
    this.emitStats()
  }

  /** Returns the species that was added, or null when the tank is full. */
  addFish(fromEdge = true, species?: Species): Species | null {
    if (this.width === 0 || this.fish.length >= MAX_FISH) return null

    const kind = species ?? this.pickSpecies()
    const scale = this.fishScale
    const length = rand(kind.size[0], kind.size[1]) * scale
    const cruise = rand(kind.speed[0], kind.speed[1]) * scale
    const direction = Math.random() < 0.5 ? 1 : -1
    const fish: Fish = {
      species: kind,
      x: 0,
      y: 0,
      vx: direction * cruise,
      vy: 0,
      length,
      birthLength: length,
      maxLength: length * MAX_GROWTH_FACTOR,
      meals: 0,
      cruise,
      tailPhase: rand(0, TAU),
      facing: direction,
      flip: direction,
      pitch: 0,
      targetX: 0,
      targetY: 0,
      wanderTimer: 0,
      restTimer: 0,
      burstTimer: rand(0, 1),
      bursting: false,
      puff: 0,
      puffTarget: 0,
      puffTimer: rand(4, 12),
      bobPhase: rand(0, TAU),
    }

    const bounds = this.swimBounds(fish)
    fish.x = fromEdge ? (direction === 1 ? -length * 0.6 : this.width + length * 0.6) : rand(bounds.left, bounds.right)
    fish.y = kind.zone === 'floor' ? this.floorY(fish, clamp(fish.x, 0, this.width)) : this.zoneY(fish, bounds)

    this.pickWanderTarget(fish)
    this.fish.push(fish)
    this.emitStats()
    return kind
  }

  sprinkle(x: number, y: number, count = 6) {
    if (this.width === 0) return

    const startY = clamp(y, 10, this.sandTop(x) - 12)
    for (let i = 0; i < count; i++) {
      this.pellets.push({
        x: clamp(x + rand(-14, 14), 6, this.width - 6),
        y: startY + rand(-6, 6),
        vy: rand(22, 36),
        phase: rand(0, TAU),
        landed: false,
        restTime: 0,
      })
    }
    if (this.pellets.length > MAX_PELLETS) {
      this.pellets.splice(0, this.pellets.length - MAX_PELLETS)
    }
    this.ripples.push({ x, y: startY, age: 0 })
  }

  sprinkleSomewhere() {
    this.sprinkle(rand(this.width * 0.3, this.width * 0.85), rand(24, 60), 8)
  }

  /** Sends a submarine or diver across the tank right away. */
  spawnVisitor(kind?: VisitorKind): Visitor | null {
    if (this.width === 0) return null

    const next = kind ?? this.nextVisitorKind()
    const visitor = createVisitor(next, this.width, 30, Math.max(40, this.sandBase - 40), this.fishScale)
    this.visitors.push(visitor)
    this.lastVisitor = next
    return visitor
  }

  /** Spawns the round-faced hunter immediately (used by `?monster` preview). */
  spawnMonsterNow(): Monster | null {
    if (this.width === 0) return null
    this.monster = createMonster(this.width, this.height, this.sandBase, this.fishScale)
    this.monsterTimer = 1e9
    playKikiAlert()
    return this.monster
  }

  update(dt: number) {
    if (this.width === 0) return

    const step = this.reducedMotion ? dt * 0.6 : dt
    this.time += step
    this.updatePellets(step)
    this.updateVisitors(step)
    this.updateMonster(step)
    updateTown(this.town, step, this.width, (x) => this.sandTop(x), this.time)
    if (this.labels) {
      for (const f of this.fish) f.tailPhase += step * TAU * f.species.tailHz * 0.45
    } else {
      this.updateFish(step)
    }
    this.updateBubbles(step)
    this.updateRipples(dt)
  }

  render() {
    const { ctx, width, height } = this
    if (width === 0 || !this.waterFill) return

    ctx.fillStyle = this.waterFill
    ctx.fillRect(0, 0, width, height)

    this.drawRays()
    this.drawSurface()
    for (const weed of this.weeds) if (!weed.front) this.drawWeed(weed)
    this.drawSand()
    this.drawDecors()
    drawTownBuildings(ctx, this.town, (x) => this.sandTop(x))
    drawTownCharacters(ctx, this.town)
    for (const v of this.visitors) drawVisitor(ctx, v)
    this.drawPellets()

    const ordered = [...this.fish].sort((a, b) => this.depthOrder(a) - this.depthOrder(b))
    for (const f of ordered) this.drawFish(f)
    if (this.labels) this.drawLabels()
    if (this.monster) {
      drawMonster(ctx, this.monster)
      drawKikiBanner(ctx, width, this.monster)
    }

    for (const weed of this.weeds) if (weed.front) this.drawWeed(weed)
    this.drawBubbles()
    this.drawRipples()
  }

  private get sandHeight() {
    return clamp(this.height * 0.11, 44, 96)
  }

  private get sandBase() {
    return this.height - this.sandHeight
  }

  private get stoneX() {
    // Sit between the pineapple house and crab stand so the bubble rock isn't buried.
    return this.width * 0.5
  }

  private get fishScale() {
    return clamp(Math.min(this.width, this.height) / 700, 0.65, 1.4)
  }

  private sandTop(x: number) {
    return this.sandBase + Math.sin(x * 0.011) * 5 + Math.sin(x * 0.027 + 1.3) * 3
  }

  private swimBounds(f: Fish): Bounds {
    const half = f.length * f.species.halfHeight
    const margin = Math.min(f.length * 0.6, this.width * 0.25)
    const top = 24 + half
    return {
      left: margin,
      right: Math.max(margin, this.width - margin),
      top,
      bottom: Math.max(top, this.sandBase - half - 14),
    }
  }

  private floorY(f: Fish, x: number) {
    return this.sandTop(x) - f.length * (f.species.floor ?? f.species.halfHeight)
  }

  private zoneY(f: Fish, bounds: Bounds) {
    const zone = f.species.zone
    if (zone === 'floor') return this.floorY(f, f.x)
    const [from, to] = ZONE_BANDS[zone]
    const span = bounds.bottom - bounds.top
    return rand(bounds.top + span * from, bounds.top + span * to)
  }

  private depthOrder(f: Fish) {
    return (f.species.zone === 'floor' ? 0 : 1000) + f.length
  }

  private pickSpecies(): Species {
    const present = new Set(this.fish.map((f) => f.species.id))
    const missing = SPECIES.filter((s) => !present.has(s.id))
    const pool = missing.length > 0 ? missing : SPECIES
    return pool[Math.floor(Math.random() * pool.length)]
  }

  private nextVisitorKind(): VisitorKind {
    if (!this.lastVisitor) return Math.random() < 0.5 ? 'submarine' : 'diver'
    const other = this.lastVisitor === 'submarine' ? 'diver' : 'submarine'
    return Math.random() < 0.75 ? other : this.lastVisitor
  }

  private pickWanderTarget(f: Fish) {
    const bounds = this.swimBounds(f)
    // Gliders take long sweeping passes, so keep the farthest of a few candidates.
    const tries = f.species.style === 'glide' ? 3 : 1
    let x = rand(bounds.left, bounds.right)
    for (let i = 1; i < tries; i++) {
      const candidate = rand(bounds.left, bounds.right)
      if (Math.abs(candidate - f.x) > Math.abs(x - f.x)) x = candidate
    }
    f.targetX = x
    f.targetY = f.species.zone === 'floor' ? this.floorY(f, x) : this.zoneY(f, bounds)
    f.wanderTimer = rand(5, 10)
  }

  private nearestPellet(f: Fish): Pellet | null {
    const s = f.species
    const range = s.chase === undefined ? Infinity : s.chase * this.fishScale
    let nearest: Pellet | null = null
    let nearestDistance = range * range
    for (const p of this.pellets) {
      // A mouth near the top of the head (seahorse) can't reach food lying on the sand.
      if (p.landed && s.mouth[1] < -0.2) continue
      const distance = (p.x - f.x) ** 2 + (p.y - f.y) ** 2
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = p
      }
    }
    return nearest
  }

  private updatePellets(dt: number) {
    for (const p of this.pellets) {
      if (p.landed) {
        p.restTime += dt
        continue
      }
      p.phase += dt * 2.2
      p.x += Math.sin(p.phase) * 10 * dt
      p.y += p.vy * dt
      const floor = this.sandTop(p.x) - 2
      if (p.y >= floor) {
        p.y = floor
        p.landed = true
      }
    }
    this.pellets = this.pellets.filter((p) => p.restTime < PELLET_REST_SECONDS)
  }

  private updateVisitors(dt: number) {
    if (this.visitors.length === 0) {
      this.visitorTimer -= dt
      if (this.visitorTimer <= 0) this.spawnVisitor()
    }
    for (const v of this.visitors) updateVisitor(v, dt, this.time, this.emitBubble)
    const remaining = this.visitors.filter((v) => !visitorGone(v, this.width))
    if (remaining.length === 0 && this.visitors.length > 0) this.visitorTimer = rand(18, 38)
    this.visitors = remaining
  }

  private updateMonster(dt: number) {
    if (!this.monster) {
      this.monsterTimer -= dt
      if (this.monsterTimer <= 0 && this.fish.length > 0) {
        this.monster = createMonster(this.width, this.height, this.sandBase, this.fishScale)
        playKikiAlert()
      }
      return
    }

    updateMonster(
      this.monster,
      dt,
      this.width,
      this.sandBase,
      this.fish,
      (index) => {
        if (index < 0 || index >= this.fish.length) return
        const [gone] = this.fish.splice(index, 1)
        // A few panic bubbles where the fish vanished.
        for (let i = 0; i < 6; i++) {
          this.emitBubble(gone.x + rand(-8, 8), gone.y + rand(-6, 6), rand(1.5, 3.5), rand(40, 70))
        }
        this.emitStats()
      },
    )

    if (monsterGone(this.monster, this.width)) {
      this.monster = null
      this.monsterTimer = rand(18, 24)
    }
  }

  private updateFish(dt: number) {
    for (const f of this.fish) {
      const s = f.species
      const food = this.nearestPellet(f)
      const bounds = this.swimBounds(f)
      const belly = f.length * (s.floor ?? s.halfHeight)
      let pace = 1

      if (s.style === 'dart') {
        f.burstTimer -= dt
        if (f.burstTimer <= 0) {
          f.bursting = !f.bursting
          f.burstTimer = f.bursting ? rand(0.35, 0.7) : rand(0.6, 1.4)
        }
        pace = f.bursting ? 1.8 : 0.45
      }
      if (s.puffs) {
        f.puffTimer -= dt
        if (f.puffTimer <= 0) {
          f.puffTarget = f.puffTarget > 0 ? 0 : 1
          f.puffTimer = f.puffTarget > 0 ? rand(2.5, 4) : rand(8, 18)
        }
        f.puff += (f.puffTarget - f.puff) * Math.min(1, dt * 3)
        pace *= 1 - f.puff * 0.5
      }

      let targetX = f.x
      let targetY = f.y
      let speed = 0
      if (food) {
        f.restTimer = 0
        const [mouthX, mouthY] = s.mouth
        // Face food that is clearly off to one side, then bring the mouth (not the body center) to it.
        const ahead = food.x - f.x
        if (Math.abs(ahead) > mouthX * f.length * 0.5) f.facing = Math.sign(ahead)
        targetX = food.x - f.facing * mouthX * f.length
        targetY = clamp(food.y - mouthY * f.length, bounds.top, this.sandTop(food.x) - belly * 0.6)
        speed = f.cruise * 2.1 * Math.max(pace, 0.6)
      } else if (f.restTimer > 0) {
        f.restTimer -= dt
      } else {
        f.wanderTimer -= dt
        const arrived = Math.hypot(f.targetX - f.x, f.targetY - f.y) < Math.max(12, f.length * 0.25)
        if (arrived || f.wanderTimer <= 0) {
          if (arrived && s.style === 'hover') f.restTimer = rand(1.5, 4)
          if (arrived && s.style === 'bottom') f.restTimer = rand(3, 8)
          this.pickWanderTarget(f)
        }
        targetX = f.targetX
        targetY = f.targetY
        speed = f.cruise * pace
      }

      const dx = targetX - f.x
      const dy = targetY - f.y
      const distance = Math.hypot(dx, dy) || 1
      if (!food && distance < 80) speed *= Math.max(0.3, distance / 80)

      let ax = ((dx / distance) * speed - f.vx) * 2.5
      let ay = ((dy / distance) * speed - f.vy) * 2.5

      if (!food) {
        if (f.x < bounds.left) ax += (bounds.left - f.x) * 4
        else if (f.x > bounds.right) ax -= (f.x - bounds.right) * 4
        if (f.y < bounds.top) ay += (bounds.top - f.y) * 4
        else if (s.zone !== 'floor' && f.y > bounds.bottom) ay -= (f.y - bounds.bottom) * 4
      }

      const maxAccel = (food ? 300 : 120) * AGILITY[s.style]
      const accel = Math.hypot(ax, ay)
      if (accel > maxAccel) {
        ax = (ax / accel) * maxAccel
        ay = (ay / accel) * maxAccel
      }

      // Visitors nudge fish aside, but only gently while they're chasing food.
      for (const v of this.visitors) {
        const rx = f.x - v.x
        const ry = f.y - v.y
        const reach = visitorReach(v) + f.length * 0.4
        const d = Math.hypot(rx, ry)
        if (d >= reach || d < 0.001) continue
        const push = (1 - d / reach) * (food ? 90 : 260)
        ax += (rx / d) * push
        ay += (ry / d) * push
        f.restTimer = 0
        if (s.puffs) {
          f.puffTarget = 1
          f.puffTimer = Math.max(f.puffTimer, 2)
        }
      }

      // Panic-flee the round-faced monster while she's hunting.
      if (this.monster && (this.monster.phase === 'chase' || this.monster.phase === 'enter')) {
        const rx = f.x - this.monster.x
        const ry = f.y - this.monster.y
        const reach = 110 * this.monster.scale + f.length
        const d = Math.hypot(rx, ry)
        if (d < reach && d > 0.001) {
          const push = (1 - d / reach) * (food ? 140 : 420)
          ax += (rx / d) * push
          ay += (ry / d) * push
          f.restTimer = 0
        }
      }

      f.vx += ax * dt
      f.vy += ay * dt

      const maxSpeed = f.cruise * (food ? 2.4 : 1.4 * Math.max(pace, 0.5))
      const currentSpeed = Math.hypot(f.vx, f.vy)
      if (currentSpeed > maxSpeed) {
        f.vx = (f.vx / currentSpeed) * maxSpeed
        f.vy = (f.vy / currentSpeed) * maxSpeed
      }

      f.x += f.vx * dt
      f.y += f.vy * dt
      const floor = this.sandTop(f.x) - belly * 0.6
      if (f.y > floor) {
        f.y = floor
        if (f.vy > 0) f.vy = 0
      }

      if (!food) {
        // A small dead zone keeps fish from flickering left/right while hovering.
        if (f.vx > 6) f.facing = 1
        else if (f.vx < -6) f.facing = -1
      }
      f.flip += (f.facing - f.flip) * Math.min(1, dt * 7)

      const pitch = s.upright ? 0 : clamp(Math.atan2(f.vy, Math.abs(f.vx) + 10), -0.45, 0.45)
      f.pitch += (pitch - f.pitch) * Math.min(1, dt * 6)

      const speedRatio = Math.hypot(f.vx, f.vy) / f.cruise
      f.tailPhase += dt * TAU * s.tailHz * (0.45 + 0.55 * Math.min(2, speedRatio))

      if (food) {
        const mouthX = f.x + f.facing * s.mouth[0] * f.length
        const mouthY = f.y + s.mouth[1] * f.length
        if (Math.hypot(food.x - mouthX, food.y - mouthY) < f.length * 0.12 + 7) this.eat(f, food, mouthX, mouthY)
      }
    }
  }

  private eat(f: Fish, food: Pellet, mouthX: number, mouthY: number) {
    const index = this.pellets.indexOf(food)
    if (index !== -1) this.pellets.splice(index, 1)

    this.eaten += 1
    f.meals += 1
    // Every MEALS_PER_GROWTH pellets this fish eats, grow +5% (capped at 3× birth size).
    if (f.meals % MEALS_PER_GROWTH === 0) {
      f.length = Math.min(f.maxLength, f.length * GROWTH_STEP)
    }
    for (let i = 0; i < 3; i++) {
      this.emitBubble(mouthX + rand(-3, 3), mouthY - rand(0, 4), rand(1.2, 2.4), rand(30, 55))
    }
    this.emitStats()
  }

  private readonly emitBubble = (x: number, y: number, r: number, speed: number) => {
    this.bubbles.push({ x, y, r, speed, phase: rand(0, TAU), drift: rand(1, 3) })
  }

  private updateBubbles(dt: number) {
    this.bubbleTimer -= dt
    const interval = this.reducedMotion ? 0.9 : 0.35
    while (this.bubbleTimer <= 0) {
      this.bubbleTimer += interval * rand(0.5, 1.5)
      const x = this.stoneX
      this.bubbles.push({
        x: x + rand(-5, 5),
        y: this.sandTop(x) - 8,
        r: rand(2, 5.5),
        speed: rand(45, 85),
        phase: rand(0, TAU),
        drift: rand(2, 6),
      })
    }
    for (const b of this.bubbles) {
      b.y -= b.speed * dt
      b.phase += dt * 3
    }
    this.bubbles = this.bubbles.filter((b) => b.y > -12)
    if (this.bubbles.length > MAX_BUBBLES) this.bubbles.splice(0, this.bubbles.length - MAX_BUBBLES)
  }

  private updateRipples(dt: number) {
    for (const r of this.ripples) r.age += dt
    this.ripples = this.ripples.filter((r) => r.age < RIPPLE_SECONDS)
  }

  private emitStats() {
    this.onStatsChange?.({ fish: this.fish.length, species: this.speciesCount, eaten: this.eaten })
  }

  private buildScenery() {
    const random = seeded(1127)
    const { width, height } = this

    this.weeds = []
    const clusters = Math.max(4, Math.round(width / 110))
    for (let i = 0; i < clusters; i++) {
      const center = ((i + 0.15 + random() * 0.7) / clusters) * width
      const blades = 2 + Math.floor(random() * 3)
      const front = random() < 0.25
      for (let j = 0; j < blades; j++) {
        this.weeds.push({
          x: center + (j - (blades - 1) / 2) * 9 + (random() - 0.5) * 6,
          height: height * (0.13 + random() * 0.2),
          width: 9 + random() * 7,
          phase: random() * TAU,
          speed: 0.6 + random() * 0.6,
          color: WEED_COLORS[Math.floor(random() * WEED_COLORS.length)],
          front,
        })
      }
    }

    this.pebbles = []
    const pebbleCount = Math.round(width / 26)
    for (let i = 0; i < pebbleCount; i++) {
      const x = random() * width
      this.pebbles.push({
        x,
        y: this.sandTop(x) + 6 + random() * Math.max(4, this.sandHeight - 14),
        rx: 2.5 + random() * 5,
        ry: 1.8 + random() * 3,
        color: PEBBLE_COLORS[Math.floor(random() * PEBBLE_COLORS.length)],
      })
    }

    this.layoutDecors(random)
    this.layoutTown()
  }

  private layoutDecors(random: () => number) {
    const { width } = this
    this.decors = []
    if (width === 0) return

    const coralColors = ['#f472b6', '#fb7185', '#f97316', '#a3e635', '#22d3ee', '#c084fc']
    const shellColors = ['#fde68a', '#fecdd3', '#e7e5e4', '#fdba74', '#a5f3fc']
    const pearlColors = ['#f8fafc', '#fce7f3', '#e0f2fe', '#fef9c3']
    const count = Math.max(10, Math.round(width / 55))

    for (let i = 0; i < count; i++) {
      const kindRoll = random()
      const kind: DecorKind =
        kindRoll < 0.28 ? 'pearl' : kindRoll < 0.55 ? 'shell' : kindRoll < 0.82 ? 'coral' : 'star'
      const x = 18 + random() * Math.max(20, width - 36)
      const y = this.sandTop(x) - (kind === 'coral' ? 2 + random() * 4 : random() * 3)
      const color =
        kind === 'pearl'
          ? pearlColors[Math.floor(random() * pearlColors.length)]
          : kind === 'shell'
            ? shellColors[Math.floor(random() * shellColors.length)]
            : kind === 'coral'
              ? coralColors[Math.floor(random() * coralColors.length)]
              : '#f9a8d4'
      this.decors.push({
        kind,
        x,
        y,
        scale: 0.7 + random() * 0.7,
        rot: (random() - 0.5) * 0.7,
        color,
        accent: kind === 'pearl' ? '#ffffff' : kind === 'shell' ? '#fff7ed' : '#fda4af',
        variant: Math.floor(random() * 3),
      })
    }
  }

  private layoutTown() {
    if (this.width === 0) {
      this.town = { buildings: [], characters: [] }
      return
    }
    this.town = createTown(this.width, (x) => this.sandTop(x), this.fishScale)
  }

  private drawRays() {
    const { ctx, width, height } = this
    if (!this.rayFill) return

    ctx.fillStyle = this.rayFill
    const depth = height * 0.85
    for (let i = 0; i < 4; i++) {
      const sway = this.reducedMotion ? 0 : Math.sin(this.time * 0.3 + i * 1.7) * 30
      const x = width * (0.14 + i * 0.25) + sway
      const top = 36 + i * 10
      const bottom = top * 3.4
      ctx.beginPath()
      ctx.moveTo(x - top / 2, 0)
      ctx.lineTo(x + top / 2, 0)
      ctx.lineTo(x + bottom / 2 + sway, depth)
      ctx.lineTo(x - bottom / 2 + sway, depth)
      ctx.closePath()
      ctx.fill()
    }
  }

  private drawSurface() {
    const { ctx, width } = this
    ctx.beginPath()
    ctx.moveTo(0, 0)
    for (let x = 0; x <= width + 10; x += 10) {
      ctx.lineTo(x, 6 + Math.sin(x * 0.02 + this.time * 1.2) * 3)
    }
    ctx.lineTo(width, 0)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.fill()
  }

  private drawWeed(weed: Weed) {
    const { ctx } = this
    const baseY = this.sandTop(weed.x) + 6
    const segments = 12
    const points: { x: number; y: number; half: number }[] = []
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const sway = Math.sin(this.time * weed.speed + weed.phase + t * 2.2) * 16 * t * t
      points.push({
        x: weed.x + sway,
        y: baseY - weed.height * t,
        half: (weed.width / 2) * (1 - t * 0.85),
      })
    }

    ctx.beginPath()
    ctx.moveTo(points[0].x - points[0].half, points[0].y)
    for (const p of points) ctx.lineTo(p.x - p.half, p.y)
    for (let i = points.length - 1; i >= 0; i--) ctx.lineTo(points[i].x + points[i].half, points[i].y)
    ctx.closePath()
    ctx.fillStyle = weed.color
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (const p of points) ctx.lineTo(p.x, p.y)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
    ctx.lineWidth = 1.2
    ctx.stroke()
  }

  private drawSand() {
    const { ctx, width, height } = this
    if (!this.sandFill) return

    ctx.beginPath()
    ctx.moveTo(0, height)
    for (let x = 0; x <= width + 8; x += 8) ctx.lineTo(x, this.sandTop(x))
    ctx.lineTo(width, height)
    ctx.closePath()
    ctx.fillStyle = this.sandFill
    ctx.fill()

    for (const p of this.pebbles) {
      ctx.beginPath()
      ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU)
      ctx.fillStyle = p.color
      ctx.fill()
    }

    const stoneX = this.stoneX
    ctx.beginPath()
    ctx.ellipse(stoneX, this.sandTop(stoneX) - 2, 15, 6, 0, 0, TAU)
    ctx.fillStyle = '#5f7480'
    ctx.fill()
  }

  private drawDecors() {
    const { ctx } = this
    for (const d of this.decors) {
      ctx.save()
      ctx.translate(d.x, d.y)
      ctx.rotate(d.rot)
      ctx.scale(d.scale, d.scale)
      if (d.kind === 'pearl') this.drawPearl(d)
      else if (d.kind === 'shell') this.drawShell(d)
      else if (d.kind === 'coral') this.drawCoral(d)
      else this.drawSandStar(d)
      ctx.restore()
    }
  }

  private drawPearl(d: SandDecor) {
    const { ctx } = this
    const r = 4.5
    const g = ctx.createRadialGradient(-1.5, -1.5, 0.5, 0, 0, r)
    g.addColorStop(0, d.accent)
    g.addColorStop(0.55, d.color)
    g.addColorStop(1, '#94a3b8')
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, TAU)
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)'
    ctx.lineWidth = 0.8
    ctx.stroke()
  }

  private drawShell(d: SandDecor) {
    const { ctx } = this
    ctx.fillStyle = d.color
    ctx.beginPath()
    if (d.variant === 0) {
      // Fan clam
      ctx.moveTo(0, 2)
      for (let i = 0; i <= 8; i++) {
        const a = -Math.PI + (i / 8) * Math.PI
        const r = 7 + (i % 2 === 0 ? 1.5 : 0)
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.7 + 1)
      }
      ctx.closePath()
    } else if (d.variant === 1) {
      // Spiral conch
      ctx.ellipse(0, 0, 7, 5, 0, 0, TAU)
    } else {
      // Scallop
      ctx.moveTo(-7, 2)
      ctx.quadraticCurveTo(-8, -6, 0, -7)
      ctx.quadraticCurveTo(8, -6, 7, 2)
      ctx.quadraticCurveTo(0, 5, -7, 2)
      ctx.closePath()
    }
    ctx.fill()
    ctx.strokeStyle = 'rgba(120, 80, 40, 0.35)'
    ctx.lineWidth = 0.9
    ctx.stroke()
    // Ridges
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = 0.7
    for (const a of [-0.7, -0.25, 0.25, 0.7]) {
      ctx.beginPath()
      ctx.moveTo(0, 1)
      ctx.lineTo(Math.sin(a) * 6, -Math.cos(a) * 5)
      ctx.stroke()
    }
    ctx.fillStyle = d.accent
    ctx.beginPath()
    ctx.arc(0, 1.5, 1.4, 0, TAU)
    ctx.fill()
  }

  private drawCoral(d: SandDecor) {
    const { ctx } = this
    ctx.strokeStyle = d.color
    ctx.fillStyle = d.color
    ctx.lineCap = 'round'
    ctx.lineWidth = 2.4
    const branches =
      d.variant === 0
        ? [
            [0, 0, 0, -14],
            [0, -6, -7, -12],
            [0, -8, 7, -13],
            [0, -11, -4, -18],
            [0, -11, 5, -17],
          ]
        : d.variant === 1
          ? [
              [0, 0, -2, -12],
              [-2, -6, -9, -10],
              [-2, -8, 4, -14],
              [4, -10, 8, -15],
            ]
          : [
              [0, 0, 0, -10],
              [0, -4, -8, -9],
              [0, -5, 8, -9],
              [-8, -9, -10, -14],
              [8, -9, 11, -13],
              [0, -8, 0, -16],
            ]
    for (const [x0, y0, x1, y1] of branches) {
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x1, y1, 2.1, 0, TAU)
      ctx.fill()
    }
    // Soft tips
    ctx.fillStyle = d.accent
    ctx.globalAlpha = 0.55
    for (const [, , x1, y1] of branches) {
      ctx.beginPath()
      ctx.arc(x1, y1, 1.2, 0, TAU)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private drawSandStar(d: SandDecor) {
    const { ctx } = this
    const tips = 5
    const outer = 7
    const inner = 3.2
    ctx.beginPath()
    for (let i = 0; i < tips * 2; i++) {
      const r = i % 2 === 0 ? outer : inner
      const a = -Math.PI / 2 + (i * Math.PI) / tips
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = d.color
    ctx.fill()
    ctx.strokeStyle = 'rgba(157, 23, 77, 0.35)'
    ctx.lineWidth = 0.8
    ctx.stroke()
  }

  private drawPellets() {
    const { ctx } = this
    for (const p of this.pellets) {
      ctx.globalAlpha = p.landed ? Math.max(0, 1 - p.restTime / PELLET_REST_SECONDS) : 1
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2.8, 0, TAU)
      ctx.fillStyle = '#b8642d'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(p.x - 0.8, p.y - 0.8, 1, 0, TAU)
      ctx.fillStyle = 'rgba(255, 222, 184, 0.85)'
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private drawLabels() {
    const { ctx } = this
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (const f of this.fish) {
      ctx.fillText(f.species.name, f.x, f.y + f.length * Math.max(0.2, f.species.halfHeight) + 6)
    }
  }

  private drawFish(f: Fish) {
    const { ctx, pose } = this
    const s = f.species
    pose.wag = Math.sin(f.tailPhase)
    pose.phase = f.tailPhase
    pose.time = this.time
    pose.speed = Math.hypot(f.vx, f.vy) / f.cruise
    pose.puff = f.puff
    pose.px = 1 / f.length
    const bob = s.bob ? Math.sin(this.time * 1.6 + f.bobPhase) * s.bob * f.length : 0

    ctx.save()
    ctx.translate(f.x, f.y + bob)
    ctx.scale(f.flip * f.length, f.length)
    ctx.rotate(f.pitch)
    s.draw(ctx, pose)
    ctx.restore()
  }

  private drawBubbles() {
    const { ctx } = this
    ctx.lineWidth = 1.2
    for (const b of this.bubbles) {
      const x = b.x + Math.sin(b.phase) * b.drift
      ctx.beginPath()
      ctx.arc(x, b.y, b.r, 0, TAU)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.28, 0, TAU)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.fill()
    }
  }

  private drawRipples() {
    const { ctx } = this
    ctx.lineWidth = 2
    for (const r of this.ripples) {
      const progress = r.age / RIPPLE_SECONDS
      ctx.beginPath()
      ctx.arc(r.x, r.y, 6 + progress * 26, 0, TAU)
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * (1 - progress)})`
      ctx.stroke()
    }
  }
}
