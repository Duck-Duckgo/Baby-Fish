import './style.css'
import { Aquarium, MAX_FISH } from './aquarium.ts'

function start() {
  const canvas = document.querySelector<HTMLCanvasElement>('#tank')
  const fishCount = document.querySelector<HTMLElement>('#fish-count')
  const speciesCount = document.querySelector<HTMLElement>('#species-count')
  const eatenCount = document.querySelector<HTMLElement>('#eaten-count')
  const addButton = document.querySelector<HTMLButtonElement>('#add-fish')
  const feedButton = document.querySelector<HTMLButtonElement>('#feed')
  const pauseButton = document.querySelector<HTMLButtonElement>('#pause')
  const status = document.querySelector<HTMLElement>('#status')
  if (
    !canvas ||
    !fishCount ||
    !speciesCount ||
    !eatenCount ||
    !addButton ||
    !feedButton ||
    !pauseButton ||
    !status
  ) {
    return
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    status.textContent = '你的浏览器不支持 Canvas 绘图，暂时看不到小鱼。'
    for (const button of [addButton, feedButton, pauseButton]) button.disabled = true
    return
  }

  const aquarium = new Aquarium(ctx, {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    onStatsChange: ({ fish, species, eaten }) => {
      fishCount.textContent = String(fish)
      speciesCount.textContent = String(species)
      eatenCount.textContent = String(eaten)
    },
  })

  let paused = false
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

  const redrawIfPaused = () => {
    if (paused) aquarium.render()
  }

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    aquarium.resize(width, height)
    redrawIfPaused()
  }

  const setPaused = (value: boolean) => {
    paused = value
    pauseButton.textContent = value ? '继续' : '暂停'
    pauseButton.setAttribute('aria-pressed', String(value))
    status.textContent = value ? '动画已暂停，点「继续」接着看。' : ''
    if (value) {
      cancelAnimationFrame(frameId)
    } else {
      lastFrame = performance.now()
      frameId = requestAnimationFrame(frame)
    }
  }

  resize()
  new ResizeObserver(() => resize()).observe(canvas)
  const area = canvas.clientWidth * canvas.clientHeight
  aquarium.populate(Math.min(12, Math.max(6, Math.round(area / 90000))))

  if (import.meta.env.DEV) {
    ;(window as Window & { __aquarium?: Aquarium }).__aquarium = aquarium
    if (new URLSearchParams(location.search).has('showcase')) {
      const panel = document.querySelector<HTMLElement>('.panel')
      if (panel) panel.style.display = 'none'
      aquarium.showcase()
    }
  }

  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect()
    aquarium.sprinkle(event.clientX - rect.left, event.clientY - rect.top)
    redrawIfPaused()
  })

  addButton.addEventListener('click', () => {
    const added = aquarium.addFish()
    if (!added) {
      status.textContent = `鱼缸满了，最多养 ${MAX_FISH} 条。`
    } else if (aquarium.fishCount >= MAX_FISH) {
      status.textContent = `放进了一条${added.name}：${added.fact}。鱼缸已经满了。`
    } else {
      status.textContent = `放进了一条${added.name}：${added.fact}。`
    }
    redrawIfPaused()
  })

  feedButton.addEventListener('click', () => {
    aquarium.sprinkleSomewhere()
    redrawIfPaused()
  })

  pauseButton.addEventListener('click', () => setPaused(!paused))

  frameId = requestAnimationFrame(frame)
}

start()
