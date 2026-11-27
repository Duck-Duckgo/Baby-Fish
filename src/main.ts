import './style.css'
import { Aquarium } from './aquarium.ts'

function start() {
  const canvas = document.querySelector<HTMLCanvasElement>('#tank')
  const addButton = document.querySelector<HTMLButtonElement>('#add-fish')
  if (!canvas || !addButton) return

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    addButton.disabled = true
    return
  }

  const aquarium = new Aquarium(ctx, {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
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

  const params = new URLSearchParams(location.search)
  if (import.meta.env.DEV || params.has('monster') || params.has('showcase')) {
    ;(window as Window & { __aquarium?: Aquarium }).__aquarium = aquarium
  }
  if (params.has('showcase')) {
    const controls = document.querySelector<HTMLElement>('.controls')
    if (controls) controls.style.display = 'none'
    aquarium.showcase()
  }
  if (params.has('monster')) {
    // Let the tank populate one frame, then force the hunter in for screenshots.
    requestAnimationFrame(() => aquarium.spawnMonsterNow())
  }

  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect()
    aquarium.sprinkle(event.clientX - rect.left, event.clientY - rect.top)
  })

  addButton.addEventListener('click', () => {
    aquarium.addFish()
  })

  frameId = requestAnimationFrame(frame)
  void frameId
}

start()
