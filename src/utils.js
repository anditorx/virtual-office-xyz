// ─── Shared utilities for the Virtual Office engine ─────────────────────────

let THREE

export function setTHREE(t) { THREE = t }
export function getTHREE() { return THREE }

const matCache = {}

export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts)
  return matCache[key] ||= new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts })
}

export function box(w, h, d, color, x, y, z, opts = {}) {
  const material = typeof color === 'string' ? mat(color) : color
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.position.set(x, y, z)
  mesh.castShadow = opts.cast ?? true
  mesh.receiveShadow = true
  ;(opts.parent || null)?.add(mesh) || (opts.noAdd ? null : null)
  return mesh
}

export function cyl(rt, rb, h, color, x, y, z, opts = {}) {
  const material = typeof color === 'string' ? mat(color) : color
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, opts.seg || 12), material)
  mesh.position.set(x, y, z)
  mesh.castShadow = opts.cast ?? true
  mesh.receiveShadow = true
  ;(opts.parent || null)?.add(mesh)
  return mesh
}

export function canvasTex(w, h, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  draw(ctx, w, h)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.userData = { ctx, w, h }
  return tex
}

export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

export function textSprite(title, sub, opts = {}) {
  const { accent = '#f2b33d', scale = 1, bg = 'rgba(14,15,18,.86)' } = opts
  const draw = (ctx, w, h, t, s, a) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = bg
    rrect(ctx, 4, 4, w - 8, h - 8, 18)
    ctx.fillStyle = a
    ctx.fillRect(4, 22, 7, h - 44)
    ctx.textBaseline = 'middle'
    ctx.fillStyle = a
    ctx.font = '700 42px "Barlow Condensed", sans-serif'
    ctx.fillText(t, 28, s ? 44 : h / 2, w - 44)
    if (s) {
      ctx.fillStyle = '#ece6d8'
      ctx.font = '500 32px "Barlow", sans-serif'
      ctx.fillText(s, 28, 90, w - 44)
    }
  }
  const tex = canvasTex(512, 128, (ctx, w, h) => draw(ctx, w, h, title, sub, accent))
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  )
  sprite.scale.set(2 * scale, 0.5 * scale, 1)
  sprite.renderOrder = 10
  sprite.userData.set = (t2, s2, a2 = accent) => {
    const { ctx, w, h } = tex.userData
    draw(ctx, w, h, t2, s2, a2)
    tex.needsUpdate = true
  }
  return sprite
}

export function instanced(geo, material, list, local, scene) {
  const im = new THREE.InstancedMesh(geo, material, list.length)
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const off = new THREE.Vector3()
  list.forEach((s, i) => {
    e.set(0, s.rot, 0)
    q.setFromEuler(e)
    off.copy(local).applyQuaternion(q)
    m4.compose(
      new THREE.Vector3(s.x + off.x, local.y, s.z + off.z),
      q,
      new THREE.Vector3(1, 1, 1)
    )
    im.setMatrixAt(i, m4)
  })
  im.castShadow = true
  im.receiveShadow = true
  scene.add(im)
  return im
}

export const $ = (id) => document.getElementById(id)

export const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export const ago = (ms) => {
  if (!ms) return '—'
  const m = Math.floor((Date.now() - ms) / 60000)
  return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.floor(m / 60) + 'h ago' : Math.floor(m / 1440) + 'd ago'
}
