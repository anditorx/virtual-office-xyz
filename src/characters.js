// ─── Character system: creation, animation, NPC logic ───────────────────────

import { box, cyl, mat, getTHREE } from './utils.js'

export function createCharacter({ shirt, pants = '#2b3140', skin = '#c98f63', hair = '#1d1712', long = false, hijab = null }) {
  const THREE = getTHREE()
  const g = new THREE.Group()
  const shirtM = new THREE.MeshLambertMaterial({ color: shirt, flatShading: true })

  const hips = new THREE.Group()
  hips.position.y = 0.92
  g.add(hips)

  // torso
  box(0.44, 0.6, 0.26, shirtM, 0, 0.32, 0, { parent: hips })
  box(0.44, 0.1, 0.27, pants, 0, 0.02, 0, { parent: hips })

  // head
  const head = new THREE.Group()
  head.position.y = 0.66
  hips.add(head)
  box(0.1, 0.08, 0.1, skin, 0, 0.02, 0, { parent: head })
  box(0.27, 0.29, 0.27, skin, 0, 0.2, 0, { parent: head })

  if (hijab) {
    box(0.32, 0.12, 0.32, hijab, 0, 0.38, -0.01, { parent: head })
    box(0.32, 0.4, 0.1, hijab, 0, 0.2, -0.12, { parent: head })
    box(0.03, 0.36, 0.26, hijab, -0.15, 0.2, 0, { parent: head })
    box(0.03, 0.36, 0.26, hijab, 0.15, 0.2, 0, { parent: head })
    box(0.4, 0.18, 0.32, hijab, 0, -0.02, 0, { parent: head })
  } else {
    box(0.29, 0.09, 0.29, hair, 0, 0.37, -0.01, { parent: head })
    box(0.29, long ? 0.42 : 0.2, 0.07, hair, 0, long ? 0.18 : 0.26, -0.13, { parent: head })
  }

  // eyes
  box(0.045, 0.045, 0.02, '#111', -0.06, 0.22, 0.137, { parent: head, cast: false })
  box(0.045, 0.045, 0.02, '#111', 0.06, 0.22, 0.137, { parent: head, cast: false })

  // arms
  const makeArm = (side) => {
    const a = new THREE.Group()
    a.position.set(side * 0.29, 0.58, 0)
    hips.add(a)
    box(0.13, 0.52, 0.15, shirtM, 0, -0.24, 0, { parent: a })
    box(0.11, 0.1, 0.12, skin, 0, -0.54, 0, { parent: a })
    return a
  }

  // legs
  const makeLeg = (side) => {
    const l = new THREE.Group()
    l.position.set(side * 0.11, -0.02, 0)
    hips.add(l)
    box(0.18, 0.44, 0.2, pants, 0, -0.22, 0, { parent: l })
    const knee = new THREE.Group()
    knee.position.y = -0.44
    l.add(knee)
    box(0.16, 0.42, 0.18, pants, 0, -0.21, 0, { parent: knee })
    box(0.18, 0.08, 0.3, '#151515', 0, -0.44, 0.05, { parent: knee })
    l.userData.knee = knee
    return l
  }

  const ud = {
    hips, head,
    armL: makeArm(-1), armR: makeArm(1),
    legL: makeLeg(-1), legR: makeLeg(1),
    shirtM,
  }
  g.userData = ud
  return g
}

// ─── Animation: pose the character ──────────────────────────────────────────

function setLegs(u, a, b, ka, kb) {
  u.legL.rotation.x = a
  u.legR.rotation.x = b
  u.legL.userData.knee.rotation.x = ka
  u.legR.userData.knee.rotation.x = kb
}

