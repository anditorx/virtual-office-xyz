// ─── World: room geometry, furniture, sky, cityscape ────────────────────────

import { box, cyl, canvasTex, mat, instanced, textSprite, getTHREE } from './utils.js'

export class World {
  constructor(scene, config) {
    this.scene = scene
    this.config = config
    this.obstacles = []
    this.chairs = []
    this.monitors = []
    this.clickables = []
    this.interactiveMap = {}
    this.leds = []
    this.cityMats = []
    this.skyTex = null
    this.skyNow = null
    this.skyOverride = null
    this.sunLight = null
    this.floor = null
  }

  build() {
    const THREE = getTHREE()
    const { scene, config } = this
    const rc = config.room
    const W = rc.width / 2
    const D = rc.depth / 2
    const H = rc.wallHeight
    const C = {
      wall: rc.wallColor,
      accent: rc.accentWallColor || rc.wallColor,
      wood: '#e9b78f',
      woodDark: '#c99670',
      chair: '#1d1e22',
      black: '#121316',
    }

    // ── Lighting ──
    scene.add(new THREE.HemisphereLight('#fff1dc', '#3a3530', 1.15))
    this.sunLight = new THREE.DirectionalLight('#ffe2b0', 1.55)
    this.sunLight.position.set(-6, 14, 16)
    this.sunLight.castShadow = true
    this.sunLight.shadow.mapSize.set(2048, 2048)
    Object.assign(this.sunLight.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 45 })
    this.sunLight.shadow.bias = -0.0006
    scene.add(this.sunLight)

