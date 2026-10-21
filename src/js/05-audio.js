/* ============================== AUDIO ============================== */
var AU = {
  ctx: null,
  master: null,
  noise: null,
  ensure: function () {
    if (this.ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    var c = (this.ctx = new AC());
    this.master = c.createGain();
    this.master.gain.value = S.snd ? 0.9 : 0;
    this.master.connect(c.destination);
    var len = c.sampleRate * 0.4,
      b = c.createBuffer(1, len, c.sampleRate),
      d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
    return true;
  },
  resume: function () {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(function () {});
  },
  setSnd: function (on) {
    S.snd = on;
    try {
      localStorage.setItem("archive_snd", on ? "1" : "0");
    } catch (e) {}
    sndBtn.setAttribute("aria-pressed", on ? "true" : "false");
    sndBtn.textContent = on ? "SND ON" : "SND OFF";
    if (this.master) this.master.gain.value = on ? 0.9 : 0;
  },
  blip: function (f, dur, vol, type) {
    if (!this.ctx || !S.snd) return;
    try {
      var c = this.ctx,
        t = c.currentTime,
        o = c.createOscillator(),
        g = c.createGain();
      o.type = type || "square";
      o.frequency.value = f;
      g.gain.setValueAtTime(vol || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (dur || 0.04));
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + (dur || 0.04) + 0.02);
    } catch (e) {}
  },
  seek: function () {
    if (!this.ctx || !S.snd) return;
    try {
      var c = this.ctx,
        t = c.currentTime;
      var s = c.createBufferSource();
      s.buffer = this.noise;
      var f = c.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 2.2;
      f.frequency.setValueAtTime(420, t);
      f.frequency.exponentialRampToValueAtTime(1500, t + 0.14);
      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
      s.connect(f);
      f.connect(g);
      g.connect(this.master);
      s.start(t);
      s.stop(t + 0.2);
      // head tick
      var o = c.createOscillator(),
        og = c.createGain();
      o.type = "square";
      o.frequency.value = 2100;
      og.gain.setValueAtTime(0.05, t + 0.15);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
      o.connect(og);
      og.connect(this.master);
      o.start(t + 0.15);
      o.stop(t + 0.21);
    } catch (e) {}
  },
  thock: function () {
    if (!this.ctx || !S.snd) return;
    try {
      var c = this.ctx,
        t = c.currentTime;
      var o = c.createOscillator(),
        g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(55, t + 0.1);
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + 0.15);
      this.blip(2400, 0.03, 0.04);
    } catch (e) {}
  }
};
function primeAudio() {
  if (!AU.ctx) {
    AU.ensure();
  }
  AU.resume();
}
document.addEventListener(
  "pointerdown",
  function () {
    primeAudio();
  },
  { capture: true }
);
document.addEventListener(
  "keydown",
  function () {
    primeAudio();
  },
  { capture: true }
);
