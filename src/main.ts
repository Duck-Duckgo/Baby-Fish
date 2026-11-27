import './style.css'
import { Aquarium, FOOD_UPGRADE_COST, GODZILLA_COST, LAZIJI_COST } from './aquarium.ts'

function start() {
  const canvas = document.querySelector<HTMLCanvasElement>('#tank')
  const addButton = document.querySelector<HTMLButtonElement>('#add-fish')
  const diamondCount = document.querySelector<HTMLElement>('#diamond-count')
  const kaijuAction = document.querySelector<HTMLButtonElement>('#kaiju-action')
  const foodUpgrade = document.querySelector<HTMLButtonElement>('#food-upgrade')
  const lazijiBuy = document.querySelector<HTMLButtonElement>('#laziji-buy')
  const godzillaStatus = document.querySelector<HTMLElement>('#godzilla-status')
  if (
    !canvas ||
    !addButton ||
    !diamondCount ||
    !kaijuAction ||
    !foodUpgrade ||
    !lazijiBuy ||
    !godzillaStatus
  ) {
    return
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    addButton.disabled = true
    kaijuAction.disabled = true
    foodUpgrade.disabled = true
    lazijiBuy.disabled = true
    return
  }

  const syncResources = (stats: {
    diamonds: number
    hasGodzilla: boolean
    godzillaLevel: number
    godzillaCharges: number
    godzillaMaxed: boolean
    foodUpgraded: boolean
    lazijiOwned: boolean
    marukoBanished: boolean
  }) => {
    diamondCount.textContent = String(stats.diamonds)
    if (stats.hasGodzilla) {
      godzillaStatus.hidden = false
      godzillaStatus.textContent = `Lv.${stats.godzillaLevel} · 可驱赶 ${stats.godzillaCharges} 次`
      if (stats.godzillaMaxed) {
        kaijuAction.textContent = '哥斯拉已满级'
        kaijuAction.disabled = true
      } else {
        kaijuAction.textContent = `升级哥斯拉 · ${GODZILLA_COST}`
        kaijuAction.disabled = stats.diamonds < GODZILLA_COST
      }
    } else {
      godzillaStatus.hidden = true
      kaijuAction.textContent = `购买哥斯拉 · ${GODZILLA_COST}`
      kaijuAction.disabled = stats.diamonds < GODZILLA_COST
    }

    if (stats.foodUpgraded) {
      foodUpgrade.textContent = '汉堡鱼食已启用'
      foodUpgrade.disabled = true
      foodUpgrade.classList.add('is-owned')
    } else {
      foodUpgrade.textContent = `升级鱼食 · ${FOOD_UPGRADE_COST}`
      foodUpgrade.disabled = stats.diamonds < FOOD_UPGRADE_COST
      foodUpgrade.classList.remove('is-owned')
    }

    if (stats.lazijiOwned) {
      lazijiBuy.textContent = stats.marukoBanished ? '小丸子已封印' : '辣子鸡已就绪'
      lazijiBuy.disabled = true
      lazijiBuy.classList.add('is-owned')
    } else {
      lazijiBuy.textContent = `购买辣子鸡 · ${LAZIJI_COST}`
      lazijiBuy.disabled = stats.diamonds < LAZIJI_COST
      lazijiBuy.classList.remove('is-owned')
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
        godzillaMaxed: stats.godzillaMaxed,
        foodUpgraded: stats.foodUpgraded,
        lazijiOwned: stats.lazijiOwned,
        marukoBanished: stats.marukoBanished,
      }),
  })

  let frameId = 0
  let lastFrame = performance.now()

  const frame = (now: number) => {
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
    godzillaMaxed: aquarium.godzillaMaxed,
    foodUpgraded: aquarium.hasFoodUpgrade,
    lazijiOwned: aquarium.hasLaziji,
    marukoBanished: aquarium.isMarukoBanished,
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
        godzillaMaxed: aquarium.godzillaMaxed,
        foodUpgraded: aquarium.hasFoodUpgrade,
        lazijiOwned: aquarium.hasLaziji,
        marukoBanished: aquarium.isMarukoBanished,
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

  foodUpgrade.addEventListener('click', () => {
    aquarium.buyFoodUpgrade()
  })

  lazijiBuy.addEventListener('click', () => {
    aquarium.buyLaziji()
  })

  frameId = requestAnimationFrame(frame)
  void frameId
}

start()