function danceAnim(u, p, extra) {
  const { b = 0, endB = 10, mirror = false, base = 0, hype = 1 } = extra
  const m = mirror ? -1 : 1
  u.hips.rotation.x = 0
  u.armR.rotation.z = 0

  if (b < 0 || hype < 0.78) {
    const sw = Math.sin(Math.abs(b) * Math.PI)
    setLegs(u, 0, 0, 0, 0)
    u.hips.position.y = 0.92
    u.hips.rotation.z = sw * 0.06 * m
    u.head.rotation.z = sw * 0.08
    u.armL.rotation.x = u.armR.rotation.x = 0.05
    u.armL.rotation.z = -0.15
    u.armR.rotation.z = 0.15
    return
  }

  const ph = b * Math.PI
  const bounce = Math.abs(Math.sin(ph))
  const kb = (1 - bounce) * 0.35 * hype
  const fin = endB - 2

  setLegs(u, -kb * 0.6, -kb * 0.6, kb * 1.2, kb * 1.2)
  u.hips.position.y = 0.9 - kb * 0.12

  if (b >= fin) {
    const k = Math.min(1, (b - fin) / 1.2)
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
    p.rotation.y = base + e * Math.PI * 2 * m
    setLegs(u, 0, 0, 0, 0)
    if (k < 1) {
      u.hips.position.y = 0.92 + Math.sin(k * Math.PI) * 0.22
      u.armL.rotation.x = u.armR.rotation.x = 0
      u.armL.rotation.z = -1.4; u.armR.rotation.z = 1.4
    } else {
      u.hips.position.y = 0.92
      u.armL.rotation.x = u.armR.rotation.x = -2.8
      u.armL.rotation.z = -0.45; u.armR.rotation.z = 0.45
      u.head.rotation.x = -0.15
    }
    return
  }

  const seg = Math.floor(b / 4) % 4
  if (seg === 0) {
    u.armL.rotation.x = -2.7 + Math.sin(ph * 2) * 0.3
    u.armR.rotation.x = -2.7 - Math.sin(ph * 2) * 0.3
    u.armL.rotation.z = -0.25 - Math.sin(ph) * 0.25
    u.armR.rotation.z = 0.25 - Math.sin(ph) * 0.25
    u.hips.rotation.z = Math.sin(ph) * 0.12 * m * hype
    u.head.rotation.z = Math.sin(ph) * 0.18 * m
  } else if (seg === 1) {
    u.armL.rotation.x = -1.4 + Math.sin(ph * 2) * 0.2
    u.armR.rotation.x = -1.4 - Math.sin(ph * 2) * 0.2
    u.armL.rotation.z = Math.sin(ph) * 0.75
    u.armR.rotation.z = -Math.sin(ph) * 0.75
    u.hips.rotation.y = Math.sin(ph) * 0.35 * m * hype
  } else if (seg === 2) {
    const side = (Math.floor(b) % 2 ? 1 : -1) * m
    if (side > 0) {
      u.armR.rotation.x = -2.6; u.armR.rotation.z = 0.5
      u.armL.rotation.x = -0.4; u.armL.rotation.z = -0.5
      u.legR.rotation.z = 0.25
    } else {
      u.armL.rotation.x = -2.6; u.armL.rotation.z = -0.5
      u.armR.rotation.x = -0.4; u.armR.rotation.z = 0.5
      u.legL.rotation.z = -0.25
    }
    u.hips.position.x = side * 0.09 * hype
    u.hips.rotation.z = -side * 0.1
    u.head.rotation.z = side * 0.15
  } else {
    const c = Math.pow(1 - (b - Math.floor(b)), 3)
    u.armL.rotation.x = u.armR.rotation.x = -1.5
    u.armL.rotation.z = -0.55 + c * 0.55
    u.armR.rotation.z = 0.55 - c * 0.55
    u.hips.rotation.z = Math.sin(ph) * 0.14 * m
    u.hips.position.x = Math.sin(ph) * 0.06 * m
  }
}

export function animateCharacter(person, state, t, extra = {}) {
  const u = person.userData
  u.head.rotation.set(0, 0, 0)
  u.armL.rotation.z = 0
  u.hips.rotation.z = 0
  u.hips.rotation.y = 0
  u.hips.position.x = 0
  u.legL.rotation.z = u.legR.rotation.z = 0

  if (state === 'dance') return danceAnim(u, person, extra)

  if (state === 'guitar') {
    const s = Math.sin(t * 13), tap = Math.max(0, Math.sin(t * 6.4))
    setLegs(u, 0, -tap * 0.18, 0, tap * 0.3)
    u.hips.position.y = 0.92 + Math.sin(t * 6.4) * 0.008
    u.hips.rotation.x = 0.04
    u.armL.rotation.x = -1.15; u.armL.rotation.z = -0.55
    u.armR.rotation.x = -0.55 + s * 0.22; u.armR.rotation.z = 0.35
    u.head.rotation.x = 0.12 + Math.sin(t * 6.4) * 0.1
    u.head.rotation.z = Math.sin(t * 3.2) * 0.08
    return
  }

  if (state === 'walk' || state === 'run') {
    const sp = state === 'run' ? 11 : 7.5
    const a = state === 'run' ? 0.85 : 0.55
    const s = Math.sin(t * sp)
    setLegs(u, s * a, -s * a, Math.max(0, -s) * a * 1.3, Math.max(0, s) * a * 1.3)
    u.armL.rotation.x = -s * a * 0.8
    u.armR.rotation.x = s * a * 0.8
    u.hips.position.y = 0.92 + Math.abs(Math.cos(t * sp)) * 0.045
    u.hips.rotation.x = state === 'run' ? 0.12 : 0.03
  } else if (state === 'sit' || state === 'type') {
    setLegs(u, -Math.PI / 2, -Math.PI / 2, Math.PI / 2, Math.PI / 2)
    u.hips.position.y = 0.56
    u.hips.rotation.x = 0
    if (state === 'type') {
      u.armL.rotation.x = -1.15 + Math.sin(t * 15 + (extra.ph || 0)) * 0.06
      u.armR.rotation.x = -1.15 + Math.sin(t * 15 + 2 + (extra.ph || 0)) * 0.06
      u.head.rotation.x = 0.12 + Math.sin(t * 0.7 + (extra.ph || 0)) * 0.04
    } else {
      u.armL.rotation.x = u.armR.rotation.x = -0.35
      u.head.rotation.y = Math.sin(t * 0.5 + (extra.ph || 0)) * 0.4
    }
    if (extra.groove) u.head.rotation.x = 0.08 + Math.sin(t * 6.4 + (extra.ph || 0)) * 0.12
  } else {
    // idle
    setLegs(u, 0, 0, 0, 0)
    u.hips.position.y = 0.92 + Math.sin(t * 2) * 0.006
    u.hips.rotation.x = 0
    u.armL.rotation.x = Math.sin(t * 2) * 0.03
    u.armR.rotation.x = -Math.sin(t * 2) * 0.03
  }

  u.armR.rotation.z = 0
  if (extra.carry) { u.armR.rotation.x = -0.9; u.armR.rotation.z = 0.15 }
}

