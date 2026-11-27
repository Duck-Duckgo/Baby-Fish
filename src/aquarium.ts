import { SPECIES, type FishPose, type Species, type SwimStyle, type Zone } from './species.ts'
import {
  createMonster,
  drawKikiBanner,
  drawMonster,
  driveMonsterAway,
  monsterGone,
  playKikiAlert,
  updateMonster,
  type Monster,
} from './monster.ts'
import {
  createGodzilla,
  demoteGodzilla,
  drawGodzilla,
  GODZILLA_MAX_LEVEL,
  godzillaGone,
  startGodzillaDrive,
  updateGodzilla,
  upgradeGodzilla,
  type Godzilla,
} from './godzilla.ts'
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
  diamonds: number
  hasGodzilla: boolean
  godzillaLevel: number
  godzillaCharges: number
  godzillaMaxed: boolean
  foodUpgraded: boolean
  lazijiOwned: boolean
  marukoBanished: boolean
}

export interface AquariumOptions {
  reducedMotion: boolean
  onStatsChange?: (stats: AquariumStats) => void
}

/** Cost to summon or upgrade the kaiju guardian. */
export const GODZILLA_COST = 10
/** Cost to unlock burger fish food. */
export const FOOD_UPGRADE_COST = 20
/** Cost to buy the spicy-chicken seal that banishes KiKi. */
export const LAZIJI_COST = 100
/** Seconds between diamond drops from a fully grown fish. */
export const DIAMOND_INTERVAL = 5
const MAX_FLOATING_DIAMONDS = 36
const SPRINKLE_COUNT = 5

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
  /** Countdown to next diamond drop once at max growth. */
  diamondTimer: number
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

interface FloatingDiamond {
  x: number
  y: number
  vx: number
  vy: number
  bob: number
  age: number
  /** After a short pop, homes toward the resource panel and auto-banks. */
  homing: boolean
  spin: number
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
  kind: 'pellet' | 'burger'
  /** How many meal units this food is worth (burger = 5). */
  mealValue: number
  radius: number
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

export const MAX_FISH = 100

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
  private godzilla: Godzilla | null = null
  private diamondsHeld = 0
  private floatingDiamonds: FloatingDiamond[] = []
  private foodUpgraded = false
  private lazijiOwned = false
  private marukoBanished = false
  /** Pull KiKi into the laziji bowl after purchase / next spawn. */
  private sealingMaruko = false
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

  get diamonds() {
    return this.diamondsHeld
  }

  get hasGodzilla() {
    return this.godzilla !== null && this.godzilla.phase !== 'vanish'
  }

  get godzillaLevel() {
    return this.godzilla?.level ?? 0
  }

  get godzillaCharges() {
    return this.godzilla?.charges ?? 0
  }

  get godzillaMaxed() {
    return this.godzillaLevel >= GODZILLA_MAX_LEVEL
  }

  get hasFoodUpgrade() {
    return this.foodUpgraded
  }

  get hasLaziji() {
    return this.lazijiOwned
  }

  get isMarukoBanished() {
    return this.marukoBanished
  }

