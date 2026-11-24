/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   All sounds and music are generated procedurally at runtime. */
'use strict';
(function (VE) {
  const A = VE.audio = {
    ctx: null, sfxOn: true, musicOn: true, lx: 32, lz: 32, ld: 20, last: {}, started: false,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = this.sfxOn ? 0.55 : 0; this.sfx.connect(this.master);
      this.amb = c.createGain(); this.amb.gain.value = this.sfxOn ? 0.5 : 0; this.amb.connect(this.master);
      this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.16 : 0; this.mus.connect(this.master);
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.startAmbience();
      this.musicT = c.currentTime + 0.5; this.beat = 0;
      this.timer = setInterval(() => this.tick(), 120);
      this.birdT = c.currentTime + 2;
    },
    setSfx(on) { this.sfxOn = on; if (this.ctx) { this.sfx.gain.value = on ? 0.55 : 0; this.amb.gain.value = on ? 0.5 : 0; } },
    setMusic(on) { this.musicOn = on; if (this.ctx) this.mus.gain.value = on ? 0.16 : 0; },
    noise(dest) { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; s.connect(dest); return s; },
    startAmbience() {
      const c = this.ctx;
      // babbling brook
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6;
      const g1 = c.createGain(); g1.gain.value = 0.035; bp.connect(g1); g1.connect(this.amb);
      const lfo = c.createOscillator(); lfo.frequency.value = 0.23; const lg = c.createGain(); lg.gain.value = 0.012; lfo.connect(lg); lg.connect(g1.gain); lfo.start();
      this.noise(bp).start();
      // soft wind
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
      const g2 = c.createGain(); g2.gain.value = 0.05; lp.connect(g2); g2.connect(this.amb);
      const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.07; const lg2 = c.createGain(); lg2.gain.value = 0.035; lfo2.connect(lg2); lg2.connect(g2.gain); lfo2.start();
      this.noise(lp).start();
    },
    env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); },
    tone(type, f0, f1, dur, vol, t, dest, attack) {
      const c = this.ctx; t = t || c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      this.env(g, t, attack || 0.005, vol, dur);
      o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.05);
    },
    burst(ftype, freq, q, dur, vol, t, dest) {
      const c = this.ctx; t = t || c.currentTime;
      const s = c.createBufferSource(); s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = ftype; f.frequency.value = freq; f.Q.value = q || 1;
      const g = c.createGain(); this.env(g, t, 0.003, vol, dur);
      s.connect(f); f.connect(g); g.connect(dest || this.sfx);
      s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    play(name, x, z) {
      if (!this.ctx || !this.sfxOn) return;
      const c = this.ctx, now = c.currentTime;
      let vol = 1;
      if (x !== undefined) {
        const d = Math.hypot(x - this.lx, z - this.lz);
        vol = VE.clamp(1.15 - d / (this.ld * 0.7 + 4), 0, 1) * VE.clamp(1.4 - this.ld / 40, 0.35, 1);
        if (vol < 0.04) return;
      }
      const minGap = { bow: 0.08, thud2: 0.06, march: 0.6, chop: 0.07, hammer: 0.06, pick: 0.07, coin: 0.09, plant: 0.1, arrive: 0.5 }[name] || 0.03;
      if (this.last[name] && now - this.last[name] < minGap) return;
      this.last[name] = now;
      switch (name) {
        case 'click': this.tone('sine', 700, 520, 0.07, 0.18 * vol); break;
        case 'place': this.burst('lowpass', 500, 1, 0.12, 0.5 * vol); this.tone('sine', 150, 80, 0.15, 0.4 * vol); break;
        case 'road': this.burst('bandpass', 900, 0.8, 0.07, 0.18 * vol); break;
        case 'chop': this.burst('bandpass', 1100, 2, 0.06, 0.45 * vol); this.tone('triangle', 230, 120, 0.08, 0.3 * vol); break;
        case 'pick': this.tone('triangle', 1600, 1500, 0.07, 0.18 * vol); this.burst('highpass', 3000, 1, 0.04, 0.2 * vol); break;
        case 'hammer': this.tone('triangle', 950, 900, 0.05, 0.15 * vol); this.tone('sine', 1420, 1400, 0.04, 0.08 * vol); break;
        case 'fall': { const t = now; this.tone('sawtooth', 160, 70, 0.5, 0.05 * vol, t); this.burst('lowpass', 700, 1, 0.5, 0.35 * vol, t + 0.35); this.tone('sine', 90, 50, 0.3, 0.35 * vol, t + 0.4); break; }
        case 'plant': this.tone('sine', 320, 520, 0.12, 0.15 * vol); break;
        case 'creak': this.tone('sawtooth', 170, 80, 0.9, 0.045 * vol); this.tone('sawtooth', 130, 95, 0.6, 0.03 * vol, now + 0.25); break;   // kraken van de vallende boom
        case 'thud': this.burst('lowpass', 600, 1, 0.45, 0.4 * vol); this.tone('sine', 95, 45, 0.35, 0.4 * vol); break;                         // boom komt neer
        case 'bow': this.tone('triangle', 420, 160, 0.12, 0.14 * vol); this.burst('highpass', 2400, 1, 0.05, 0.1 * vol); break;          // pees die loslaat
        case 'thud2': this.burst('lowpass', 900, 1, 0.07, 0.22 * vol); this.tone('sine', 180, 120, 0.06, 0.12 * vol); break;              // pijl in het stro
        case 'thwack': this.burst('bandpass', 700, 1.5, 0.07, 0.35 * vol); this.tone('triangle', 260, 150, 0.06, 0.2 * vol); break;       // speer in de paal
        case 'march': [0, 0.16, 0.32].forEach(d => this.burst('lowpass', 380, 1, 0.08, 0.3 * vol, now + d)); break;                       // in de pas
        case 'coin': this.tone('sine', 1318, 1318, 0.12, 0.13 * vol); this.tone('sine', 1760, 1760, 0.2, 0.12 * vol, now + 0.07); break;
        case 'done': [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.2, now + i * 0.08)); break;
        case 'fanfare': [392, 523, 659, 784, 659, 784, 1046].forEach((f, i) => { this.tone('triangle', f, f, 0.32, 0.22, now + i * 0.13); this.tone('square', f / 2, f / 2, 0.25, 0.03, now + i * 0.13); }); break;
        case 'demolish': this.burst('lowpass', 420, 1, 0.45, 0.6 * vol); this.tone('sine', 110, 50, 0.4, 0.4 * vol); break;
        case 'arrive': this.tone('sine', 784, 784, 0.12, 0.08 * vol); this.tone('sine', 988, 988, 0.18, 0.08 * vol, now + 0.1); break;
        case 'error': this.tone('square', 220, 180, 0.12, 0.06); break;
        case 'open': this.tone('triangle', 520, 780, 0.09, 0.12); break;
      }
    },
    pluck(f, t, vol, dest) {
      const c = this.ctx;
      const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2.01;
      const g2 = c.createGain(); g2.gain.value = 0.3;
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.8);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(dest);
      o.start(t); o2.start(t); o.stop(t + 1.4); o2.stop(t + 1.4);
    },
    tick() {
      const c = this.ctx; if (!c || c.state !== 'running') return;
      // music: gentle lute in D major pentatonic over I–V–vi–IV
      const step = 0.36;
      const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
      const chords = [[62, 66, 69], [57, 61, 64], [59, 62, 66], [55, 59, 62]];
      const scale = [74, 76, 78, 81, 83, 86];
      while (this.musicT < c.currentTime + 0.4) {
        const t = this.musicT, b = this.beat, bar = Math.floor(b / 8) % 4, ch = chords[bar], pos = b % 8;
        if (this.musicOn) {
          if (pos === 0) this.pluck(mtof(ch[0] - 12), t, 0.5, this.mus);
          const arp = [0, 1, 2, 1, 2, 1, 0, 2][pos];
          this.pluck(mtof(ch[arp]), t, 0.32, this.mus);
          if ((pos === 2 || pos === 5 || pos === 7) && Math.random() < 0.45) {
            const phrase = Math.floor(b / 32) % 2;
            const n = scale[(Math.floor(Math.random() * 4) + bar + phrase) % scale.length];
            this.pluck(mtof(n), t + 0.01, 0.22, this.mus);
          }
        }
        this.musicT += step; this.beat++;
      }
      // birdsong
      if (c.currentTime > this.birdT) {
        this.birdT = c.currentTime + 2.5 + Math.random() * 6;
        if (this.sfxOn) {
          const n = 2 + Math.floor(Math.random() * 4), base = 2400 + Math.random() * 1600;
          for (let i = 0; i < n; i++) {
            const t = c.currentTime + i * (0.09 + Math.random() * 0.05);
            this.tone('sine', base * (1 + Math.random() * 0.2), base * (1.25 + Math.random() * 0.3), 0.07, 0.025 + Math.random() * 0.02, t, this.amb);
          }
        }
      }
    }
  };
  VE.bus.on('sfx', e => A.play(e.n, e.x, e.z));
})(window.VE);
