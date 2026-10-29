// ─── Virtual Office Engine: main orchestrator ───────────────────────────────

import { setTHREE, getTHREE, $, esc, canvasTex, mat, box, cyl, textSprite } from './utils.js'
import { World } from './world.js'
import { createCharacter, animateCharacter, NPCManager } from './characters.js'
import { Navigation } from './navigation.js'
import { AudioManager } from './audio.js'

export class VirtualOffice {
  constructor(config) {
    this.config = config
    this.THREE = null
    this.renderer = null
    this.scene = null
    this.camera = null
    this.world = null
    this.nav = null
    this.npcMgr = null
    this.audio = new AudioManager()
    this.clock = null
    this.t = 0

    // player state
    this.P = {
      pos: null, yaw: Math.PI, state: 'idle',
      seated: null, path: null, pending: null,
      travel: null, stuck: 0, dance: false, guitar: false,
      onArrive: null, faceTo: null,
    }
    this.carry = false
    this.labelsOn = true
    this.camMode = 'follow'
    this.camYaw = 0
    this.camPitch = 0.42
    this.camDist = 4.4
    this.camPos = null
    this.camLook = null
    this.keys = new Set()
    this.drag = null
    this.CUT = null
    this.acc = { tv: 0, mm: 0, hud: 0, led: 0, fps: 0, frames: 0 }

    // UI state
    this.panelOpen = null
    this.phoneOpen = false
    this.phoneView = 'home'
    this.bannerTimeout = 0
    this.toastTimeout = 0
    this.interactables = {}
    this.chevrons = []
  }