    // ── Floor ──
    const floorTex = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = rc.floorColor || '#43454a'
      ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < 9000; i++) {
        const v = (50 + Math.random() * 40) | 0
        ctx.fillStyle = `rgba(${v},${v + 2},${v + 6},.55)`
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
      }
    })
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping
    floorTex.repeat.set(7, 5)
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 2 + 1.35, D * 2),
      new THREE.MeshLambertMaterial({ map: floorTex })
    )
    this.floor.rotation.x = -Math.PI / 2
    this.floor.position.set(0.675, 0, 0)
    this.floor.receiveShadow = true
    this.floor.userData.floor = true
    scene.add(this.floor)

    // ── Walls ──
    const wall = (x0, x1, z0, z1, c = C.wall, h = H) => {
      const bx = box(
        Math.abs(x1 - x0) || 0.3, h, Math.abs(z1 - z0) || 0.3, c,
        (x0 + x1) / 2, h / 2, (z0 + z1) / 2
      )
      scene.add(bx)
      this.block(x0 - 0.15, x1 + 0.15, z0 - 0.15, z1 + 0.15)
    }

    const doorCfg = config.doors?.[0]
    const doorX = doorCfg?.x ?? 6.2
    const doorW = doorCfg?.width ?? 1.6
    const doorLeft = doorX - doorW / 2
    const doorRight = doorX + doorW / 2

    // front wall (with door gap)
    wall(-W - 0.15, doorLeft, -D - 0.15, -D - 0.15)
    wall(doorRight, W + 0.15, -D - 0.15, -D - 0.15)
    // left wall
    wall(-W - 0.15, -W - 0.15, -D - 0.15, D + 0.15)
    // right wall (accent)
    wall(W + 0.15, W + 0.15, -D - 0.15, 4.8, C.accent)
    // printer alcove
    wall(W + 0.15, W + 1.35, 4.8, 4.8, C.accent)
    wall(W + 1.35, W + 1.35, 4.8, D + 0.15, C.accent)

    // back wall with window
    const win = config.windows?.[0]
    if (win) {
      const WX0 = win.from, WX1 = win.to, SILL = win.sillHeight, HEAD = win.headHeight
      const WCX = (WX0 + WX1) / 2, WW = WX1 - WX0
      wall(-W - 0.15, WX0, D + 0.15, D + 0.15)
      wall(WX1, W + 1.35, D + 0.15, D + 0.15)
      const sillBox = box(WW, SILL, 0.3, C.wall, WCX, SILL / 2, D + 0.15)
      scene.add(sillBox)
      const topBox = box(WW, H - HEAD, 0.3, C.wall, WCX, (HEAD + H) / 2, D + 0.15)
      scene.add(topBox)
      this.block(WX0, WX1, D, D + 0.3)
      // window frame
      const frameMat = '#1e2126'
      const fb = box(WW, 0.06, 0.14, frameMat, WCX, SILL + 0.03, D + 0.04)
      scene.add(fb)
      const ft = box(WW, 0.06, 0.14, frameMat, WCX, HEAD - 0.03, D + 0.04)
      scene.add(ft)
      for (let i = 0; i <= 12; i++) {
        const mullion = box(0.07, HEAD - SILL, 0.12, frameMat, WX0 + (WW / 12) * i, (SILL + HEAD) / 2, D + 0.04)
        scene.add(mullion)
      }
      // glass
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(WW, HEAD - SILL),
        new THREE.MeshBasicMaterial({ color: '#bcd8ea', transparent: true, opacity: 0.07, depthWrite: false })
      )
      glass.position.set(WCX, (SILL + HEAD) / 2, D + 0.1)
      glass.rotation.y = Math.PI
      scene.add(glass)
    } else {
      wall(-W - 0.15, W + 1.35, D + 0.15, D + 0.15)
    }

    // door threshold block
    this.block(doorLeft - 0.1, doorRight + 0.1, -D - 0.6, -D)
    // door frame + leaf
    const doorFrame = box(0.1, 2.2, 0.1, C.black, doorLeft, 1.1, -D - 0.1)
    scene.add(doorFrame)
    const doorFrame2 = box(0.1, 2.2, 0.1, C.black, doorRight, 1.1, -D - 0.1)
    scene.add(doorFrame2)
    const doorTop = box(doorW, 0.12, 0.12, C.black, doorX, 2.2, -D - 0.1)
    scene.add(doorTop)
    const doorLeaf = box(0.06, 2.1, 1.1, '#a8865f', doorLeft + 0.1, 1.05, -D + 0.3)
    doorLeaf.rotation.y = 0.5
    scene.add(doorLeaf)
    this.tag(doorLeaf, 'door')

    // ── Build desk rows ──
    const SZ = [-5.9, -3.9, -1.8, 0.4, 2.4]
    const seatOf = (tx, side, i) => ({
      x: tx + (side === 'L' ? -1.15 : 1.15),
      z: SZ[i],
      rot: side === 'L' ? Math.PI / 2 : -Math.PI / 2,
      side, tableX: tx,
    })

    for (const row of (config.deskRows || [])) {
      const tx = row.x
      const len = row.length || 10.6
      // table top
      const top = box(1.5, 0.06, len, C.wood, tx, 0.74, row.z)
      scene.add(top)
      // end panels
      const ep1 = box(1.4, 0.72, 0.06, C.woodDark, tx, 0.36, row.z - len / 2 - 0.05)
      scene.add(ep1)
      const ep2 = box(1.4, 0.72, 0.06, C.woodDark, tx, 0.36, row.z + len / 2 + 0.05)
      scene.add(ep2)
      // center divider
      const div = box(0.08, 0.5, len - 0.2, C.woodDark, tx, 0.45, row.z, { cast: false })
      scene.add(div)
      this.block(tx - 0.75, tx + 0.75, row.z - len / 2 - 0.1, row.z + len / 2 + 0.1)

      for (const side of ['L', 'R']) {
        SZ.forEach((z, i) => {
          const seat = seatOf(tx, side, i)
          seat.rowId = row.id
          seat.seatIndex = i
          this.chairs.push(seat)
          this.monitors.push({
            x: tx + (side === 'L' ? -0.42 : 0.42),
            z,
            rot: seat.rot + Math.PI,
          })
        })
      }
    }

    // ── Head desks ──
    for (const desk of (config.headDesks || [])) {
      const dw = desk.width || 2.3
      const dTop = box(dw, 0.06, 1.0, C.wood, desk.x, 0.74, desk.z)
      scene.add(dTop)
      const dL = box(0.06, 0.72, 0.9, C.woodDark, desk.x - dw / 2 + 0.05, 0.36, desk.z)
      scene.add(dL)
      const dR = box(0.06, 0.72, 0.9, C.woodDark, desk.x + dw / 2 - 0.05, 0.36, desk.z)
      scene.add(dR)
      const dP = box(dw - 0.1, 0.5, 0.04, C.woodDark, desk.x, 0.45, desk.z - 0.45)
      scene.add(dP)
      this.block(desk.x - dw / 2, desk.x + dw / 2, desk.z - 0.5, desk.z + 0.5)

      const seat = { x: desk.x, z: desk.z + 0.9, rot: Math.PI, deskId: desk.id }
      this.chairs.push(seat)
      this.monitors.push({ x: desk.x, z: desk.z - 0.2, rot: 0 })
    }

    // partition between head desks
    const partBox = box(0.12, 1.5, 3.3, '#2b2e35', -0.75, 0.75, 7.45)
    scene.add(partBox)
    this.block(-0.85, -0.65, 5.8, 9.1)

    // ── Furniture ──
    this.buildFurniture(C)

    // ── TVs ──
    this.tvTextures = []
    for (const tv of (config.tvs || [])) {
      const tvTex = canvasTex(512, 288, () => {})
      this.tvTextures.push(tvTex)
      const frame = box(2.4, 1.4, 0.08, C.black, tv.x, 2.05, -D + 0.04)
      scene.add(frame)
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(2.26, 1.27),
        new THREE.MeshBasicMaterial({ map: tvTex, toneMapped: false })
      )
      screen.position.set(tv.x, 2.05, -D + 0.09)
      scene.add(screen)
      this.tag(screen, tv.id)
    }

    // ── Whiteboards ──
    this.wbTextures = []
    const NOTE_C = ['#ffe36e', '#9fe0a8', '#ffb3c1', '#9fd0ff']
    for (const wb of (config.whiteboards || [])) {
      const tex = canvasTex(512, 220, (ctx, w, h) => {
        ctx.fillStyle = '#f4f3ee'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#222'
        ctx.font = '700 34px "Barlow Condensed", sans-serif'
        ctx.fillText(wb.title, 18, 42, 330)
        ;(wb.notes || []).slice(0, 4).forEach((n, i) => {
          ctx.save()
          ctx.translate(20 + i * 122, 70)
          ctx.rotate((i % 2 ? 1 : -1) * 0.04)
          ctx.fillStyle = NOTE_C[i]
          ctx.fillRect(0, 0, 108, 108)
          ctx.fillStyle = '#333'
          ctx.font = '600 20px "Barlow", sans-serif'
          String(n).split(' ').slice(0, 4).forEach((wd, j) => ctx.fillText(wd, 8, 28 + j * 24, 94))
          ctx.restore()
        })
      })
      this.wbTextures.push(tex)
      const wbMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.8, 0.05),
        [mat('#ddd'), mat('#ddd'), mat('#ddd'), mat('#ddd'), new THREE.MeshLambertMaterial({ map: tex }), mat('#ddd')]
      )
      wbMesh.position.set(wb.x, 0.95, -D + 0.07)
      wbMesh.castShadow = true
      scene.add(wbMesh)
      this.tag(wbMesh, wb.id)
    }

    // ── Instanced chairs & monitors ──
    instanced(new THREE.BoxGeometry(0.5, 0.08, 0.5), mat(C.chair), this.chairs, new THREE.Vector3(0, 0.47, 0), scene)
    instanced(new THREE.BoxGeometry(0.48, 0.55, 0.07), mat(C.chair), this.chairs, new THREE.Vector3(0, 0.82, -0.25), scene)
    instanced(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 6), mat('#444'), this.chairs, new THREE.Vector3(0, 0.24, 0), scene)
    instanced(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 5), mat('#2a2a2a'), this.chairs, new THREE.Vector3(0, 0.04, 0), scene)
    instanced(new THREE.BoxGeometry(0.56, 0.34, 0.04), mat('#16171a'), this.monitors, new THREE.Vector3(0, 1.02, 0), scene)
    instanced(new THREE.BoxGeometry(0.06, 0.2, 0.06), mat('#333'), this.monitors, new THREE.Vector3(0, 0.84, -0.04), scene)
    instanced(new THREE.BoxGeometry(0.24, 0.02, 0.16), mat('#333'), this.monitors, new THREE.Vector3(0, 0.78, -0.04), scene)

    // ── APAR (fire extinguisher) ──
    if (config.enableFire !== false) {
      this.apar = new THREE.Group()
      this.apar.position.set(1.9, 0, -D + 0.2)
      scene.add(this.apar)
      const aparBody = cyl(0.11, 0.11, 0.55, '#d8322a', 0, 0.33, 0, { parent: this.apar })
      const aparTop = cyl(0.04, 0.04, 0.1, C.black, 0, 0.66, 0, { parent: this.apar })
      const aparNozzle = box(0.05, 0.05, 0.18, C.black, 0, 0.66, 0.08, { parent: this.apar })
      // sign on wall
      const aparSign = box(0.35, 0.35, 0.02, '#d8322a', 1.9, 1.3, -D - 0.08)
      scene.add(aparSign)
      this.tag(this.apar, 'apar')
    }

    // ── Cityscape ──
    if (config.enableCityscape !== false) {
      this.buildCityscape()
    }

    // ── Sky ──
    if (config.enableDayNight !== false) {
      this.buildSky()
    }

    // ── Ori robot at coffee station ──
    const furn = config.furniture
    if (furn?.coffeeStation) {
      this.ori = new THREE.Group()
      this.ori.position.set(furn.coffeeStation.x - 0.9, 0, furn.coffeeStation.z + 0.75)
      scene.add(this.ori)
      cyl(0.22, 0.28, 0.7, '#e8e8e0', 0, 0.55, 0, { parent: this.ori, seg: 10 })
      this.oriHead = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), mat('#e8e8e0'))
      this.oriHead.position.y = 1.12
      this.ori.add(this.oriHead)
      box(0.3, 0.1, 0.05, new THREE.MeshBasicMaterial({ color: '#6cb4f0' }), 0, 1.14, 0.21, { parent: this.ori, cast: false })
      this.ori.rotation.y = -2.4
      this.tag(this.ori, 'coffeeStation')
    }
  }

  buildFurniture(C) {
    const THREE = getTHREE()
    const { scene, config } = this
    const furn = config.furniture || {}

    // Locker
    if (furn.locker) {
      const f = furn.locker
      const lockerTex = canvasTex(1024, 256, (ctx, w, h) => {
        ctx.fillStyle = '#e2c49b'; ctx.fillRect(0, 0, w, h)
        for (let i = 0; i < 14; i++) {
          const x = i * (w / 14)
          ctx.fillStyle = '#c9a77c'; ctx.fillRect(x, 0, 3, h); ctx.fillRect(x, h / 2 - 1, w / 14, 3)
          ctx.fillStyle = '#6d5a40'; ctx.fillRect(x + w / 14 - 14, h / 4 - 8, 5, 16); ctx.fillRect(x + w / 14 - 14, 3 * h / 4 - 8, 5, 16)
        }
      })
      const locker = box(0.8, 2.0, 8.4, mat(C.wood), f.x, 1.0, f.z)
      scene.add(locker)
      this.block(f.x - 0.4, f.x + 0.4, f.z - 4.2, f.z + 4.2)
      const lockerFront = new THREE.Mesh(
        new THREE.PlaneGeometry(8.4, 2.0),
        new THREE.MeshLambertMaterial({ map: lockerTex })
      )
      lockerFront.rotation.y = Math.PI / 2
      lockerFront.position.set(f.x + 0.41, 1.0, f.z)
      scene.add(lockerFront)
      this.tag(locker, 'locker')
      this.tag(lockerFront, 'locker')
    }

    // Bookshelf
    if (furn.bookshelf) {
      const f = furn.bookshelf
      const docs = new THREE.Group(); scene.add(docs)
      box(0.7, 2.0, 1.6, '#cfa57a', f.x, 1.0, f.z, { parent: docs })
      this.block(f.x - 0.35, f.x + 0.35, f.z - 0.8, f.z + 0.8)
      const BIND = ['#3b6fb6', '#c0392b', '#2e8b57', '#e0a526', '#6c4ab6', '#333']
      for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++)
        box(0.06, 0.42, 0.22, BIND[(i + r) % 6], f.x + 0.38, 0.4 + r * 0.6, f.z - 0.65 + i * 0.25, { parent: docs, cast: false })
      this.tag(docs, 'bookshelf')
    }

    // Server rack
    if (furn.serverRack) {
      const f = furn.serverRack
      const rack = new THREE.Group(); scene.add(rack)
      box(0.8, 2.0, 3.6, '#2a2d33', f.x, 1.0, f.z, { parent: rack })
      this.block(f.x - 0.4, f.x + 0.4, f.z - 1.8, f.z + 1.8)
      for (let r = 0; r < 7; r++) {
        box(0.02, 0.18, 3.2, '#1a1c20', f.x + 0.41, 0.3 + r * 0.24, f.z, { parent: rack, cast: false })
        for (let i = 0; i < 6; i++) {
          const led = box(0.02, 0.04, 0.04,
            new THREE.MeshBasicMaterial({ color: i % 3 ? '#5fd08a' : '#6cb4f0' }),
            f.x + 0.43, 0.3 + r * 0.24, f.z - 1.4 + i * 0.12 + r * 0.05, { parent: rack, cast: false }
          )
          this.leds.push(led)
        }
      }
      this.tag(rack, 'serverRack')
    }

    // Coffee station
    if (furn.coffeeStation) {
      const f = furn.coffeeStation
      const coffee = new THREE.Group(); scene.add(coffee)
      box(1.0, 0.9, 0.7, '#e8e6e0', f.x, 0.45, f.z, { parent: coffee })
      box(0.4, 0.45, 0.35, '#2b2b2f', f.x + 0.1, 1.12, f.z - 0.05, { parent: coffee })
      cyl(0.05, 0.04, 0.1, '#fff', f.x - 0.3, 0.95, f.z + 0.15, { parent: coffee })
      cyl(0.05, 0.04, 0.1, '#c0392b', f.x - 0.4, 0.95, f.z - 0.05, { parent: coffee })
      this.block(f.x - 0.5, f.x + 0.55, f.z - 0.4, f.z + 0.45)
      this.tag(coffee, 'coffeeStation')
    }

    // Shoe rack
    if (furn.shoeRack) {
      const f = furn.shoeRack
      const shoes = new THREE.Group(); scene.add(shoes)
      box(0.6, 0.9, 5.9, C.wood, f.x, 0.45, f.z, { parent: shoes })
      this.block(f.x - 0.35, f.x + 0.35, f.z - 2.95, f.z + 2.95)
      const SHOE_C = ['#222', '#7b4a2a', '#e8e8e8', '#3b5bdb', '#c0392b', '#555']
      for (let i = 0; i < 10; i++) {
        box(0.22, 0.1, 0.12, SHOE_C[i % 6], f.x - 0.13, 0.95, f.z - 2.55 + i * 0.55, { parent: shoes, cast: false })
        box(0.22, 0.1, 0.12, SHOE_C[i % 6], f.x - 0.13, 0.95, f.z - 2.4 + i * 0.55, { parent: shoes, cast: false })
      }
      this.tag(shoes, 'shoeRack')
    }

    // Printer
    if (furn.printer) {
      const f = furn.printer
      const printer = new THREE.Group(); scene.add(printer)
      box(0.8, 1.0, 0.75, '#e9e9e4', f.x, 0.5, f.z, { parent: printer })
      box(0.6, 0.06, 0.5, '#2b2b2f', f.x, 1.03, f.z, { parent: printer })
      box(0.32, 0.01, 0.44, '#fff', f.x - 0.3, 0.82, f.z, { parent: printer })
      this.block(f.x - 0.4, f.x + 0.45, f.z - 0.4, f.z + 0.4)
      this.tag(printer, 'printer')
    }

    // Round meeting table
    if (furn.roundTable) {
      const f = furn.roundTable
      const meet = new THREE.Group(); scene.add(meet)
      cyl(0.95, 0.95, 0.06, '#b98a5c', f.x, 0.74, f.z, { parent: meet, seg: 20 })
      cyl(0.08, 0.3, 0.72, C.chair, f.x, 0.36, f.z, { parent: meet })
      // small plant
      cyl(0.12, 0.09, 0.16, '#6b4f36', f.x, 0.85, f.z, { parent: meet })
      cyl(0.0, 0.22, 0.35, '#3e8e4e', f.x, 1.1, f.z, { parent: meet, seg: 6 })
      this.block(f.x - 0.95, f.x + 0.95, f.z - 0.95, f.z + 0.95)
      this.tag(meet, 'roundTable')
      // meeting chairs
      ;[0.6, 2.2, 3.8, 5.3].forEach((a) =>
        this.chairs.push({ x: f.x + Math.cos(a) * 1.35, z: f.z + Math.sin(a) * 1.35, rot: Math.atan2(-Math.cos(a), -Math.sin(a)) })
      )
    }

    // Guitars
    if (furn.guitars && config.enableGuitarEasterEgg !== false) {
      const f = furn.guitars
      this.guitarsGroup = new THREE.Group(); scene.add(this.guitarsGroup)
      ;[[f.x - 0.15, f.z - 0.2, '#c98a3c'], [f.x + 0.25, f.z + 0.3, '#1f1f1f']].forEach(([gx, gz, c]) => {
        const g = new THREE.Group(); g.position.set(gx, 0, gz); g.rotation.z = 0.18
        this.guitarsGroup.add(g)
        const body = cyl(0.22, 0.26, 0.09, c, 0, 0.35, 0, { parent: g, seg: 14 })
        body.rotation.x = Math.PI / 2
        box(0.06, 0.75, 0.04, '#3b2a1a', 0, 0.9, 0, { parent: g })
      })
      // plant
      cyl(0.18, 0.14, 0.3, '#6b4f36', f.x + 0.2, 0.15, f.z + 0.95)
      cyl(0.0, 0.35, 0.7, '#3e8e4e', f.x + 0.2, 0.65, f.z + 0.95, { seg: 7 })
      this.block(f.x - 0.4, f.x + 0.6, f.z - 0.6, f.z + 0.6)
      this.tag(this.guitarsGroup, 'guitars')
    }
  }

  buildCityscape() {
    const THREE = getTHREE()
    const { scene } = this

    function facade(kind, lit) {
      return canvasTex(128, 256, (ctx, w, h) => {
        ctx.fillStyle = lit ? '#000' : ['#8d9aa8', '#b9a891', '#6f8093'][kind]
        ctx.fillRect(0, 0, w, h)
        const cols = kind === 2 ? 8 : 6, rows = 20, cw = w / cols, rh = h / rows
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (lit) {
            if (Math.random() < 0.38) {
              ctx.fillStyle = Math.random() < 0.8 ? '#ffd98a' : '#cfe6ff'
              ctx.fillRect(c * cw + 3, r * rh + 3, cw - 6, rh - 5)
            }
          } else {
            const v = (40 + Math.random() * 45) | 0
            ctx.fillStyle = `rgb(${v + 25},${v + 45},${v + 65})`
            ctx.fillRect(c * cw + 3, r * rh + 3, cw - 6, rh - 5)
          }
        }
      })
    }

    const DAY_TEX = [0, 1, 2].map(k => facade(k, false))
    const LIT_TEX = [0, 1, 2].map(k => facade(k, true))
    this.city = new THREE.Group()
    scene.add(this.city)

    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

    const ROWS = [
      { z: 19, top: [2, 18], gap: [3, 8], tint: 1 },
      { z: 31, top: [6, 34], gap: [1, 3], tint: 0.82 },
      { z: 47, top: [10, 46], gap: [0.5, 2], tint: 0.66 },
    ]

    ROWS.forEach((row) => {
      for (let x = -55; x < 45;) {
        const w = 4 + rnd() * 7, d = 4 + rnd() * 6
        const top = row.top[0] + rnd() * (row.top[1] - row.top[0])
        const H = top + 45, kind = (rnd() * 3) | 0
        const map = DAY_TEX[kind].clone(), em = LIT_TEX[kind].clone()
        ;[map, em].forEach(tx => {
          tx.wrapS = tx.wrapT = THREE.RepeatWrapping
          tx.repeat.set(Math.max(1, w / 5), H / 14)
          tx.needsUpdate = true
        })
        const m = new THREE.MeshLambertMaterial({ map, emissiveMap: em, emissive: '#ffffff', emissiveIntensity: 0 })
        m.userData.tint = row.tint
        this.cityMats.push(m)
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), m)
        b.position.set(x + w / 2, top - H / 2, row.z + rnd() * 4)
        this.city.add(b)
        if (top > 26 && rnd() < 0.6) {
          const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 5), mat('#555'))
          ant.position.set(b.position.x, top + 2, b.position.z)
          this.city.add(ant)
          const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff3a2a' }))
          beacon.position.set(b.position.x, top + 4.1, b.position.z)
          this.city.add(beacon)
        }
        x += w + row.gap[0] + rnd() * (row.gap[1] - row.gap[0])
      }
    })
  }

  buildSky() {
    const THREE = getTHREE()
    this.skyTex = canvasTex(32, 256, () => {})
    this.skyMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 220),
      new THREE.MeshBasicMaterial({ map: this.skyTex, toneMapped: false })
    )
    this.skyMesh.position.set(0, 10, 75)
    this.skyMesh.rotation.y = Math.PI
    this.scene.add(this.skyMesh)
  }

  // ── Sky / day-night ──

  static SKY = {
    day:   { top: '#5d9bd5', hor: '#e3edf3', low: '#b9c3c9', city: '#ffffff', glow: 0, sun: ['#ffe2b0', 1.55], label: 'Day' },
    dusk:  { top: '#2b3a6b', hor: '#f08a4b', low: '#6b5a5a', city: '#b9a59a', glow: 0.55, sun: ['#ffb070', 1.1], label: 'Dusk' },
    night: { top: '#060a1a', hor: '#1d2545', low: '#141824', city: '#2a2f38', glow: 1, sun: ['#9fb4ff', 0.35], label: 'Night' },
  }

  skyMode() {
    const h = new Date().getHours()
    return h >= 6 && h < 17 ? 'day' : h >= 17 && h < 19 ? 'dusk' : 'night'
  }

  updateSky(force = false) {
    if (!this.skyTex || this.config.enableDayNight === false) return
    const THREE = getTHREE()
    const mode = this.skyOverride || this.skyMode()
    if (mode === this.skyNow && !force) return
    this.skyNow = mode
    const S = World.SKY[mode]
    const { ctx, w, h } = this.skyTex.userData
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, S.top); g.addColorStop(0.55, S.hor); g.addColorStop(0.62, S.low); g.addColorStop(1, S.low)
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    if (mode === 'night') {
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.6})`
        ctx.fillRect(Math.random() * w, Math.random() * h * 0.45, 1, 1)
      }
    }
    this.skyTex.needsUpdate = true
    const base = new THREE.Color(S.city), far = new THREE.Color(S.hor)
    this.cityMats.forEach(m => {
      m.color.copy(base).lerp(far, 1 - m.userData.tint)
      m.emissiveIntensity = S.glow * (0.6 + m.userData.tint * 0.4)
    })
    if (this.sunLight) {
      this.sunLight.color.set(S.sun[0])
      this.sunLight.intensity = S.sun[1]
    }
  }

  cycleSky() {
    const order = [null, 'day', 'dusk', 'night']
    const i = order.indexOf(this.skyOverride)
    this.skyOverride = order[(i + 1) % 4]
    this.updateSky(true)
    return this.skyOverride ? World.SKY[this.skyOverride].label : 'Auto (' + World.SKY[this.skyMode()].label + ')'
  }

  // ── Helpers ──

  block(x0, x1, z0, z1) {
    this.obstacles.push({
      x0: Math.min(x0, x1), x1: Math.max(x0, x1),
      z0: Math.min(z0, z1), z1: Math.max(z0, z1),
    })
  }

  tag(obj, id) {
    obj.traverse(m => {
      if (m.isMesh) {
        m.userData.inter = id
        this.clickables.push(m)
      }
    })
    this.interactiveMap[id] = obj
  }

  resolveSeat(seatStr) {
    if (!seatStr) return null
    // Head desk: "H1", "H2", etc.
    if (seatStr.startsWith('H')) {
      return this.chairs.find(c => c.deskId === seatStr)
    }
    // Table seat: "T1.R0", "T3.L2", etc.
    const m = seatStr.match(/^(T\d+)\.([LR])(\d+)$/)
    if (m) {
      const [, rowId, side, idx] = m
      return this.chairs.find(c => c.rowId === rowId && c.side === side && c.seatIndex === +idx)
    }
    return null
  }

  update(t) {
    if (this.ori) {
      this.ori.position.y = Math.sin(t * 2) * 0.04
      if (this.oriHead) this.oriHead.rotation.y = Math.sin(t * 0.8) * 0.6
    }
    this.updateSky()
  }
}