  private get lazijiBowl() {
    return { x: this.width * 0.5, y: 56 }
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
    this.godzilla = null
    this.floatingDiamonds = []
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
      f.diamondTimer = DIAMOND_INTERVAL
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
      diamondTimer: DIAMOND_INTERVAL,
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

  sprinkle(x: number, y: number, count = SPRINKLE_COUNT) {
    if (this.width === 0) return

    const startY = clamp(y, 10, this.sandTop(x) - 12)
    const burger = this.foodUpgraded
    const spread = burger ? 22 : 14
    for (let i = 0; i < count; i++) {
      this.pellets.push({
        x: clamp(x + rand(-spread, spread), 6, this.width - 6),
        y: startY + rand(-6, 6),
        vy: rand(22, 36),
        phase: rand(0, TAU),
        landed: false,
        restTime: 0,
        kind: burger ? 'burger' : 'pellet',
        mealValue: burger ? 5 : 1,
        radius: burger ? 5.6 : 2.8,
      })
    }
    if (this.pellets.length > MAX_PELLETS) {
      this.pellets.splice(0, this.pellets.length - MAX_PELLETS)
    }
    this.ripples.push({ x, y: startY, age: 0 })
  }

  sprinkleSomewhere() {
    this.sprinkle(rand(this.width * 0.3, this.width * 0.85), rand(24, 60), SPRINKLE_COUNT)
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
    if (this.width === 0 || this.marukoBanished) return null
    this.monster = createMonster(this.width, this.height, this.sandBase, this.fishScale)
    this.monsterTimer = 1e9
    playKikiAlert()
    if (this.lazijiOwned) this.sealingMaruko = true
    return this.monster
  }

  /** Spend diamonds to summon the kaiju guardian into the tank. */
  buyGodzilla(): boolean {
    if (this.width === 0 || this.hasGodzilla || this.diamondsHeld < GODZILLA_COST) return false
    this.diamondsHeld -= GODZILLA_COST
    this.godzilla = createGodzilla(this.width, this.sandBase, this.fishScale)
    this.emitStats()
    return true
  }

  /** While a guardian is present, spend diamonds to level up looks + one extra drive. */
  upgradeGodzilla(): boolean {
    if (
      !this.godzilla ||
      this.godzilla.phase === 'vanish' ||
      this.godzilla.level >= GODZILLA_MAX_LEVEL ||
      this.diamondsHeld < GODZILLA_COST
    ) {
      return false
    }
    this.diamondsHeld -= GODZILLA_COST
    upgradeGodzilla(this.godzilla)
    this.emitStats()
    return true
  }

  /** Unlock burger fish food (5× meal value, 2× size) for FOOD_UPGRADE_COST diamonds. */
  buyFoodUpgrade(): boolean {
    if (this.foodUpgraded || this.diamondsHeld < FOOD_UPGRADE_COST) return false
    this.diamondsHeld -= FOOD_UPGRADE_COST
    this.foodUpgraded = true
    this.emitStats()
    return true
  }

  /** Buy the spicy-chicken bowl; the next KiKi appearance is sealed forever. */
  buyLaziji(): boolean {
    if (this.lazijiOwned || this.diamondsHeld < LAZIJI_COST) return false
    this.diamondsHeld -= LAZIJI_COST
    this.lazijiOwned = true
    if (this.monster && !this.marukoBanished) this.sealingMaruko = true
    this.emitStats()
    return true
  }

  /** Force-grow every fish to the cap (preview / demo). */
  maxGrowAll() {
    for (const f of this.fish) {
      f.length = f.maxLength
      f.diamondTimer = rand(0.4, DIAMOND_INTERVAL)
    }
  }

  /** Grant banked diamonds (preview / demo). */
  grantDiamonds(n: number) {
    this.diamondsHeld = Math.max(0, this.diamondsHeld + Math.floor(n))
    this.emitStats()
  }

  /** Spawn a few floating diamonds near grown fish (preview / demo). */
  burstDiamonds(count = 6) {
    const grown = this.fish.filter((f) => this.isMaxGrown(f))
    const pool = grown.length > 0 ? grown : this.fish
    if (pool.length === 0) return
    for (let i = 0; i < count; i++) this.spawnDiamondNear(pool[i % pool.length])
  }

  /** Seed diamonds, upgraded guardian, burgers, laziji, and hunter for screenshots (`?demo`). */
  seedDemo() {
    this.maxGrowAll()
    this.grantDiamonds(GODZILLA_COST * 12 + FOOD_UPGRADE_COST + LAZIJI_COST)
    this.burstDiamonds(8)
    this.buyGodzilla()
    while (this.godzilla && this.godzilla.level < GODZILLA_MAX_LEVEL) {
      if (!this.upgradeGodzilla()) break
    }
    this.buyFoodUpgrade()
    this.buyLaziji()
    this.sprinkle(this.width * 0.55, this.height * 0.35, SPRINKLE_COUNT)
    this.spawnMonsterNow()
  }

  update(dt: number) {
    if (this.width === 0) return

    const step = this.reducedMotion ? dt * 0.6 : dt
    this.time += step
    this.updatePellets(step)
    this.updateVisitors(step)
    this.updateMonster(step)
    this.updateGodzilla(step)
    this.updateFloatingDiamonds(step)
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
    if (this.godzilla) drawGodzilla(ctx, this.godzilla)
    if (this.monster) {
      drawMonster(ctx, this.monster)
      drawKikiBanner(ctx, width, this.monster)
    }
    this.drawFloatingDiamonds()

    for (const weed of this.weeds) if (weed.front) this.drawWeed(weed)
    this.drawBubbles()
    this.drawRipples()
    if (this.lazijiOwned) this.drawLazijiBowl()
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
    if (this.marukoBanished) {
      this.monster = null
      this.monsterTimer = 1e9
      this.sealingMaruko = false
      return
    }

    if (!this.monster) {
      this.monsterTimer -= dt
      if (this.monsterTimer <= 0 && this.fish.length > 0) {
        this.monster = createMonster(this.width, this.height, this.sandBase, this.fishScale)
        playKikiAlert()
        if (this.lazijiOwned) this.sealingMaruko = true
      }
      return
    }

    if (this.sealingMaruko) {
      this.updateMarukoSeal(dt)
      return
    }

    updateMonster(
      this.monster,
      dt,
      this.width,
      this.sandBase,
      this.fish,
      (index) => {
        if (index < 0 || index >= this.fish.length) return false
        // Last-resort drive if somehow still hunting next to the guardian.
        if (
          this.godzilla &&
          this.godzilla.phase !== 'vanish' &&
          this.godzilla.phase !== 'drive' &&
          this.godzilla.charges > 0
        ) {
          startGodzillaDrive(this.godzilla, this.monster!.x, this.monster!.y)
          this.emitStats()
          return false
        }
        const [gone] = this.fish.splice(index, 1)
        for (let i = 0; i < 6; i++) {
          this.emitBubble(gone.x + rand(-8, 8), gone.y + rand(-6, 6), rand(1.5, 3.5), rand(40, 70))
        }
        this.emitStats()
        return true
      },
    )

    if (monsterGone(this.monster, this.width)) {
      this.monster = null
      this.monsterTimer = rand(18, 24)
    }
  }

  private updateMarukoSeal(dt: number) {
    const m = this.monster
    if (!m) {
      this.sealingMaruko = false
      return
    }
    const bowl = this.lazijiBowl
    const dx = bowl.x - m.x
    const dy = bowl.y - m.y
    const dist = Math.hypot(dx, dy) || 1
    const speed = 160
    m.x += (dx / dist) * speed * dt
    m.y += (dy / dist) * speed * dt
    m.vx = (dx / dist) * speed
    m.vy = (dy / dist) * speed
    m.facing = dx >= 0 ? 1 : -1
    m.phase = 'leave'
    m.alertLeft = Math.max(m.alertLeft, 0.4)
    for (let i = 0; i < 2; i++) {
      this.emitBubble(m.x + rand(-8, 8), m.y + rand(-6, 6), rand(1.5, 3), rand(40, 80))
    }
    if (dist < 22) {
      this.monster = null
      this.sealingMaruko = false
      this.marukoBanished = true
      this.monsterTimer = 1e9
      this.emitStats()
    }
  }

  private updateGodzilla(dt: number) {
    if (!this.godzilla) return
    const prevCharges = this.godzilla.charges
    const prevPhase = this.godzilla.phase
    const prevLevel = this.godzilla.level
    const hunter =
      this.monster &&
      !this.sealingMaruko &&
      (this.monster.phase === 'enter' || this.monster.phase === 'chase')
        ? this.monster
        : null
    updateGodzilla(this.godzilla, dt, this.width, this.sandBase, hunter, () => {
      if (!this.monster || !this.godzilla) return
      if (this.monster.phase === 'leave') return
      driveMonsterAway(this.monster, this.godzilla.x, this.width)
      if (this.godzilla.demoteOnSuccess) {
        demoteGodzilla(this.godzilla)
        this.godzilla.demoteOnSuccess = false
      }
      for (let i = 0; i < 8; i++) {
        this.emitBubble(
          this.monster.x + rand(-14, 14),
          this.monster.y + rand(-10, 10),
          rand(2, 4.5),
          rand(50, 100),
        )
      }
    })
    if (godzillaGone(this.godzilla)) {
      this.godzilla = null
      this.emitStats()
      return
    }
    if (
      this.godzilla.charges !== prevCharges ||
      this.godzilla.phase !== prevPhase ||
      this.godzilla.level !== prevLevel
    ) {
      this.emitStats()
    }
  }

  private updateFloatingDiamonds(dt: number) {
    const bankX = this.width - 56
    const bankY = 48
    const kept: FloatingDiamond[] = []
    let gained = 0

    for (const d of this.floatingDiamonds) {
      d.age += dt
      d.bob += dt * 4
      d.spin += dt * 3.5

      if (!d.homing && d.age > 0.55) d.homing = true

      if (d.homing) {
        const dx = bankX - d.x
        const dy = bankY - d.y
        const dist = Math.hypot(dx, dy) || 1
        const speed = 220 + d.age * 40
        d.vx = (dx / dist) * speed
        d.vy = (dy / dist) * speed
        d.x += d.vx * dt
        d.y += d.vy * dt
        if (dist < 18) {
          gained += 1
          continue
        }
      } else {
        d.x += d.vx * dt + Math.sin(d.bob) * 8 * dt
        d.y += d.vy * dt
        d.vy = Math.max(-18, d.vy - 6 * dt)
      }
      kept.push(d)
    }

    this.floatingDiamonds = kept
    if (gained > 0) {
      this.diamondsHeld += gained
      this.emitStats()
    }
  }

  private isMaxGrown(f: Fish) {
    return f.length >= f.maxLength - 1e-6
  }

  private spawnDiamondNear(f: Fish) {
    if (this.floatingDiamonds.length >= MAX_FLOATING_DIAMONDS) return
    this.floatingDiamonds.push({
      x: f.x + rand(-10, 10),
      y: f.y - f.length * 0.35 + rand(-6, 4),
      vx: rand(-18, 18),
      vy: rand(-28, -10),
      bob: rand(0, TAU),
      age: 0,
      homing: false,
      spin: rand(0, TAU),
    })
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

      // Bigger fish swim proportionally slower so small ones can contest food.
      const sizeSlow = f.birthLength / Math.max(f.birthLength, f.length)

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
        speed = f.cruise * 2.1 * Math.max(pace, 0.6) * sizeSlow
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
        speed = f.cruise * pace * sizeSlow
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

      const maxSpeed = f.cruise * (food ? 2.4 : 1.4 * Math.max(pace, 0.5)) * sizeSlow
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
        const bite = f.length * 0.12 + 7 + food.radius
        if (Math.hypot(food.x - mouthX, food.y - mouthY) < bite) this.eat(f, food, mouthX, mouthY)
      }

      // Fully grown fish mint a floating diamond every DIAMOND_INTERVAL seconds.
      if (this.isMaxGrown(f)) {
        f.diamondTimer -= dt
        if (f.diamondTimer <= 0) {
          f.diamondTimer += DIAMOND_INTERVAL
          this.spawnDiamondNear(f)
        }
      }
    }
  }

  private eat(f: Fish, food: Pellet, mouthX: number, mouthY: number) {
    const index = this.pellets.indexOf(food)
    if (index !== -1) this.pellets.splice(index, 1)

    this.eaten += food.mealValue
    const before = Math.floor(f.meals / MEALS_PER_GROWTH)
    f.meals += food.mealValue
    const after = Math.floor(f.meals / MEALS_PER_GROWTH)
    // Every MEALS_PER_GROWTH meal units, grow +5% (capped at 3× birth size).
    for (let i = 0; i < after - before; i++) {
      f.length = Math.min(f.maxLength, f.length * GROWTH_STEP)
    }
    const bubbles = food.kind === 'burger' ? 6 : 3
    for (let i = 0; i < bubbles; i++) {
      this.emitBubble(mouthX + rand(-3, 3), mouthY - rand(0, 4), rand(1.2, 2.8), rand(30, 55))
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
    this.onStatsChange?.({
      fish: this.fish.length,
      species: this.speciesCount,
      eaten: this.eaten,
      diamonds: this.diamondsHeld,
      hasGodzilla: this.hasGodzilla,
      godzillaLevel: this.godzillaLevel,
      godzillaCharges: this.godzillaCharges,
      godzillaMaxed: this.godzillaMaxed,
      foodUpgraded: this.foodUpgraded,
      lazijiOwned: this.lazijiOwned,
      marukoBanished: this.marukoBanished,
    })
  }

  private drawLazijiBowl() {
    const { ctx } = this
    const { x, y } = this.lazijiBowl
    const steam = Math.sin(this.time * 3)

    ctx.save()
    ctx.translate(x, y)

    // Soft spotlight
    const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, 56)
    glow.addColorStop(0, 'rgba(255, 120, 40, 0.35)')
    glow.addColorStop(1, 'rgba(255, 120, 40, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(0, 0, 56, 0, TAU)
    ctx.fill()

    // Bowl body
    ctx.fillStyle = '#7f1d1d'
    ctx.beginPath()
    ctx.moveTo(-34, -4)
    ctx.quadraticCurveTo(-36, 28, 0, 32)
    ctx.quadraticCurveTo(36, 28, 34, -4)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#450a0a'
    ctx.lineWidth = 1.6
    ctx.stroke()

    // Rim
    ctx.fillStyle = '#b91c1c'
    ctx.beginPath()
    ctx.ellipse(0, -6, 36, 10, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#450a0a'
    ctx.beginPath()
    ctx.ellipse(0, -6, 28, 7, 0, 0, TAU)
    ctx.fill()

    // Chili oil surface
    ctx.fillStyle = '#ea580c'
    ctx.beginPath()
    ctx.ellipse(0, -6, 26, 6, 0, 0, TAU)
    ctx.fill()

    // Chicken pieces
    for (const [px, py, r] of [
      [-10, -8, 6],
      [4, -10, 5.5],
      [12, -5, 5],
      [-4, -3, 4.5],
    ] as const) {
      ctx.fillStyle = '#fbbf24'
      ctx.beginPath()
      ctx.arc(px, py, r, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#b45309'
      ctx.beginPath()
      ctx.arc(px - 1.5, py - 1.5, r * 0.35, 0, TAU)
      ctx.fill()
    }

    // Chili peppers
    ctx.strokeStyle = '#dc2626'
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    for (const [x0, y0, x1, y1] of [
      [-18, -4, -12, -14],
      [16, -3, 22, -12],
      [0, 0, 6, -12],
    ] as const) {
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.quadraticCurveTo((x0 + x1) / 2 + 3, (y0 + y1) / 2, x1, y1)
      ctx.stroke()
    }

    // Steam
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.lineWidth = 1.6
    for (const [sx, amp] of [
      [-12, 10],
      [0, 14],
      [12, 10],
    ] as const) {
      ctx.beginPath()
      ctx.moveTo(sx, -14)
      ctx.quadraticCurveTo(sx + steam * 4, -22 - amp * 0.3, sx + steam * 2, -28 - amp * 0.5)
      ctx.stroke()
    }

    // Label
    ctx.fillStyle = 'rgba(255, 247, 237, 0.95)'
    ctx.font = 'bold 12px "PingFang SC", "Noto Sans SC", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('辣子鸡', 0, 36)

    // Sealed KiKi face peeking from the oil when banished
    if (this.marukoBanished) {
      ctx.fillStyle = '#f6c9a8'
      ctx.beginPath()
      ctx.arc(0, -8, 9, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#111827'
      ctx.beginPath()
      ctx.moveTo(-6, -12)
      ctx.lineTo(-3, -7)
      ctx.lineTo(0, -12)
      ctx.lineTo(3, -7)
      ctx.lineTo(6, -12)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(-3, -8, 2.2, 0.7, 0, 0, TAU)
      ctx.ellipse(3, -8, 2.2, 0.7, 0, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(0, -8, 12, 0, TAU)
      ctx.stroke()
      ctx.fillStyle = '#fecaca'
      ctx.font = 'bold 10px "PingFang SC", "Noto Sans SC", sans-serif'
      ctx.fillText('已封印', 0, 50)
    }

    ctx.restore()
  }

  private drawFloatingDiamonds() {
    const { ctx } = this
    for (const d of this.floatingDiamonds) {
      const pulse = 1 + 0.06 * Math.sin(d.bob * 2)
      const shrink = d.homing ? Math.max(0.55, 1 - d.age * 0.08) : 1
      ctx.save()
      ctx.translate(d.x, d.y + Math.sin(d.bob) * 1.5)
      ctx.rotate(d.spin * 0.15)
      ctx.scale(pulse * shrink, pulse * shrink)

      // Classic round-brilliant silhouette: octagon crown + pointed pavilion
      ctx.beginPath()
      ctx.moveTo(0, -9)
      ctx.lineTo(5, -4)
      ctx.lineTo(7, 1)
      ctx.lineTo(4, 8)
      ctx.lineTo(0, 11)
      ctx.lineTo(-4, 8)
      ctx.lineTo(-7, 1)
      ctx.lineTo(-5, -4)
      ctx.closePath()
      const body = ctx.createLinearGradient(-7, -9, 7, 11)
      body.addColorStop(0, '#f8fbff')
      body.addColorStop(0.28, '#c7e9ff')
      body.addColorStop(0.55, '#5ec8ff')
      body.addColorStop(0.82, '#1d8fd6')
      body.addColorStop(1, '#0b4f8a')
      ctx.fillStyle = body
      ctx.fill()
      ctx.strokeStyle = 'rgba(15, 60, 110, 0.55)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Crown facets
      ctx.beginPath()
      ctx.moveTo(0, -9)
      ctx.lineTo(0, 1)
      ctx.moveTo(-5, -4)
      ctx.lineTo(5, -4)
      ctx.moveTo(-7, 1)
      ctx.lineTo(7, 1)
      ctx.moveTo(-5, -4)
      ctx.lineTo(0, 1)
      ctx.lineTo(5, -4)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)'
      ctx.lineWidth = 0.85
      ctx.stroke()

      // Pavilion tip highlight
      ctx.beginPath()
      ctx.moveTo(-4, 8)
      ctx.lineTo(0, 1)
      ctx.lineTo(4, 8)
      ctx.strokeStyle = 'rgba(180, 230, 255, 0.5)'
      ctx.stroke()

      // Specular sparkle
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.beginPath()
      ctx.arc(-2.2, -5.5, 1.3, 0, TAU)
      ctx.fill()

      ctx.restore()
    }
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
      if (p.kind === 'burger') this.drawBurger(p)
      else {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, TAU)
        ctx.fillStyle = '#b8642d'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(p.x - 0.8, p.y - 0.8, 1, 0, TAU)
        ctx.fillStyle = 'rgba(255, 222, 184, 0.85)'
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  private drawBurger(p: Pellet) {
    const { ctx } = this
    const s = p.radius
    // Bottom bun
    ctx.fillStyle = '#e8a54b'
    ctx.beginPath()
    ctx.ellipse(p.x, p.y + s * 0.35, s * 1.05, s * 0.45, 0, 0, TAU)
    ctx.fill()
    // Patty
    ctx.fillStyle = '#6b3a1e'
    ctx.beginPath()
    ctx.ellipse(p.x, p.y + s * 0.05, s * 1.0, s * 0.32, 0, 0, TAU)
    ctx.fill()
    // Lettuce
    ctx.fillStyle = '#6dbf4c'
    ctx.beginPath()
    ctx.ellipse(p.x, p.y - s * 0.12, s * 0.95, s * 0.22, 0, 0, TAU)
    ctx.fill()
    // Top bun
    ctx.fillStyle = '#f0b85a'
    ctx.beginPath()
    ctx.ellipse(p.x, p.y - s * 0.35, s * 1.05, s * 0.55, 0, Math.PI, TAU)
    ctx.ellipse(p.x, p.y - s * 0.15, s * 1.05, s * 0.28, 0, 0, TAU)
    ctx.fill()
    // Sesame
    ctx.fillStyle = '#fff4d6'
    for (const [dx, dy] of [
      [-0.35, -0.45],
      [0.1, -0.55],
      [0.4, -0.35],
    ] as const) {
      ctx.beginPath()
      ctx.ellipse(p.x + dx * s, p.y + dy * s, s * 0.12, s * 0.08, 0.3, 0, TAU)
      ctx.fill()
    }
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