  async start() {
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js')
    this.THREE = THREE
    setTHREE(THREE)
    $('loadbar').style.width = '25%'

    // load fonts
    try {
      await Promise.race([
        Promise.all([
          '700 42px "Barlow Condensed"', '500 32px Barlow',
          '600 16px "JetBrains Mono"', '40px Anton',
        ].map(f => document.fonts.load(f))),
        new Promise(r => setTimeout(r, 2500)),
      ])
    } catch {}

    // renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
    this.renderer.setSize(innerWidth, innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    $('scene').appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#0e0f12')
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 120)
    this.camPos = new THREE.Vector3(6.2, 3.2, -4.5)
    this.camLook = new THREE.Vector3()
    this.clock = new THREE.Clock()

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(innerWidth, innerHeight)
    })

    $('loadbar').style.width = '40%'

    // build world
    this.world = new World(this.scene, this.config)
    this.world.build()
    $('loadbar').style.width = '55%'

    // navigation
    const rc = this.config.room
    const W = rc.width / 2, D = rc.depth / 2
    this.nav = new Navigation(this.world.obstacles, { x0: -W - 0.2, x1: W + 1.5, z0: -D - 0.2, z1: D + 0.2 })

    // NPCs
    this.npcMgr = new NPCManager(this.scene, this.world, this.config)
    this.npcMgr.setNavigation(this.nav)
    this.npcMgr.spawn()
    $('loadbar').style.width = '70%'

    // player
    this.buildPlayer()

    // fire system
    if (this.config.enableFire !== false) this.buildFire()

    // interaction objects
    this.buildInteractables()

    // input
    this.bindInput()

    // siren
    this.buildSiren()

    $('loadbar').style.width = '90%'

    // draw initial HUD
    this.drawHUD()
    this.drawTVs()

    $('loadbar').style.width = '100%'

    // hide loading
    setTimeout(() => {
      $('loading').hidden = true
      this.banner(this.config.title || 'VIRTUAL OFFICE',
        'WASD or click floor to walk · Drag to rotate camera · Tab for phone')
    }, 350)

    // start loop
    requestAnimationFrame(() => this.frame())
  }

  // ── Player ──

  buildPlayer() {
    const THREE = this.THREE
    const cfg = this.config.player || {}
    this.player = createCharacter({
      shirt: cfg.shirt || '#2a7a5a',
      pants: cfg.pants || '#2b2f3a',
    })
    this.scene.add(this.player)

    const start = cfg.start || [6.2, -8]
    this.P.pos = new THREE.Vector3(start[0], 0, start[1])
    this.player.position.copy(this.P.pos)

    // seat marker ring
    const mySeat = this.world.resolveSeat(cfg.seat)
    if (mySeat) {
      this.mySeat = mySeat
      this.seatRing = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.52, 28),
        new THREE.MeshBasicMaterial({ color: '#f2b33d', transparent: true, opacity: 0.85, side: THREE.DoubleSide })
      )
      this.seatRing.rotation.x = -Math.PI / 2
      this.seatRing.position.set(mySeat.x - 0.1, 0.02, mySeat.z)
      this.scene.add(this.seatRing)

      // desk glow
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.29),
        new THREE.MeshBasicMaterial({ color: '#f2b33d', toneMapped: false })
      )
      glow.position.set(mySeat.x + 0.71, 1.02, mySeat.z)
      glow.rotation.y = -Math.PI / 2
      this.scene.add(glow)
      this.world.tag(glow, 'mydesk')
    }

    // APAR in hand (hidden)
    this.aparInHand = new THREE.Group()
    this.player.userData.armR.add(this.aparInHand)
    this.aparInHand.position.set(0.02, -0.62, 0.12)
    this.aparInHand.visible = false
    cyl(0.09, 0.09, 0.42, '#d8322a', 0, 0, 0, { parent: this.aparInHand })

    // held guitar (hidden)
    this.heldGuitar = new THREE.Group()
    this.player.userData.hips.add(this.heldGuitar)
    this.heldGuitar.position.set(0.04, 0.16, 0.2)
    this.heldGuitar.rotation.z = -0.5
    this.heldGuitar.visible = false
    const gb = cyl(0.2, 0.24, 0.09, '#c98a3c', 0, 0, 0, { parent: this.heldGuitar, seg: 14 })
    gb.rotation.x = Math.PI / 2
    cyl(0.06, 0.06, 0.02, '#2a1d12', 0, 0, 0.05, { parent: this.heldGuitar, seg: 10 })
    box(0.62, 0.055, 0.035, '#3b2a1a', -0.5, 0, 0, { parent: this.heldGuitar })
    box(0.12, 0.075, 0.04, '#2a1d12', -0.86, 0, 0, { parent: this.heldGuitar })
  }

  // ── Fire & Siren ──

  buildFire() {
    const THREE = this.THREE
    const fireTex = canvasTex(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
      g.addColorStop(0, 'rgba(255,240,180,1)')
      g.addColorStop(0.4, 'rgba(255,140,40,.8)')
      g.addColorStop(1, 'rgba(255,60,0,0)')
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64)
    })
    const smokeTex = canvasTex(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
      g.addColorStop(0, 'rgba(60,60,60,.7)')
      g.addColorStop(1, 'rgba(60,60,60,0)')
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64)
    })

    const row = this.config.deskRows?.[3]
    this.fireAt = new THREE.Vector3(row ? row.x + 0.42 : 5.5, 0.95, -1.8)
    this.fireGroup = new THREE.Group()
    this.fireGroup.position.copy(this.fireAt)
    this.scene.add(this.fireGroup)

    this.flames = []
    this.smokes = []
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
      s.userData = { ph: Math.random(), sp: 0.8 + Math.random() * 0.6, dx: (Math.random() - 0.5) * 0.4 }
      this.fireGroup.add(s); this.flames.push(s)
    }
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, depthWrite: false, transparent: true }))
      s.userData = { ph: Math.random() }
      this.fireGroup.add(s); this.smokes.push(s)
    }

    this.fireLight = new THREE.PointLight('#ff7a2a', 3, 6, 1.6)
    this.fireLight.position.set(0, 0.5, 0)
    this.fireGroup.add(this.fireLight)

    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.8), new THREE.MeshBasicMaterial({ visible: false }))
    hitbox.position.y = 0.4
    this.fireGroup.add(hitbox)
    this.world.tag(hitbox, 'fire')

    this.fireMode = 'fire' // 'fire' | 'smoke' | null
  }

  buildSiren() {
    const THREE = this.THREE
    if (!this.config.enableFire) return
    const tvs = this.config.tvs || []
    const lastTv = tvs[tvs.length - 1]
    if (!lastTv) return

    this.sirenGroup = new THREE.Group()
    this.sirenGroup.position.set(lastTv.x + 1.4, 2.65, -(this.config.room.depth / 2) + 0.15)
    this.scene.add(this.sirenGroup)
    this.sirenBulb = cyl(0.1, 0.12, 0.16,
      new THREE.MeshBasicMaterial({ color: '#ef5b4c' }),
      0, 0, 0, { parent: this.sirenGroup, cast: false }
    )
    this.sirenLight = new THREE.PointLight('#ff3020', 2.2, 7, 1.5)
    this.sirenLight.position.set(0, -0.2, 0.4)
    this.sirenGroup.add(this.sirenLight)
  }

  // ── Interactable objects ──

  buildInteractables() {
    const I = this.interactables
    const D = this.config.room.depth / 2
    const cfg = this.config

    const def = (id, o) => (I[id] = { id, ly: 2.3, ...o })

    // door
    const door = cfg.doors?.[0]
    if (door) {
      def('door', { name: 'Door', sub: 'Exit', pos: [door.x, -D], ap: [door.x, -D + 0.9], verb: 'Exit', panel: 'door' })
    }

    // TVs
    for (const tv of (cfg.tvs || [])) {
      def(tv.id, { name: tv.label, pos: [tv.x, -D + 0.1], ap: [tv.x, -D + 1.55], verb: 'Watch TV', panel: 'tv', ly: 2.95 })
    }

    // whiteboards
    for (const wb of (cfg.whiteboards || [])) {
      def(wb.id, { name: wb.title, pos: [wb.x, -D + 0.1], ap: [wb.x, -D + 1.55], verb: 'Read whiteboard', panel: 'whiteboard', ly: 0.3 })
    }

    // furniture
    const furn = cfg.furniture || {}
    const furnDefs = {
      locker:        { sub: 'Storage', ly: 2.0 },
      bookshelf:     { sub: 'Documentation', ly: 2.0 },
      serverRack:    { sub: 'Infrastructure', ly: 2.0 },
      coffeeStation: { sub: 'Coffee & AI', ly: 1.6 },
      shoeRack:      { sub: 'Appearance', ly: 1.6 },
      printer:       { sub: 'Export & Logs', ly: 1.6 },
      roundTable:    { sub: 'Meeting', ly: 1.6 },
      guitars:       { sub: 'Easter egg 🎸', ly: 1.6 },
    }

    for (const [key, fd] of Object.entries(furnDefs)) {
      const f = furn[key]
      if (!f) continue
      const panelCfg = cfg.panels?.[key]
      def(key, {
        name: f.label || key,
        sub: fd.sub,
        pos: [f.x, f.z],
        ap: [f.x + (f.x < 0 ? 1.0 : -1.0), f.z],
        verb: panelCfg?.title ? `Open ${panelCfg.title}` : `Interact with ${f.label || key}`,
        panel: key,
        ly: fd.ly,
      })
    }

    // APAR
    if (cfg.enableFire !== false) {
      def('apar', { name: 'Fire Extinguisher', sub: 'Quick action', pos: [1.9, -D + 0.2], ap: [1.9, -D + 1.3], verb: 'Pick up', ly: 1.6 })
    }

    // fire
    if (this.fireGroup) {
      def('fire', { name: 'Incident Fire', sub: '', pos: [this.fireAt.x, this.fireAt.z], ap: [this.fireAt.x + 1.3, this.fireAt.z + 0.6], verb: 'Extinguish', panel: 'fire', ly: 2.5 })
    }

    // player desk
    if (this.mySeat) {
      def('mydesk', { name: 'Your Desk', sub: 'Work station', pos: [this.mySeat.x, this.mySeat.z], ap: [this.mySeat.x - 0.6, this.mySeat.z], verb: 'Sit at your desk', panel: 'mydesk', seat: this.mySeat, ly: 2.0 })
    }

    // NPCs
    for (const npc of this.npcMgr.npcs) {
      const s = npc.seat
      const out = s.z > 7 ? [s.x, 6.3] : [s.x - Math.sin(s.rot) * 0.65, s.z]
      def(npc.id, { name: npc.name, sub: npc.role, pos: [s.x, s.z], ap: out, verb: 'Talk to ' + npc.name, panel: 'npc', npc, nolabel: true })
    }

    // build floating labels
    for (const o of Object.values(I)) {
      if (o.nolabel) continue
      o.label = textSprite(o.name, o.sub || '', { scale: 0.7 })
      o.label.position.set(o.pos[0], o.ly, o.pos[1] + (o.ly < 1 ? 0.45 : 0.25))
      this.scene.add(o.label)
    }

    // quest marker
    this.marker = new this.THREE.Mesh(
      new this.THREE.ConeGeometry(0.22, 0.45, 4),
      new this.THREE.MeshBasicMaterial({ color: '#f2b33d' })
    )
    this.marker.rotation.x = Math.PI
    this.scene.add(this.marker)

    // disco light
    this.disco = new this.THREE.PointLight('#ff4fd8', 0, 8, 1.3)
    this.disco.position.set(8, 2.4, 4.8)
    this.scene.add(this.disco)

    // music notes
    const noteTex = canvasTex(64, 64, (ctx) => {
      ctx.fillStyle = '#f2b33d'; ctx.font = '700 50px serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('♪', 32, 34)
    })
    this.notes = Array.from({ length: 10 }, (_, i) => {
      const s = new this.THREE.Sprite(new this.THREE.SpriteMaterial({ map: noteTex, transparent: true, depthWrite: false }))
      s.visible = false; s.scale.set(0.32, 0.32, 1)
      s.userData.ph = i / 10
      this.scene.add(s)
      return s
    })
  }

  // ── Input ──

  bindInput() {
    const cv = this.renderer.domElement
    const THREE = this.THREE
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()

    addEventListener('keydown', (e) => {
      const typing = e.target.closest?.('input, textarea')
      if (e.key === 'Escape') {
        if (this.panelOpen) this.closePanel()
        else if (this.phoneOpen) this.togglePhone(false)
        else if (this.CUT) this.endCut(true)
        else if (this.P.travel) { this.P.travel = null; this.P.path = null; this.clearRoute(); this.toast('Route cancelled') }
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') { e.preventDefault(); return }
      if (e.key === 'Tab' && !typing && !this.panelOpen) { e.preventDefault(); return this.togglePhone() }
      if (typing || this.panelOpen || this.CUT) return
      if (e.key === ' ' && this.P.travel) { e.preventDefault(); return this.skipTravel() }
      const k = e.key.toLowerCase()
      if (k === 'e' || k === 'f') {
        const c = this.candidates()
        const o = c[k === 'e' ? 0 : 1]
        if (o) this.interact(o)
        return
      }
      if (k === 'v') { this.camMode = this.camMode === 'follow' ? 'overview' : 'follow'; $('b-cam').innerHTML = `<kbd>V</kbd>Camera: ${this.camMode === 'follow' ? 'Follow' : 'Overview'}`; return }
      if (k === 'g') { this.toggleGfx(); return }
      if (k === 'l') { this.labelsOn = !this.labelsOn; return }
      if (k === 't') { const label = this.world.cycleSky(); this.toast('Time: ' + label); return }
      if (k === 'j') { const dancers = this.findDancers(this.candidates()); if (dancers) this.openDanceChoice(dancers); return }
      this.keys.add(k)
    })
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()))
    addEventListener('blur', () => this.keys.clear())

    // mouse
    cv.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY, moved: 0 }
      cv.setPointerCapture(e.pointerId)
    })
    cv.addEventListener('pointermove', (e) => {
      if (!this.drag) return
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y
      this.drag.moved += Math.abs(dx) + Math.abs(dy)
      this.drag.x = e.clientX; this.drag.y = e.clientY
      if (this.drag.moved > 6) {
        this.camYaw -= dx * 0.006
        this.camPitch = Math.max(0.12, Math.min(1.25, this.camPitch + dy * 0.004))
      }
    })
    cv.addEventListener('pointerup', (e) => {
      const d = this.drag; this.drag = null
      if (!d || d.moved > 6 || this.panelOpen || this.CUT) return
      ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1)
      ray.setFromCamera(ndc, this.camera)
      const hit = ray.intersectObjects([...this.world.clickables, this.world.floor], false)[0]
      if (!hit) return
      const id = hit.object.userData.inter
      if (id && this.interactables[id]) {
        const o = this.interactables[id]
        if (Math.hypot(this.P.pos.x - o.ap[0], this.P.pos.z - o.ap[1]) < 0.6) this.interact(o)
        else this.walkTo(o.ap[0], o.ap[1], o)
      } else if (hit.object === this.world.floor) {
        this.walkTo(hit.point.x, hit.point.z)
      }
    })
    cv.addEventListener('wheel', (e) => {
      this.camDist = Math.max(2.4, Math.min(9, this.camDist + e.deltaY * 0.004))
    }, { passive: true })

    // HUD buttons
    $('b-cam').onclick = () => {
      this.camMode = this.camMode === 'follow' ? 'overview' : 'follow'
      $('b-cam').innerHTML = `<kbd>V</kbd>Camera: ${this.camMode === 'follow' ? 'Follow' : 'Overview'}`
    }
    $('b-gfx').onclick = () => this.toggleGfx()
    $('b-phone').onclick = () => this.togglePhone()
    $('prompt').onclick = () => { const c = this.candidates(); if (c[0]) this.interact(c[0]) }

    // panel
    $('panel-wrap').addEventListener('click', (e) => {
      if (e.target === $('panel-wrap')) return this.closePanel()
      const a = e.target.closest('[data-act]')
      if (a?.dataset.act === 'close') this.closePanel()
      if (a?.dataset.act === 'shirt') this.player.userData.shirtM.color.set(a.dataset.v)
    })

    // phone
    $('phone').addEventListener('click', (e) => {
      const b = e.target.closest('[data-p]')
      if (!b) return
      const { p, v } = b.dataset
      if (p === 'view') { this.phoneView = v; this.renderPhone() }
      if (p === 'go') { this.togglePhone(false); this.travelTo(this.interactables[v], false) }
      if (p === 'open') { this.togglePhone(false); this.travelTo(this.interactables[v], true) }
    })
  }

  // ── Interaction ──

  candidates() {
    const out = []
    for (const o of Object.values(this.interactables)) {
      if (o.id === 'fire' && this.fireGroup && !this.fireGroup.visible) continue
      if (o.npc && o.npc.mode !== 'sit') continue
      const d = Math.min(
        Math.hypot(this.P.pos.x - o.ap[0], this.P.pos.z - o.ap[1]),
        Math.hypot(this.P.pos.x - o.pos[0], this.P.pos.z - o.pos[1]) - 0.7
      )
      if (d < 1.25) out.push([d, o])
    }
    return out.sort((a, b) => a[0] - b[0]).map(x => x[1])
  }

  interact(o) {
    if (!o) return
    this.P.path = null; this.P.pending = null
    this.P.yaw = Math.atan2(o.pos[0] - this.P.pos.x, o.pos[1] - this.P.pos.z)

    if (o.id === 'apar') {
      this.carry = !this.carry
      this.aparInHand.visible = this.carry
      if (this.world.apar) this.world.apar.visible = !this.carry
      this.toast(this.carry ? 'Fire extinguisher picked up. Bring it to the fire!' : 'Fire extinguisher returned.')
      return
    }

    if (o.id === 'guitars' && this.config.enableGuitarEasterEgg !== false) {
      this.startGuitar()
      return
    }

    if (o.id === 'fire' && this.carry) {
      this.toast('Fire suppressed! In a real app, mark the incident as resolved.')
    }

    if (o.seat) {
      this.P.seated = o.seat
      this.P.seatedFrom = o
      this.P.pos.set(o.seat.x - Math.sin(o.seat.rot) * 0.06, 0, o.seat.z - Math.cos(o.seat.rot) * 0.06)
      this.P.yaw = o.seat.rot
    }

    this.openPanel(o)
  }

  walkTo(x, z, then = null) {
    const path = this.nav.findPath(this.P.pos, { x, z })
    if (!path) return this.toast('No path found.')
    this.P.travel = null; this.clearRoute()
    this.P.onArrive = null; this.P.faceTo = null
    this.P.path = path; this.P.pending = then; this.P.stuck = 0
  }

  travelTo(o, open) {
    if (!o || this.CUT) return
    if (this.panelOpen) this.closePanel()
    const path = this.nav.findPath(this.P.pos, { x: o.ap[0], z: o.ap[1] })
    if (!path) return this.toast('No path found.')
    this.P.path = path; this.P.pending = null; this.P.onArrive = null
    this.P.faceTo = null; this.P.stuck = 0
    this.P.travel = { o, open, done: 0 }
    this.showRoute(path)
    this.toast(`Heading to ${o.name} · Press Space to skip`)
  }

  skipTravel() {
    const tr = this.P.travel
    if (!tr) return
    $('fade').classList.add('on')
    setTimeout(() => {
      this.P.pos.set(tr.o.ap[0], 0, tr.o.ap[1])
      this.P.path = null
      this.P.travel = null; this.clearRoute()
      if (tr.open) setTimeout(() => this.interact(tr.o), 250)
      $('fade').classList.remove('on')
    }, 220)
  }

  // ── Route visualization ──

  showRoute(path) {
    const THREE = this.THREE
    this.clearRoute()
    let prev = { x: this.P.pos.x, z: this.P.pos.z }
    let s = 0, idx = 0, next = 0.6
    const geo = new THREE.CircleGeometry(0.16, 3)
    this.chevMat = this.chevMat || new THREE.MeshBasicMaterial({ color: '#f2b33d', transparent: true, opacity: 0.9, depthWrite: false })
    for (const q of path) {
      const dx = q.x - prev.x, dz = q.z - prev.z, l = Math.hypot(dx, dz)
      while (l > 0 && next <= s + l) {
        const f = (next - s) / l
        let c = this.chevrons[idx]
        if (!c) {
          c = new THREE.Group()
          const m = new THREE.Mesh(geo, this.chevMat)
          m.rotation.x = -Math.PI / 2
          c.add(m)
          this.scene.add(c)
          this.chevrons.push(c)
        }
        c.position.set(prev.x + dx * f, 0.03, prev.z + dz * f)
        c.rotation.y = Math.atan2(-dz, dx)
        c.userData.s = next
        c.visible = true
        idx++; next += 0.6
      }
      s += l; prev = q
    }
    this.P.routeLen = s
  }

  clearRoute() {
    this.chevrons.forEach(c => (c.visible = false))
  }

  // ── Panels ──

  openPanel(o) {
    this.panelOpen = o
    const wrap = $('panel-wrap')
    wrap.hidden = false
    const cfg = this.config.panels?.[o.panel] || this.config.panels?.[o.id]
    const title = cfg?.title || o.name
    let body = cfg?.body || ''

    if (o.npc) {
      body = `<div class="msg">${esc(o.npc.status || o.npc.role)}</div><div class="note">${esc(o.npc.name)} — ${esc(o.npc.role)}</div>`
    }

    if (o.panel === 'mydesk' || o.id === 'mydesk') {
      const name = this.config.player?.name || 'Visitor'
      body = `<div class="tile"><div class="l">YOUR DESK</div><div class="v">${esc(name)}</div><div class="s">Seat ${esc(this.config.player?.seat || '—')}</div></div>`
      body += `<div class="note">In a real integration, this panel would show your tasks, merge requests, and calendar.</div>`
    }

    if (o.id === 'shoeRack' || o.panel === 'shoeRack') {
      body = `<div class="tile"><div class="l">Character Color</div>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        ${['#2a7a5a', '#3f7cc4', '#c4573f', '#e0b02a', '#7a3fc4', '#222831'].map(c =>
          `<button data-act="shirt" data-v="${c}" style="width:36px;height:36px;border-radius:50%;border:2px solid #000;background:${c};cursor:pointer"></button>`
        ).join('')}</div></div>`
    }

    if (!body) body = `<div class="note">This is ${esc(title)}. Connect your own data source here!</div>`

    wrap.innerHTML = `<div class="monitor" role="dialog">
      <div class="mon-head"><div style="flex:1"><div class="crumb">${esc(o.id)}</div><h3>${esc(title)}</h3></div>
      <button class="x" data-act="close">Esc ✕</button></div>
      <div class="mon-body">${body}</div>
      <div class="mon-foot">Virtual Office · ${esc(o.id)}</div></div>`

    $('prompt').hidden = true
    setTimeout(() => wrap.querySelector('.x')?.focus(), 50)
  }

  closePanel() {
    this.panelOpen = null
    const wrap = $('panel-wrap')
    wrap.hidden = true
    wrap.innerHTML = ''
    if (this.P.seated) {
      const o = this.P.seatedFrom
      this.P.seated = null
      if (o) this.P.pos.set(o.ap[0], 0, o.ap[1])
    }
  }

  // ── Phone ──

  togglePhone(force) {
    const show = force ?? !this.phoneOpen
    this.phoneOpen = show
    $('phone').hidden = !show
    if (show) { this.phoneView = 'home'; this.renderPhone() }
  }

  renderPhone() {
    const phone = $('phone')
    const now = new Date().toTimeString().slice(0, 5)
    let h = `<h4>${now} · ${esc(this.config.title || 'Office')}</h4>`

    if (this.phoneView === 'home') {
      const items = Object.values(this.interactables).filter(o => !o.npc || o.panel !== 'npc')
      h += `<div class="apps">
        <button class="app" data-p="view" data-v="maps">🗺 Maps <span>${items.length}</span></button>
        <button class="app" data-p="view" data-v="people">👥 People <span>${this.npcMgr.npcs.length}</span></button>
      </div>`
    } else if (this.phoneView === 'maps') {
      const items = Object.values(this.interactables).filter(o => (!o.npc || o.panel !== 'npc') && (o.id !== 'fire' || (this.fireGroup && this.fireGroup.visible)))
      h += `<div class="apps"><button class="app" data-p="view" data-v="home">← Back</button>
        ${items.map(o => `<button class="app" data-p="go" data-v="${o.id}">${esc(o.name)} <span>${esc(o.sub || '')}</span></button>`).join('')}</div>`
    } else if (this.phoneView === 'people') {
      h += `<div class="apps"><button class="app" data-p="view" data-v="home">← Back</button>
        ${this.npcMgr.npcs.map(n => `<button class="app" data-p="go" data-v="${n.id}">${esc(n.name)} <span>${esc(n.role)}</span></button>`).join('')}</div>`
    }
    phone.innerHTML = h
  }

  // ── HUD ──

  drawHUD() {
    try { this.world.updateSky() } catch(e) { console.error('updateSky fail:', e) }
    const d = new Date()
    if (!$('clock')) { console.error('NO CLOCK EL'); return }
    $('clock').textContent = d.toTimeString().slice(0, 5)
    const n = this.fireMode ? 1 : 0
    $('stars').innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('')
    $('stars-label').textContent = n ? `${n} active alert` : 'All clear'
    $('money').innerHTML = '<small>uptime </small>99.9%'
    $('quest-text').textContent = this.fireMode ? 'Active fire! Check the incident area' : 'All clear. Explore the office 👌'
    const name = this.config.player?.name || 'Visitor'
    $('p-name').textContent = name
    $('p-av').textContent = name.split(/[\s._]+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase()
    $('srcchip').textContent = '● Office Tour Mode'
  }

  drawTVs() {
    if (!this.world.tvTextures) return
    const tvs = this.config.tvs || []
    this.world.tvTextures.forEach((tex, i) => {
      const { ctx, w, h } = tex.userData
      ctx.fillStyle = '#0b0d10'; ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#f2b33d'; ctx.fillRect(0, 0, w, 4)
      ctx.fillStyle = '#9b9789'; ctx.font = '600 15px "JetBrains Mono", monospace'
      ctx.fillText((tvs[i]?.label || `TV ${i + 1}`).toUpperCase(), 16, 28)
      ctx.fillStyle = '#5fd08a'; ctx.beginPath(); ctx.arc(w - 22, 23, 5, 0, 7); ctx.fill()
      ctx.fillStyle = '#ece6d8'; ctx.font = '600 24px "Barlow Condensed"'
      ctx.fillText(tvs[i]?.content || 'No data source connected', 16, 100, w - 32)
      ctx.fillStyle = '#9b9789'; ctx.font = '14px "Barlow"'
      ctx.fillText('Connect your API in office.config.js', 16, 140, w - 32)
      tex.needsUpdate = true
    })
  }

  drawMinimap() {
    const mm = $('minimap').getContext('2d')
    const rc = this.config.room
    const W = rc.width / 2, D = rc.depth / 2
    const SC = 190 / (W * 2 + 2), OX = 5, OZ = 5
    const mx = x => (x + W + 0.5) * SC + OX
    const mz = z => (z + D + 0.5) * SC + OZ

    mm.fillStyle = '#1b1d22'; mm.fillRect(0, 0, 380, 280)
    mm.fillStyle = '#2c2f37'; mm.fillRect(mx(-W), mz(-D), W * 2 * SC, D * 2 * SC)
    mm.fillStyle = '#4a4e58'
    this.world.obstacles.forEach(b => mm.fillRect(mx(b.x0), mz(b.z0), (b.x1 - b.x0) * SC, (b.z1 - b.z0) * SC))

    // NPCs
    mm.fillStyle = '#9b9789'
    this.npcMgr.npcs.forEach(n => {
      mm.beginPath(); mm.arc(mx(n.person.position.x), mz(n.person.position.z), 4, 0, 7); mm.fill()
    })

    // route
    if (this.P.travel && this.P.path?.length) {
      mm.strokeStyle = '#f2b33d'; mm.lineWidth = 4; mm.beginPath()
      mm.moveTo(mx(this.P.pos.x), mz(this.P.pos.z))
      this.P.path.forEach(q => mm.lineTo(mx(q.x), mz(q.z)))
      mm.stroke()
    }

    // player
    mm.save()
    mm.translate(mx(this.P.pos.x), mz(this.P.pos.z))
    mm.rotate(-this.P.yaw + Math.PI)
    mm.fillStyle = '#5fd08a'; mm.beginPath()
    mm.moveTo(0, -10); mm.lineTo(7, 8); mm.lineTo(0, 4); mm.lineTo(-7, 8)
    mm.closePath(); mm.fill()
    mm.restore()
  }

  // ── Banners & toasts ──

  banner(title, sub, bad = false) {
    $('banner-t').textContent = title
    $('banner-s').textContent = sub || ''
    $('banner').className = bad ? 'bad' : ''
    $('banner').hidden = false
    const h2 = $('banner-t')
    h2.style.animation = 'none'; void h2.offsetWidth; h2.style.animation = ''
    clearTimeout(this.bannerTimeout)
    this.bannerTimeout = setTimeout(() => ($('banner').hidden = true), 2800)
  }

  toast(msg) {
    const el = $('toast')
    el.textContent = msg; el.hidden = false
    clearTimeout(this.toastTimeout)
    this.toastTimeout = setTimeout(() => (el.hidden = true), 2600)
  }

  // ── Graphics toggle ──

  toggleGfx() {
    const high = !this.renderer.shadowMap.enabled
    this.renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 1.75) : 1)
    this.renderer.shadowMap.enabled = high
    if (this.world.sunLight) this.world.sunLight.castShadow = high
    this.scene.traverse(m => { if (m.material) [].concat(m.material).forEach(x => (x.needsUpdate = true)) })
    $('b-gfx').innerHTML = `<kbd>G</kbd>GFX: ${high ? 'High' : 'Low'}`
  }

  // ── Dance / Guitar cutscenes ──

  findDancers(candidates) {
    const names = this.config.dancers || []
    return candidates.find(o => o.npc && names.includes(o.npc.name))?.npc || null
  }

  openDanceChoice(near) {
    const names = this.config.dancers || []
    const dancers = this.npcMgr.npcs.filter(n => names.includes(n.name))
    if (dancers.length < 1) return

    const name1 = near.name
    const name2 = dancers.find(d => d.name !== near.name)?.name
    const opts = name2
      ? [`${name1} solo`, `${name2} solo`, `${name1} + ${name2}`, `Everyone + you!`]
      : [`${name1} solo`, `${name1} + you!`]

    let html = '<div class="q">💃 Dance break! Who dances?</div>'
    opts.forEach((o, i) => { html += `<button data-c="${i}"><kbd>${i + 1}</kbd>${esc(o)}</button>` })
    html += `<div class="hint">${this.audio.jjDuration()} seconds · Esc to cancel</div>`

    const choice = $('choice')
    choice.innerHTML = html
    choice.hidden = false
    choice._dancers = dancers
    choice._near = near
    $('prompt').hidden = true

    choice.onclick = (e) => {
      const btn = e.target.closest('[data-c]')
      if (!btn) return
      choice.hidden = true
      const idx = +btn.dataset.c
      const list = []
      if (name2) {
        if (idx === 0) list.push(near)
        else if (idx === 1) list.push(dancers.find(d => d.name === name2))
        else { list.push(...dancers) }
      } else {
        list.push(near)
      }
      const join = name2 ? idx === 3 : idx === 1
      this.startJJ(list.filter(Boolean), join)
    }
    addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { choice.hidden = true; removeEventListener('keydown', handler) }
      if (['1', '2', '3', '4'].includes(e.key) && !choice.hidden) { choice.querySelector(`[data-c="${+e.key - 1}"]`)?.click(); removeEventListener('keydown', handler) }
    })
  }

  startJJ(list, join) {
    if (this.CUT || !list.length) return
    const JJ_CENTER = { x: 8.0, z: 4.8 }
    const spots = join
      ? [[6.9, 4.95], [9.1, 4.95]]
      : list.length > 1 ? [[7.4, 4.8], [8.6, 4.8]] : [[8.0, 4.8]]

    this.CUT = { kind: 'jj', phase: 'gather', t0: this.t, list, join }

    list.forEach((npc, i) => {
      npc.face = Math.PI; npc.mirror = i === 1; npc.ready = false
      this.npcMgr.goTo(npc, spots[i]?.[0] ?? 8, spots[i]?.[1] ?? 4.8, () => { npc.ready = true; npc.mode = 'stand' })
    })

    if (join) {
      this.CUT.pReady = false
      this.P.travel = null; this.clearRoute(); this.P.pending = null
      this.P.path = this.nav.findPath(this.P.pos, { x: 8.0, z: 4.65 })
      this.P.onArrive = () => { if (this.CUT) this.CUT.pReady = true }
      if (!this.P.path) this.CUT.pReady = true
    }

    this.toast(`${list[0].name}: Let's dance! ${this.audio.jjDuration()} seconds 😆`)
  }

  beginPerform() {
    this.CUT.phase = 'perform'; this.CUT.t1 = this.t
    if (this.CUT.kind === 'jj') {
      this.CUT.list.forEach(npc => {
        if (!npc.ready) { const last = npc.path?.at(-1); if (last) npc.person.position.set(last.x, 0, last.z) }
        npc.path = []; npc.then = null; npc.mode = 'dance'; npc.person.rotation.y = npc.face
      })
      if (this.CUT.join) {
        this.P.path = null; this.P.onArrive = null
        this.P.pos.set(8.0, 0, 4.65); this.P.yaw = Math.PI; this.P.dance = true
      }
      this.audio.startMusic(this.CUT)
      this.CUT.noteAt = { x: 8.0, y: 1.0, z: 4.8 }
    }
  }

  startGuitar() {
    if (this.CUT) return
    const o = this.interactables.guitars
    if (!o) return
    this.P.path = null; this.P.travel = null; this.clearRoute()
    this.P.pos.set(o.ap[0], 0, o.ap[1])
    this.P.yaw = Math.atan2(8 - o.ap[0], 4 - o.ap[1])
    if (this.world.guitarsGroup?.children[0]) this.world.guitarsGroup.children[0].visible = false
    this.heldGuitar.visible = true; this.P.guitar = true
    this.CUT = { kind: 'guitar', phase: 'perform', t0: this.t, t1: this.t, noteAt: { x: o.ap[0], y: 0.2, z: o.ap[1] } }
    this.CUT.out = this.audio.playGuitar()
    this.CUT.aT0 = this.audio.ctx ? this.audio.ctx.currentTime + 0.08 : null
    this.CUT.dur = 5
    this.toast(`${this.config.player?.name || 'You'}: Time for a song! 🎸`)
  }

  endCut(skipped = false) {
    if (!this.CUT) return
    const c = this.CUT; this.CUT = null
    this.disco.intensity = 0
    this.notes.forEach(s => (s.visible = false))
    if (skipped) { try { c.src?.stop() } catch {}; c.out?.disconnect() }
    if (c.kind === 'jj') {
      c.list.forEach(n => this.npcMgr.sendHome(n))
      this.P.dance = false; this.P.onArrive = null
      if (c.join && c.phase === 'gather') this.P.path = null
      if (c.phase === 'perform' && !skipped) this.banner('Dance complete!', 'Great moves! 💃')
      else this.toast('Dance cancelled')
    } else {
      if (this.world.guitarsGroup?.children[0]) this.world.guitarsGroup.children[0].visible = true
      this.heldGuitar.visible = false; this.P.guitar = false
      if (!skipped) this.banner('Encore!', 'Achievement: Office Band 🎸')
      else this.toast('Song stopped')
    }
  }

  musicTime() {
    return this.CUT?.aT0 != null && this.audio.ctx
      ? this.audio.ctx.currentTime - this.CUT.aT0
      : this.t - (this.CUT?.t1 || 0)
  }

  beatInfo() {
    if (!this.CUT || this.CUT.phase !== 'perform' || !this.CUT.grid) return { b: 0, endB: 10, hype: 1 }
    const mt = this.musicTime(), g = this.CUT.grid
    const hype = g.env ? 0.7 + 0.6 * g.env[Math.min(g.env.length - 1, Math.max(0, Math.floor((mt + g.start) / g.hop)))] : 1
    return { b: (mt + g.start - g.first) / g.period, endB: (g.start + this.CUT.dur - g.first) / g.period, hype }
  }

  updateCut() {
    if (!this.CUT) return
    if (this.CUT.phase === 'gather') {
      if ((this.CUT.list.every(n => n.ready) && (!this.CUT.join || this.CUT.pReady)) || this.t - this.CUT.t0 > 6) {
        this.beginPerform()
      }
      return
    }
    const elapsed = Math.max(0, this.musicTime())
    if (this.CUT.kind === 'jj') {
      const bb = this.beatInfo().b
      const fr = bb - Math.floor(bb)
      this.disco.intensity = bb < 0 ? 1 : 1.2 + (1 - fr) * 3
      this.disco.color.setHSL((Math.floor(Math.max(0, bb)) * 0.137) % 1, 1, 0.55)
    }
    // floating notes
    this.notes.forEach((s, i) => {
      const y = (s.userData.ph + this.t * 0.45) % 1
      s.visible = true; s.material.opacity = 1 - y
      s.position.set(
        this.CUT.noteAt.x + Math.sin(i * 2.1 + this.t) * 0.7,
        (this.CUT.kind === 'jj' ? 1.6 : 1.4) + y * 1.3,
        this.CUT.noteAt.z + Math.cos(i * 1.7 + this.t * 0.5) * 0.4
      )
    })
    if (elapsed >= this.CUT.dur) this.endCut()
  }

  // ── Game loop ──

  frame() {
    const THREE = this.THREE
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.t += dt
    const t = this.t

    // ── player movement ──
    let moving = false
    const run = this.keys.has('shift') || !!this.P.travel
    const locked = this.panelOpen || this.P.seated || this.CUT?.phase === 'perform' || this.P.guitar

    if (!locked) {
      const f = { x: -Math.sin(this.camYaw), z: -Math.cos(this.camYaw) }
      const r = { x: -f.z, z: f.x }
      const K = this.CUT ? new Set() : this.keys
      const fw = (K.has('w') || K.has('arrowup') ? 1 : 0) - (K.has('s') || K.has('arrowdown') ? 1 : 0)
      const st = (K.has('d') || K.has('arrowright') ? 1 : 0) - (K.has('a') || K.has('arrowleft') ? 1 : 0)
      let vx = f.x * fw + r.x * st, vz = f.z * fw + r.z * st

      if (vx || vz) {
        if (this.P.travel) { this.P.travel = null; this.clearRoute(); this.toast('Route cancelled') }
        this.P.path = null; this.P.pending = null; this.P.onArrive = null; this.P.faceTo = null
      } else if (this.P.path?.length) {
        const n = this.P.path[0]
        vx = n.x - this.P.pos.x; vz = n.z - this.P.pos.z
        if (Math.hypot(vx, vz) < 0.12) { this.P.path.shift(); vx = vz = 0 }
      }

      if (this.P.path && !this.P.path.length) {
        this.P.path = null
        if (this.P.travel) {
          const tr = this.P.travel; this.P.travel = null; this.clearRoute()
          this.P.faceTo = Math.atan2(tr.o.pos[0] - this.P.pos.x, tr.o.pos[1] - this.P.pos.z)
          if (tr.open) setTimeout(() => this.interact(tr.o), 250)
        }
        if (this.P.pending) { const o = this.P.pending; this.P.pending = null; this.interact(o) }
        if (this.P.onArrive) { const fn = this.P.onArrive; this.P.onArrive = null; fn() }
      }

      const len = Math.hypot(vx, vz)
      if (len > 0.001) {
        const sp = this.P.travel ? 5.5 : run ? 5 : 2.8
        const stepL = Math.min(sp * dt, this.P.path ? len : Infinity)
        const before = this.P.pos.clone()
        this.P.pos.x += (vx / len) * stepL
        this.P.pos.z += (vz / len) * stepL
        this.nav.collide(this.P.pos)
        const moved = before.distanceTo(this.P.pos)
        if (this.P.travel) this.P.travel.done += moved
        if (this.P.path && moved < stepL * 0.2 && (this.P.stuck = (this.P.stuck || 0) + dt) > 1) this.P.path = []
        const target = Math.atan2(vx, vz)
        let dy = target - this.P.yaw
        dy = Math.atan2(Math.sin(dy), Math.cos(dy))
        this.P.yaw += dy * Math.min(1, dt * 12)
        moving = true
        if (this.P.travel) {
          let cy = this.P.yaw + Math.PI - this.camYaw
          cy = Math.atan2(Math.sin(cy), Math.cos(cy))
          this.camYaw += cy * Math.min(1, dt * 2.5)
        }
      } else if (this.P.faceTo != null) {
        let dy = this.P.faceTo - this.P.yaw
        dy = Math.atan2(Math.sin(dy), Math.cos(dy))
        this.P.yaw += dy * Math.min(1, dt * 8)
        if (Math.abs(dy) < 0.02) this.P.faceTo = null
      }
    }

    this.player.position.copy(this.P.pos)
    this.player.rotation.y = this.P.yaw
    const pst = this.P.guitar ? 'guitar' : this.P.dance ? 'dance' : this.P.seated ? 'type' : moving ? (run ? 'run' : 'walk') : 'idle'
    animateCharacter(this.player, pst, t, {
      carry: this.carry && pst !== 'dance' && pst !== 'guitar' && !this.P.seated,
      ph: 0,
      ...(pst === 'dance' ? this.beatInfo() : {}),
      base: this.P.yaw,
    })

    // ── NPCs ──
    this.npcMgr.npcs.forEach(n => { if (n.mode === 'dance') n.beatInfo = this.beatInfo() })
    this.npcMgr.update(t, dt)

    // ── Cutscene ──
    this.updateCut()

    // ── Chevrons ──
    this.chevrons.forEach(c => { if (c.visible && this.P.travel && c.userData.s < this.P.travel.done + 0.4) c.visible = false })
    if (this.chevMat) this.chevMat.opacity = 0.55 + Math.sin(t * 6) * 0.3

    // ── World effects ──
    this.world.update(t)

    // fire
    if (this.fireGroup && this.fireMode) {
      this.flames.forEach(s => {
        const y = (s.userData.ph + t * s.userData.sp) % 1
        s.position.set(s.userData.dx * (1 - y), y * 0.9, 0)
        const sc = (1 - y) * 0.55 + 0.12
        s.scale.set(sc, sc * 1.3, 1)
        s.material.opacity = 1 - y
      })
      this.smokes.forEach(s => {
        const y = (s.userData.ph + t * 0.25) % 1
        s.position.set(Math.sin(t + s.userData.ph * 9) * 0.2, 0.7 + y * 1.6, 0)
        const sc = 0.4 + y * 0.9
        s.scale.set(sc, sc, 1)
        s.material.opacity = (1 - y) * 0.5
      })
      this.fireLight.intensity = this.fireMode === 'fire' ? 2.4 + Math.sin(t * 23) * 0.6 + Math.sin(t * 7) * 0.5 : 0
    }

    // siren
    if (this.sirenBulb && this.fireMode) {
      this.sirenBulb.rotation.y += dt * 8
      this.sirenLight.intensity = Math.sin(t * 9) > 0 ? 2.4 : 0.2
      this.sirenBulb.material.color.set(Math.sin(t * 9) > 0 ? '#ff3a2a' : '#6a1a14')
    } else if (this.sirenBulb) {
      this.sirenLight.intensity = 0
      this.sirenBulb.material.color.set('#3a3d45')
    }

    // LEDs
    if ((this.acc.led += dt) > 0.35) {
      this.acc.led = 0
      this.world.leds.forEach(l => (l.visible = Math.random() > 0.15))
    }

    // seat ring
    if (this.seatRing) this.seatRing.material.opacity = 0.5 + Math.sin(t * 3) * 0.35

    // marker
    this.marker.visible = !!this.fireMode && !this.panelOpen
    if (this.fireMode && this.fireAt) {
      this.marker.position.set(this.fireAt.x, 3.0 + Math.sin(t * 3) * 0.12, this.fireAt.z)
      this.marker.rotation.y = t * 2
    }

    // labels
    Object.values(this.interactables).forEach(o => {
      if (o.label) {
        o.label.visible = this.labelsOn && Math.hypot(this.P.pos.x - o.pos[0], this.P.pos.z - o.pos[1]) < 8.5 && (o.id !== 'fire' || (this.fireGroup && this.fireGroup.visible))
      }
    })
    this.npcMgr.npcs.forEach(n => (n.bubble.visible = this.labelsOn && Math.hypot(this.P.pos.x - n.person.position.x, this.P.pos.z - n.person.position.z) < 11))

    // ── Camera ──
    const tmp = new THREE.Vector3()
    if (this.CUT?.phase === 'perform') {
      // cinematic cam
      const bi = this.beatInfo()
      const k = Math.min(1, Math.max(0, this.musicTime()) / this.CUT.dur)
      if (this.CUT.kind === 'jj') {
        const cx = 8.0, cz = 4.8
        const a = -0.2 + 0.4 * k, r2 = 3.4 - 0.6 * k
        tmp.set(cx + Math.sin(a) * r2, 1.65, cz - Math.cos(a) * r2)
        this.camLook.lerp(new THREE.Vector3(cx, 1.05, cz), 0.1)
      } else {
        const g = this.P.yaw + (k - 0.5) * 0.5, r2 = 2.6 - 0.8 * k
        tmp.set(this.P.pos.x + Math.sin(g) * r2, 1.4, this.P.pos.z + Math.cos(g) * r2)
        this.camLook.lerp(new THREE.Vector3(this.P.pos.x, 1.15, this.P.pos.z), 0.1)
      }
      this.camPos.lerp(tmp, 0.06)
    } else if (this.panelOpen) {
      const s = this.P.seated, o = this.panelOpen
      if (s) {
        tmp.set(s.x - Math.sin(s.rot) * 0.9, 1.75, s.z - Math.cos(s.rot) * 0.9)
        this.camLook.lerp(new THREE.Vector3(s.x + Math.sin(s.rot) * 1, 1.0, s.z + Math.cos(s.rot) * 1), 0.12)
      } else if (o) {
        const dx2 = o.ap[0] - o.pos[0], dz2 = o.ap[1] - o.pos[1], l2 = Math.hypot(dx2, dz2) || 1
        tmp.set(o.ap[0] + dx2 / l2 * 1.4, 1.9, o.ap[1] + dz2 / l2 * 1.4)
        this.camLook.lerp(new THREE.Vector3(o.pos[0], 1.1, o.pos[1]), 0.12)
      }
      this.camPos.lerp(tmp, 0.08)
    } else if (this.camMode === 'overview') {
      this.camPos.lerp(tmp.set(0.6, 25, 12.5), 0.06)
      this.camLook.lerp(tmp.set(0.6, 0, 0.6), 0.1)
    } else {
      const h = Math.cos(this.camPitch) * this.camDist
      tmp.set(
        this.P.pos.x + Math.sin(this.camYaw) * h,
        1.5 + Math.sin(this.camPitch) * this.camDist,
        this.P.pos.z + Math.cos(this.camYaw) * h
      )
      const rc = this.config.room
      const W = rc.width / 2, D2 = rc.depth / 2
      tmp.x = Math.max(-W + 0.25, Math.min(tmp.z > 4.9 ? W + 1.0 : W - 0.2, tmp.x))
      tmp.z = Math.max(-D2 + 0.25, Math.min(D2 - 0.25, tmp.z))
      this.camPos.lerp(tmp, 1 - Math.pow(0.0015, dt))
      this.camLook.lerp(tmp.set(this.P.pos.x, 1.35, this.P.pos.z), 1 - Math.pow(0.0001, dt))
    }

    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.camLook)

    // ── Interaction prompt ──
    const cands = this.panelOpen || this.phoneOpen || this.CUT || this.P.travel ? [] : this.candidates()
    const pr = $('prompt')
    pr.hidden = !cands.length
    if (cands.length) {
      const verb0 = cands[0].id === 'apar' ? (this.carry ? 'Return extinguisher' : 'Pick up extinguisher') : cands[0].verb || 'Interact'
      let html = `<kbd>E</kbd>${esc(verb0)}<small>${esc(cands[0].name)}</small>`
      if (cands[1]) html += `<div style="margin-top:6px"><kbd>F</kbd>${esc(cands[1].verb || 'Interact')}<small>${esc(cands[1].name)}</small></div>`
      const dancer = this.findDancers(cands)
      if (dancer) html += `<div style="margin-top:6px"><kbd>J</kbd>Dance break! 💃<small>${this.audio.jjDuration()}s</small></div>`
      if (pr._h !== html) { pr.innerHTML = html; pr._h = html }
    }

    // ── Throttled updates ──
    if ((this.acc.tv += dt) > 1) { this.acc.tv = 0; this.drawTVs() }
    if ((this.acc.mm += dt) > 0.1) { this.acc.mm = 0; this.drawMinimap() }
    if ((this.acc.hud += dt) > 1) { this.acc.hud = 0; this.drawHUD() }

    // FPS
    this.acc.frames++
    if ((this.acc.fps += dt) > 1) {
      $('fps').hidden = false
      $('fps').textContent = `${this.acc.frames} fps · ${this.renderer.info.render.calls} draw calls`
      this.acc.frames = 0; this.acc.fps = 0
    }

    this.renderer.render(this.scene, this.camera)
    requestAnimationFrame(() => this.frame())
  }
}
