// ─── Navigation: A* pathfinding + collision detection ───────────────────────

export class Navigation {
  constructor(obstacles, bounds) {
    this.obstacles = obstacles
    this.R = 0.28

    const CELL = 0.25
    this.CELL = CELL
    this.GX0 = bounds.x0
    this.GZ0 = bounds.z0
    this.NX = Math.ceil((bounds.x1 - bounds.x0) / CELL)
    this.NZ = Math.ceil((bounds.z1 - bounds.z0) / CELL)

    this.blocked = new Uint8Array(this.NX * this.NZ)
    for (let j = 0; j < this.NZ; j++) {
      for (let i = 0; i < this.NX; i++) {
        const x = this.GX0 + (i + 0.5) * CELL
        const z = this.GZ0 + (j + 0.5) * CELL
        this.blocked[j * this.NX + i] = obstacles.some(
          b => x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3
        ) ? 1 : 0
      }
    }
  }

  collide(pos) {
    const R = this.R
    for (const b of this.obstacles) {
      const x0 = b.x0 - R, x1 = b.x1 + R, z0 = b.z0 - R, z1 = b.z1 + R
      if (pos.x > x0 && pos.x < x1 && pos.z > z0 && pos.z < z1) {
        const dl = pos.x - x0, dr = x1 - pos.x, du = pos.z - z0, dd = z1 - pos.z
        const m = Math.min(dl, dr, du, dd)
        if (m === dl) pos.x = x0
        else if (m === dr) pos.x = x1
        else if (m === du) pos.z = z0
        else pos.z = z1
      }
    }
  }

  cellOf(x, z) {
    return [
      Math.max(0, Math.min(this.NX - 1, Math.floor((x - this.GX0) / this.CELL))),
      Math.max(0, Math.min(this.NZ - 1, Math.floor((z - this.GZ0) / this.CELL))),
    ]
  }

  isFree(x, z) {
    const [i, j] = this.cellOf(x, z)
    return !this.blocked[j * this.NX + i]
  }

  lineOfSight(a, b) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1)
    for (let k = 1; k < n; k++) {
      if (!this.isFree(a.x + (b.x - a.x) * k / n, a.z + (b.z - a.z) * k / n)) return false
    }
    return true
  }

  findPath(from, to) {
    const { NX, NZ, GX0, GZ0, CELL, blocked } = this

    let [gi, gj] = this.cellOf(to.x, to.z)
    if (blocked[gj * NX + gi]) {
      let best = null
      for (let r = 1; r < 8 && !best; r++) {
        for (let dj = -r; dj <= r; dj++) {
          for (let di = -r; di <= r; di++) {
            const ii = gi + di, jj = gj + dj
            if (ii >= 0 && jj >= 0 && ii < NX && jj < NZ && !blocked[jj * NX + ii] && !best) {
              best = [ii, jj]
            }
          }
        }
      }
      if (!best) return null
      ;[gi, gj] = best
    }

    const [si, sj] = this.cellOf(from.x, from.z)
    const start = sj * NX + si
    const goal = gj * NX + gi

    const g = new Float32Array(NX * NZ).fill(Infinity)
    const came = new Int32Array(NX * NZ).fill(-1)
    const closed = new Uint8Array(NX * NZ)

    // min-heap
    const heap = []
    const push = (n, f) => {
      heap.push([f, n])
      let k = heap.length - 1
      while (k > 0) {
        const p = (k - 1) >> 1
        if (heap[p][0] <= heap[k][0]) break
        ;[heap[p], heap[k]] = [heap[k], heap[p]]
        k = p
      }
    }
    const pop = () => {
      const top = heap[0], last = heap.pop()
      if (heap.length) {
        heap[0] = last
        let k = 0
        for (;;) {
          const l = 2 * k + 1, r = l + 1
          let m = k
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r
          if (m === k) break
          ;[heap[m], heap[k]] = [heap[k], heap[m]]
          k = m
        }
      }
      return top[1]
    }

    const h = (n) => {
      const dx = Math.abs(n % NX - gi)
      const dz = Math.abs((n / NX | 0) - gj)
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz)
    }

    g[start] = 0
    push(start, h(start))

    while (heap.length) {
      const n = pop()
      if (n === goal) break
      if (closed[n]) continue
      closed[n] = 1

      const ni = n % NX, nj = n / NX | 0
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue
          const i = ni + di, j = nj + dj
          if (i < 0 || j < 0 || i >= NX || j >= NZ) continue
          const m = j * NX + i
          if (blocked[m] && m !== start) continue
          if (di && dj && (blocked[nj * NX + i] || blocked[j * NX + ni])) continue
          const ng = g[n] + (di && dj ? 1.414 : 1)
          if (ng < g[m]) {
            g[m] = ng
            came[m] = n
            push(m, ng + h(m))
          }
        }
      }
    }

    if (came[goal] < 0 && goal !== start) return null

    // reconstruct
    const pts = []
    for (let n = goal; n >= 0 && n !== start; n = came[n]) {
      pts.push({
        x: GX0 + (n % NX + 0.5) * CELL,
        z: GZ0 + ((n / NX | 0) + 0.5) * CELL,
      })
    }
    pts.reverse()

    const [tci, tcj] = this.cellOf(to.x, to.z)
    if (!blocked[tcj * NX + tci]) pts.push({ x: to.x, z: to.z })

    // smooth with LOS checks
    const smooth = []
    let cur = { x: from.x, z: from.z }
    let k = 0
    while (k < pts.length) {
      let far = k
      for (let q = pts.length - 1; q > k; q--) {
        if (this.lineOfSight(cur, pts[q])) { far = q; break }
      }
      smooth.push(pts[far])
      cur = pts[far]
      k = far + 1
    }

    return smooth
  }
}
