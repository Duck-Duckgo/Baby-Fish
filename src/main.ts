import './style.css'
import { Aquarium, GODZILLA_COST } from './aquarium.ts'

function start() {
  const canvas = document.querySelector<HTMLCanvasElement>('#tank')
  const addButton = document.querySelector<HTMLButtonElement>('#add-fish')
  const diamondCount = document.querySelector<HTMLElement>('#diamond-count')
  const kaijuAction = document.querySelector<HTMLButtonElement>('#kaiju-action')
  const godzillaStatus = document.querySelector<HTMLElement>('#godzilla-status')
  if (!canvas || !addButton || !diamondCount || !kaijuAction || !godzillaStatus) return

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    addButton.disabled = true
    kaijuAction.disabled = true
    return
  }

  const syncResources = (stats: {
    diamonds: number
    hasGodzilla: boolean
    godzillaLevel: number
    godzillaCharges: number
  }) => {
    diamondCount.textContent = String(stats.diamonds)
    if (stats.hasGodzilla) {
      godzillaStatus.hidden = false
      godzillaStatus.textContent = `Lv.${stats.godzillaLevel} · 可挡 ${stats.godzillaCharges} 次`
      kaijuAction.textContent = `升级哥斯拉 · ${GODZILLA_COST}`
      kaijuAction.disabled = stats.diamonds < GODZILLA_COST
    } else {
      godzillaStatus.hidden = true
      kaijuAction.textContent = `购买哥斯拉 · ${GODZILLA_COST}`
      kaijuAction.disabled = stats.diamonds < GODZILLA_COST
    }
  }

  const aquarium = new Aquarium(ctx, {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    onStatsChange: (stats) =>
      syncResources({
        diamonds: stats.diamonds,
        hasGodzilla: stats.hasGodzilla,
        godzillaLevel: stats.godzillaLevel,
        godzillaCharges: stats.godzillaCharges,
      }),
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
  syncResources({
    diamonds: aquarium.diamonds,
    hasGodzilla: aquarium.hasGodzilla,
    godzillaLevel: aquarium.godzillaLevel,
    godzillaCharges: aquarium.godzillaCharges,
  })

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
      syncResources({
        diamonds: aquarium.diamonds,
        hasGodzilla: aquarium.hasGodzilla,
        godzillaLevel: aquarium.godzillaLevel,
        godzillaCharges: aquarium.godzillaCharges,
      })
    })
  }

  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect()
    aquarium.sprinkle(event.clientX - rect.left, event.clientY - rect.top)
  })

  addButton.addEventListener('click', () => {
    aquarium.addFish()
  })

  kaijuAction.addEventListener('click', () => {
    if (aquarium.hasGodzilla) aquarium.upgradeGodzilla()
    else aquarium.buyGodzilla()
  })

  frameId = requestAnimationFrame(frame)
  void frameId
}

start()