// ─── NPC Manager ────────────────────────────────────────────────────────────

export class NPCManager {
  constructor(scene, world, config) {
    this.scene = scene
    this.world = world
    this.config = config
    this.npcs = []
  }

  spawn() {
    const people = this.config.people || []
    this.npcs = people.map((def, i) => {
      const seat = this.world.resolveSeat(def.seat)
      if (!seat) return null

      const person = createCharacter(def)
      this.scene.add(person)

      const seatPos = {
        x: seat.x - Math.sin(seat.rot) * 0.06,
        z: seat.z - Math.cos(seat.rot) * 0.06,
      }
      person.position.set(seatPos.x, 0, seatPos.z)
      person.rotation.y = seat.rot

      const bubble = this.createBubble(def)
      bubble.position.set(seat.x, 2.05, seat.z)
      this.scene.add(bubble)

      // monitor glow for occupied seats
      const THREE = getTHREE()
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.29),
        new THREE.MeshBasicMaterial({ color: i % 2 ? '#2b6cb0' : '#1f7a5a', toneMapped: false })
      )
      const fx = Math.sin(seat.rot), fz = Math.cos(seat.rot)
      const monDist = seat.z > 7 ? 1.08 : 0.71
      glow.position.set(seat.x + fx * monDist, 1.02, seat.z + fz * monDist)
      glow.rotation.y = seat.rot + Math.PI
      this.scene.add(glow)

      this.world.tag(person, 'npc_' + i)

      return {
        ...def,
        index: i,
        person,
        bubble,
        seat,
        seatPos,
        ph: i * 1.7,
        id: 'npc_' + i,
        typing: true,
        mode: 'sit',
        path: null,
        then: null,
        face: seat.rot,
        mirror: false,
        ready: false,
      }
    }).filter(Boolean)
  }

  createBubble(def) {
    const { textSprite } = require_textSprite()
    return textSprite(def.name, def.status || def.role, { scale: 0.8 })
  }

  update(t, dt) {
    for (const npc of this.npcs) {
      this.updateOne(npc, t, dt)
    }
  }

  updateOne(npc, t, dt) {
    const p = npc.person
    if (npc.mode === 'walk') {
      const next = npc.path?.[0]
      if (!next) {
        npc.mode = 'stand'
        const fn = npc.then
        npc.then = null
        fn?.()
      } else {
        const vx = next.x - p.position.x
        const vz = next.z - p.position.z
        const l = Math.hypot(vx, vz)
        if (l < 0.1) {
          npc.path.shift()
        } else {
          const step = Math.min(2.4 * dt, l)
          p.position.x += (vx / l) * step
          p.position.z += (vz / l) * step
          let dy = Math.atan2(vx, vz) - p.rotation.y
          dy = Math.atan2(Math.sin(dy), Math.cos(dy))
          p.rotation.y += dy * Math.min(1, dt * 10)
        }
        animateCharacter(p, 'walk', t)
      }
    } else if (npc.mode === 'dance') {
      p.rotation.y = npc.face
      animateCharacter(p, 'dance', t, {
        ...(npc.beatInfo || {}),
        mirror: npc.mirror,
        base: npc.face,
      })
    } else if (npc.mode === 'stand') {
      let dy = npc.face - p.rotation.y
      dy = Math.atan2(Math.sin(dy), Math.cos(dy))
      p.rotation.y += dy * Math.min(1, dt * 8)
      animateCharacter(p, 'idle', t)
    } else {
      animateCharacter(p, npc.typing ? 'type' : 'sit', t, { ph: npc.ph })
    }

    npc.bubble.position.set(
      p.position.x,
      npc.mode === 'sit' ? 2.05 : 2.35,
      p.position.z
    )
  }

  goTo(npc, x, z, then) {
    const nav = this._nav
    if (!nav) return
    npc.path = nav.findPath(npc.person.position, { x, z }) || [{ x, z }]
    npc.mode = 'walk'
    npc.then = then
  }

  sendHome(npc) {
    this.goTo(npc, npc.seatPos.x, npc.seatPos.z, () => {
      npc.mode = 'sit'
      npc.person.position.set(npc.seatPos.x, 0, npc.seatPos.z)
      npc.person.rotation.y = npc.seat.rot
    })
  }

  setNavigation(nav) { this._nav = nav }
}

function require_textSprite() {
  return { textSprite }
}

import { textSprite } from './utils.js'
