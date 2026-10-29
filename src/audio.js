// ─── Audio: WebAudio synthesis, guitar, beat detection ──────────────────────

export class AudioManager {
  constructor() {
    this.ctx = null
    this.pluckCache = new Map()
    this.song = null
    this.songStatus = ''
  }

  getCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return this.ctx
  }

  // Karplus-Strong string synthesis
  pluckBuffer(freq) {
    if (this.pluckCache.has(freq)) return this.pluckCache.get(freq)
    const a = this.getCtx()
    const sr = a.sampleRate
    const n = Math.floor(sr * 1.8)
    const buf = a.createBuffer(1, n, sr)
    const d = buf.getChannelData(0)
    const N = Math.max(2, Math.round(sr / freq))
    const ring = new Float32Array(N)
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1
    for (let i = 0, k = 0; i < n; i++) {
      const nx = (k + 1) % N
      const v = ring[k]
      ring[k] = 0.4985 * (v + ring[nx])
      d[i] = v
      k = nx
    }
    this.pluckCache.set(freq, buf)
    return buf
  }

  pluck(freq, when, vol, out) {
    const a = this.getCtx()
    const s = a.createBufferSource()
    const g = a.createGain()
    s.buffer = this.pluckBuffer(freq)
    g.gain.value = vol
    s.connect(g).connect(out)
    s.start(when)
    s.stop(when + 1.8)
  }

  noiseHit(out, when, freq, dur, vol, type) {
    const a = this.getCtx()
    if (!this._noiseBuf) {
      this._noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate)
      const d = this._noiseBuf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    const s = a.createBufferSource()
    const fl = a.createBiquadFilter()
    const g = a.createGain()
    s.buffer = this._noiseBuf
    fl.type = type; fl.frequency.value = freq
    g.gain.setValueAtTime(vol, when)
    g.gain.exponentialRampToValueAtTime(0.001, when + dur)
    s.connect(fl).connect(g).connect(out)
    s.start(when, Math.random() * 0.5)
    s.stop(when + dur + 0.02)
  }

  tone(out, when, freq, dur, vol, type = 'square', lp = 3000) {
    const a = this.getCtx()
    const o = a.createOscillator()
    const fl = a.createBiquadFilter()
    const g = a.createGain()
    o.type = type; o.frequency.value = freq
    fl.type = 'lowpass'; fl.frequency.value = lp
    g.gain.setValueAtTime(vol, when)
    g.gain.exponentialRampToValueAtTime(0.001, when + dur)
    o.connect(fl).connect(g).connect(out)
    o.start(when)
    o.stop(when + dur + 0.02)
  }

  playGuitar() {
    const CHORDS = [
      ['G', [98, 123.47, 146.83, 196, 246.94, 392]],
      ['D', [146.83, 220, 293.66, 369.99]],
      ['Em', [82.41, 123.47, 164.81, 196, 246.94, 329.63]],
      ['C', [130.81, 164.81, 196, 261.63, 329.63]],
    ]
    try {
      const a = this.getCtx()
      const t0 = a.currentTime + 0.08
      const out = a.createGain()
      out.gain.value = 0.9
      out.connect(a.destination)
      CHORDS.forEach(([, fs], ci) => {
        ;[[0, 1, 0.26], [0.3125, 1, 0.14], [0.625, -1, 0.12], [0.9375, 1, 0.18]].forEach(([dt, dir, v]) => {
          ;(dir > 0 ? fs : [...fs].reverse()).forEach((f, si) =>
            this.pluck(f, t0 + ci * 1.25 + dt + si * 0.013, v, out)
          )
        })
      })
      return out
    } catch { return null }
  }

  playBeat() {
    try {
      const a = this.getCtx()
      const t0 = a.currentTime + 0.05
      const B = 0.5
      const out = a.createGain()
      out.gain.value = 0.8
      out.connect(a.destination)
      const BASS = [55, 43.65, 65.41, 49]
      const HOOK = [440, 523.25, 659.25, 523.25, 587.33, 523.25, 440, 392]
      for (let i = 0; i < 10; i++) {
        const w = t0 + i * B
        const o = a.createOscillator(), g = a.createGain()
        o.frequency.setValueAtTime(150, w)
        o.frequency.exponentialRampToValueAtTime(40, w + 0.12)
        g.gain.setValueAtTime(0.8, w)
        g.gain.exponentialRampToValueAtTime(0.001, w + 0.3)
        o.connect(g).connect(out); o.start(w); o.stop(w + 0.32)
        if (i % 2) this.noiseHit(out, w, 1600, 0.16, 0.45, 'bandpass')
        this.noiseHit(out, w + B / 2, 7000, 0.05, 0.14, 'highpass')
        this.tone(out, w + B / 2, BASS[(i >> 1) % 4], 0.22, 0.22, 'sawtooth', 380)
      }
      for (let i = 0; i < 20; i++) {
        this.tone(out, t0 + i * 0.25, HOOK[i % 8], 0.18, 0.045, 'square', 2400)
      }
      return out
    } catch { return null }
  }

  // ── Song loading + beat detection ──

  async analyzeSong(arrayBuffer) {
    const a = this.getCtx()
    const buf = await a.decodeAudioData(arrayBuffer)
    const SR = 11025
    const off = new OfflineAudioContext(1, Math.ceil(buf.duration * SR), SR)
    const src = off.createBufferSource()
    const lp = off.createBiquadFilter()
    src.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 180
    src.connect(lp).connect(off.destination); src.start()

    const low = (await off.startRendering()).getChannelData(0)
    const H = 256, hop = H / SR, n = Math.floor(low.length / H)
    const env = new Float32Array(n), on = new Float32Array(n)

    for (let i = 0; i < n; i++) {
      let s = 0
      for (let j = i * H, e = j + H; j < e; j++) s += low[j] * low[j]
      env[i] = Math.sqrt(s / H)
    }
    for (let i = 1; i < n; i++) on[i] = Math.max(0, env[i] - env[i - 1])

    // tempo detection via autocorrelation (70-180 BPM)
    let best = -1, bpm = 120
    for (let x = 70; x <= 180; x += 0.5) {
      const lag = 60 / x / hop
      let sc = 0
      for (let i = 0; i + lag * 2 < n; i++) {
        sc += on[i] * (on[Math.round(i + lag)] + 0.5 * on[Math.round(i + lag * 2)])
      }
      sc *= Math.exp(-Math.pow(Math.log2(x / 120), 2) / 0.5)
      if (sc > best) { best = sc; bpm = x }
    }

    const period = 60 / bpm
    let first = 0, bs = -1
    for (let o = 0; o < period; o += hop) {
      let sc = 0
      for (let tt = o; tt < buf.duration; tt += period) sc += on[Math.round(tt / hop)] || 0
      if (sc > bs) { bs = sc; first = o }
    }

    // smoothed energy envelope
    const sm = new Float32Array(n)
    let acc = 0, mx = 0
    for (let i = 0; i < n; i++) { acc = acc * 0.9 + env[i] * 0.1; sm[i] = acc; mx = Math.max(mx, acc) }
    if (mx) for (let i = 0; i < n; i++) sm[i] /= mx

    return { buf, bpm, period, first, env: sm, hop, duration: buf.duration }
  }

  async loadSong(arrayBuffer, name) {
    this.songStatus = 'Analyzing beat...'
    try {
      const r = await this.analyzeSong(arrayBuffer)
      this.song = { name, ...r, start: 0, len: r.duration }
      this.songStatus = ''
    } catch {
      this.songStatus = 'Cannot play this file. Try MP3, M4A, or WAV.'
    }
  }

  startMusic(cut) {
    if (this.song) {
      try {
        const a = this.getCtx()
        const out = a.createGain()
        const src = a.createBufferSource()
        const at = a.currentTime + 0.06
        src.buffer = this.song.buf
        src.connect(out).connect(a.destination)
        out.gain.setValueAtTime(1, at + Math.max(0, this.song.len - 0.35))
        out.gain.linearRampToValueAtTime(0, at + this.song.len)
        src.start(at, this.song.start, this.song.len)
        cut.out = out; cut.src = src; cut.aT0 = at; cut.dur = this.song.len
        cut.grid = { start: this.song.start, first: this.song.first, period: this.song.period, env: this.song.env, hop: this.song.hop }
        return
      } catch {}
    }
    cut.out = this.playBeat()
    cut.aT0 = this.ctx ? this.ctx.currentTime + 0.05 : null
    cut.dur = 5
    cut.grid = { start: 0, first: 0, period: 0.5 }
  }

  jjDuration() {
    return this.song ? Math.round(this.song.len) : 5
  }
}
