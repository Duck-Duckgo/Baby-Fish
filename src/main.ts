import './style.css'
import { Aquarium, GODZILLA_COST } from './aquarium.ts'

function start() {
  const canvas = document.querySelector<HTMLCanvasElement>('#tank')
  const addButton = document.querySelector<HTMLButtonElement>('#add-fish')
  const diamondCount = document.querySelector<HTMLElement>('#diamond-count')
  const buyGodzilla = document.querySelector<HTMLButtonElement>('#buy-godzilla')
  if (!canvas || !addButton || !diamondCount || !buyGodzilla) return

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    addButton.disabled = true
    buyGodzilla.disabled = true
    return
  }

  const syncResources = (diamonds: number, hasGodzilla: boolean) => {
    diamondCount.textContent = String(diamonds)
    buyGodzilla.disabled = hasGodzilla || diamonds < GODZILLA_COST
  }

  const aquarium = new Aquarium(ctx, {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    onStatsChange: (stats) => syncResources(stats.diamonds, stats.hasGodzilla),
  })

  let frameId = 0
  let lastFrame = performance.now()

  const frame = (now: number) => {
    // Clamp the step so a long-hidden tab doesn't teleport every fish on return.
    const dt = Math.min((now - lastFrame) / 1000, 1 / 20)
    lastFrame = now
    aquarium.update(dt)
    aquarium.render()
    frameId = requestAnimationFrame(frame)
  }

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    aquarium.resize(width, height)
  }

  resize()
  new ResizeObserver(() => resize()).observe(canvas)
  const area = canvas.clientWidth * canvas.clientHeight
  aquarium.populate(Math.min(12, Math.max(6, Math.round(area / 90000))))
  syncResources(aquarium.diamonds, aquarium.hasGodzilla)

  const params = new URLSearchParams(location.search)
  if (
    import.meta.env.DEV ||
    params.has('monster') ||
    params.has('showcase') ||
    params.has('demo')
  ) {
    ;(window as Window & { __aquarium?: Aquarium }).__aquarium = aquarium
  }
  if (params.has('showcase')) {
    const controls = document.querySelector<HTMLElement>('.controls')
    const resources = document.querySelector<HTMLElement>('.resources')
    if (controls) controls.style.display = 'none'
    if (resources) resources.style.display = 'none'
    aquarium.showcase()
  }
  if (params.has('monster')) {
    requestAnimationFrame(() => aquarium.spawnMonsterNow())
  }
  if (params.has('demo')) {
    requestAnimationFrame(() => {
      aquarium.seedDemo()
      syncResources(aquarium.diamonds, aquarium.hasGodzilla)
    })
  }

  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    if (aquarium.collectAt(x, y)) return
    aquarium.sprinkle(x, y)
  })

  addButton.addEventListener('click', () => {
    aquarium.addFish()
  })

  buyGodzilla.addEventListener('click', () => {
    aquarium.buyGodzilla()
  })

  frameId = requestAnimationFrame(frame)
  void frameId
}

start()
