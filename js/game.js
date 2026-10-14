// OC Freeway Rush: gameplay, traffic, HUD, menus.
(function () {
  'use strict';
  const N = window.OCN, W = window.OCW, D = window.OC_DATA, LW = N.LW;
  const MPH = 2.23694;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + (b - a) * Math.random();
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ocfr.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ocfr.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  };

  // ---------- Renderer / scene ----------
  const settings = { tod: store.get('tod', 'day'), traffic: store.get('traffic', 'normal'), gfx: store.get('gfx', 'high') };
  const renderer = new THREE.WebGLRenderer({ antialias: settings.gfx === 'high', powerPreference: 'high-performance' });
  renderer.setPixelRatio(settings.gfx === 'high' ? Math.min(2, window.devicePixelRatio) : 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  $('game').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 12000);
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const hemi = new THREE.HemisphereLight(0xe3f0ff, 0x8a7a5a, 1.5);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.3);
  scene.add(hemi, sun, sun.target);
  const skyGeo = new THREE.SphereGeometry(10000, 24, 12);
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -1;
  scene.add(sky);
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(260, 24), new THREE.MeshBasicMaterial({ color: 0xfff4d0, fog: false }));
  scene.add(sunDisc);
  const headlight = new THREE.SpotLight(0xfff2d0, 0, 140, 0.55, 0.5, 1.2);
  scene.add(headlight, headlight.target);

  const world = W.build(scene, renderer, settings.gfx);

  const TOD = {
    day: { top: '#3f86d6', hor: '#d3e6f3', fog: '#cfe2ee', near: 500, far: 5200, hemi: 1.55, sky: 0xe3f0ff, gnd: 0x8a7a5a, sun: 2.4, sunC: 0xfff1d6, sunDir: [-0.4, 0.8, 0.45], lamp: 0x6d6d6d, lights: 0.55, head: 0, disc: 0xfff6dc },
    sunset: { top: '#2d3f7c', hor: '#f7a35f', fog: '#e59a6a', near: 350, far: 4200, hemi: 0.95, sky: 0xffc9a0, gnd: 0x5a4636, sun: 2.0, sunC: 0xffa86a, sunDir: [-0.85, 0.18, 0.5], lamp: 0xffcf7a, lights: 0.9, head: 18, disc: 0xffb36b },
    night: { top: '#03060f', hor: '#18213a', fog: '#111827', near: 160, far: 2600, hemi: 0.55, sky: 0x8090c0, gnd: 0x1a1a22, sun: 0.35, sunC: 0x9fb4ff, sunDir: [0.3, 0.7, -0.4], lamp: 0xffd890, lights: 1.0, head: 60, disc: 0xdfe6ff }
  };
  const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  function applyTOD(k) {
    const t = TOD[k];
    scene.fog = new THREE.Fog(t.fog, t.near, t.far);
    hemi.intensity = t.hemi; hemi.color.set(t.sky); hemi.groundColor.set(t.gnd);
    sun.intensity = t.sun; sun.color.set(t.sunC);
    sun.userData.dir = new THREE.Vector3().fromArray(t.sunDir).normalize();
    const top = new THREE.Color(t.top), hor = new THREE.Color(t.hor);
    const pa = skyGeo.attributes.position, cols = [];
    for (let i = 0; i < pa.count; i++) {
      const y = pa.getY(i) / 10000, c = hor.clone().lerp(top, clamp(y * 2.2, 0, 1));
      if (y < 0) c.copy(new THREE.Color(t.fog));
      cols.push(c.r, c.g, c.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    world.lampMat.color.set(t.lamp);
    lightMat.color.setScalar(t.lights);
    headlight.intensity = t.head;
    sunDisc.material.color.set(t.disc);
    world.shopMat.emissive && world.shopMat.emissive.set(k === 'night' ? 0x2a2418 : 0x000000);
    document.body.dataset.tod = k;
  }
  applyTOD(settings.tod);

  // ---------- Vehicles ----------
  const PAINT = ['#f4f4f2', '#16181c', '#b9bcc0', '#6b7077', '#1d3c78', '#a3141c', '#e8e1d2', '#c7b48b', '#2e5d3a', '#8a99a8', '#0f4d6b', '#d7d3c9'];
  const TYPES = {
    sedan: { L: 4.6, Wd: 1.85 }, suv: { L: 4.9, Wd: 1.95 }, pickup: { L: 5.6, Wd: 2.0 },
    van: { L: 7.4, Wd: 2.3 }, semi: { L: 15.6, Wd: 2.55 }, chp: { L: 4.9, Wd: 1.9 }, sport: { L: 4.5, Wd: 1.9 }
  };
  const box = W.box;
  const geoCache = {};
  function carGeo(type, paint) {
    const k = type + paint;
    if (geoCache[k]) return geoCache[k];
    const P = [], glass = '#1f2a33', tire = '#151515', dark = '#2a2a2a';
    const add = (b, c, m) => { b.c = c; b.m = m || 0; P.push(b); };
    const T = TYPES[type];
    add(box(T.Wd + 0.3, 0.02, T.L + 0.3, 0, 0.03, 0), '#000000');
    const wheels = (wx, zs, r) => { for (const z of zs) for (const s of [-1, 1]) add(box(0.32, r * 2, r * 2, s * wx, r, z), tire); };
    if (type === 'sedan' || type === 'chp') {
      add(box(1.84, 0.62, 4.5, 0, 0.58, 0), type === 'chp' ? '#111111' : paint);
      if (type === 'chp') { add(box(1.86, 0.5, 1.9, 0, 0.62, -0.1), '#f2f2f2'); }
      add(box(1.6, 0.5, 2.3, 0, 1.12, -0.25), glass);
      add(box(1.58, 0.07, 2.0, 0, 1.4, -0.25), type === 'chp' ? '#f2f2f2' : paint);
      wheels(0.84, [1.45, -1.45], 0.34);
      if (type === 'chp') { add(box(1.2, 0.16, 0.3, -0.31, 1.52, -0.2), '#ff1a1a', 1); add(box(0.6, 0.16, 0.3, 0.31, 1.52, -0.2), '#1a4dff', 1); }
    } else if (type === 'suv') {
      add(box(1.95, 0.85, 4.8, 0, 0.78, 0), paint);
      add(box(1.82, 0.62, 3.0, 0, 1.5, -0.35), glass);
      add(box(1.84, 0.08, 2.9, 0, 1.84, -0.35), paint);
      wheels(0.9, [1.55, -1.5], 0.4);
    } else if (type === 'pickup') {
      add(box(1.98, 0.8, 5.5, 0, 0.78, 0), paint);
      add(box(1.88, 0.66, 1.9, 0, 1.5, 0.55), glass);
      add(box(1.9, 0.08, 1.8, 0, 1.86, 0.55), paint);
      add(box(1.98, 0.35, 2.3, 0, 1.35, -1.55), paint);
      wheels(0.92, [1.8, -1.75], 0.42);
    } else if (type === 'van') {
      add(box(2.25, 1.6, 1.9, 0, 1.25, 2.7), paint);
      add(box(2.1, 0.6, 0.1, 0, 1.6, 3.66), glass);
      add(box(2.4, 2.8, 5.4, 0, 2.0, -0.8), '#efefef');
      wheels(1.05, [2.6, -2.4], 0.45);
    } else if (type === 'semi') {
      add(box(2.5, 2.6, 2.7, 0, 1.9, 6.4), paint);
      add(box(2.3, 0.8, 0.1, 0, 2.5, 7.76), glass);
      add(box(2.6, 3.7, 12.6, 0, 2.55, -1.3), ['#e6e6e6', '#d9d9d9', '#b02a2a', '#2a4ea0'][Math.abs(paint.charCodeAt(2)) % 4]);
      wheels(1.1, [6.6, 4.4, -4.6, -6.1], 0.52);
    } else if (type === 'sport') {
      add(box(1.9, 0.5, 4.5, 0, 0.5, 0), paint);
      add(box(1.5, 0.42, 1.8, 0, 0.94, -0.35), glass);
      add(box(1.48, 0.06, 1.6, 0, 1.16, -0.35), paint);
      add(box(0.25, 0.02, 2.0, -0.22, 0.76, 1.2), '#111111'); add(box(0.25, 0.02, 2.0, 0.22, 0.76, 1.2), '#111111');
      add(box(1.9, 0.08, 0.4, 0, 1.0, -2.1), '#111111');
      wheels(0.9, [1.4, -1.4], 0.36);
    }
    const hl = T.L / 2;
    const ly = type === 'semi' ? 1.0 : type === 'van' ? 0.9 : 0.72;
    for (const s of [-1, 1]) {
      add(box(0.45, 0.16, 0.06, s * (T.Wd / 2 - 0.3), ly, -hl - 0.02), '#ff2a2a', 1);
      add(box(0.4, 0.14, 0.06, s * (T.Wd / 2 - 0.32), ly - 0.02, hl + 0.02), '#fff4d6', 1);
    }
    return (geoCache[k] = W.mergeParts(P));
  }
  const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const pool = {};
  function getMesh(type, paint) {
    const k = type + paint;
    const list = pool[k] || (pool[k] = []);
    const m = list.pop() || new THREE.Mesh(carGeo(type, paint), [bodyMat, lightMat]);
    m.userData.k = k;
    m.rotation.order = 'YXZ';
    m.visible = true;
    scene.add(m);
    return m;
  }
  function freeMesh(m) { scene.remove(m); pool[m.userData.k].push(m); }

  // ---------- Player ----------
  const player = {
    path: null, s: 0, u: 0, psi: 0, v: 0, nos: 0.5, damage: 0, mesh: null,
    hl: TYPES.sport.L / 2, hw: TYPES.sport.Wd / 2
  };
  player.mesh = new THREE.Mesh(carGeo('sport', store.get('paint', '#d9352b')), [bodyMat, lightMat]);
  player.mesh.rotation.order = 'YXZ';
  scene.add(player.mesh);

  // ---------- Input ----------
  const keys = {};
  const pressed = (...k) => k.some((c) => keys[c]);
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    if (keys[e.code]) return;
    keys[e.code] = true;
    onKey(e.code);
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state.mode === 'drive') pause(true); });
  const touch = { l: false, r: false, g: false, b: false, n: false };
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    $('touch').classList.remove('hidden');
    document.querySelectorAll('#touch [data-k]').forEach((el) => {
      const k = el.dataset.k;
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); touch[k] = true; el.classList.add('on'); });
      const up = () => { touch[k] = false; el.classList.remove('on'); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
    });
  }

  // ---------- Audio ----------
  const audio = {
    ctx: null, on: store.get('sound', true),
    init() {
      if (this.ctx) return;
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = this.on ? 0.5 : 0; this.master.connect(c.destination);
      this.eng = c.createOscillator(); this.eng.type = 'sawtooth';
      this.eng2 = c.createOscillator(); this.eng2.type = 'square';
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
      this.engGain = c.createGain(); this.engGain.gain.value = 0;
      this.eng.connect(lp); this.eng2.connect(lp); lp.connect(this.engGain); this.engGain.connect(this.master);
      this.engLP = lp;
      this.eng.start(); this.eng2.start();
      const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      const ws = c.createBufferSource(); ws.buffer = buf; ws.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
      this.windGain = c.createGain(); this.windGain.gain.value = 0;
      ws.connect(bp); bp.connect(this.windGain); this.windGain.connect(this.master); ws.start();
    },
    set(on) { this.on = on; store.set('sound', on); if (this.master) this.master.gain.value = on ? 0.5 : 0; },
    update(v, thr) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const gearV = (v % 14) / 14, f = 48 + v * 2.2 + gearV * 50;
      this.eng.frequency.setTargetAtTime(f, t, 0.05);
      this.eng2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
      this.engLP.frequency.setTargetAtTime(400 + thr * 900 + v * 8, t, 0.08);
      this.engGain.gain.setTargetAtTime(state.mode === 'drive' ? 0.07 + thr * 0.07 : 0, t, 0.1);
      this.windGain.gain.setTargetAtTime(state.mode === 'drive' ? Math.min(0.25, v * v / 9000) : 0, t, 0.2);
    },
    burst(dur, freq, vol, q) {
      if (!this.ctx) return;
      const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 0.8;
      const g = c.createGain(); g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      s.connect(f); f.connect(g); g.connect(this.master); s.start(); s.stop(c.currentTime + dur);
    },
    tone(freqs, dur, type, vol) {
      if (!this.ctx) return;
      const c = this.ctx;
      freqs.forEach((fr, i) => {
        const o = c.createOscillator(); o.type = type || 'square'; o.frequency.value = fr;
        const g = c.createGain(); const t0 = c.currentTime + (Array.isArray(dur) ? 0 : 0);
        g.gain.setValueAtTime(vol || 0.08, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + (Array.isArray(dur) ? dur[i] : dur));
        o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + (Array.isArray(dur) ? dur[i] : dur));
      });
    },
    siren() {
      if (!this.ctx) return;
      const c = this.ctx, o = c.createOscillator(); o.type = 'sine';
      const g = c.createGain(); g.gain.value = 0.08;
      const t = c.currentTime;
      for (let i = 0; i < 4; i++) { o.frequency.setValueAtTime(700, t + i * 0.3); o.frequency.linearRampToValueAtTime(1300, t + i * 0.3 + 0.15); o.frequency.linearRampToValueAtTime(700, t + i * 0.3 + 0.3); }
      g.gain.setValueAtTime(0.08, t + 1.1); g.gain.exponentialRampToValueAtTime(0.001, t + 1.25);
      o.connect(g); g.connect(this.master); o.start(); o.stop(t + 1.3);
    }
  };

  // ---------- Traffic ----------
  const cars = [];
  const MAXCARS = settings.gfx === 'high' ? 230 : 150;
  const DENS = { light: 3.5, normal: 7, rush: 14 };
  const SPD = { light: [29, 37], normal: [26, 34], rush: [15, 27] };
  let focus = new Map();
  function speedFor(p) {
    const r = SPD[settings.traffic], k = (p.limit || 65) / 65;
    return rand(r[0], r[1]) * k;
  }
  function pickType(p, lane) {
    const r = Math.random(), right = lane >= p.lanes - 2;
    if (!p.surface && right && r < 0.13) return 'semi';
    if (right && r < 0.2) return 'van';
    if (r < 0.48) return 'sedan';
    if (r < 0.78) return 'suv';
    return 'pickup';
  }
  function laneFree(p, s, u, gap) {
    for (const c of cars) if (c.path === p && Math.abs(c.s - s) < gap + c.hl && Math.abs(c.u - u) < 2.4) return false;
    if (player.path === p && Math.abs(player.s - s) < gap + 3 && Math.abs(player.u - u) < 2.4) return false;
    return true;
  }
  function spawnCar(p, s, opts) {
    opts = opts || {};
    if (s < 5 || s > p.len - 5) return null;
    const lane = opts.chp ? -1 : Math.floor(Math.random() * p.lanes);
    const type = opts.chp ? 'chp' : pickType(p, lane);
    const u = opts.chp ? p.outer + 1.3 : p.laneU(lane);
    if (!laneFree(p, s, u, type === 'semi' ? 22 : 14)) return null;
    let vd = type === 'semi' || type === 'van' ? Math.min(speedFor(p), 26 * (p.limit / 65)) : speedFor(p);
    vd *= 1 + (p.lanes - 1 - lane) * 0.035; // faster on the left
    const paint = PAINT[Math.floor(Math.random() * PAINT.length)];
    const c = {
      path: p, s, lane, u, v: opts.chp ? 0 : vd * rand(0.85, 1), vd: opts.chp ? 0 : vd, type, chp: !!opts.chp,
      hl: TYPES[type].L / 2, hw: TYPES[type].Wd / 2, lc: rand(1, 4), psi: 0, mesh: getMesh(type, paint), rel: 0, ticketed: false
    };
    cars.push(c);
    return c;
  }
  function removeCar(i) { freeMesh(cars[i].mesh); cars[i] = cars[cars.length - 1]; cars.pop(); }
  function clearTraffic() { while (cars.length) removeCar(cars.length - 1); }

  function computeFocus() {
    const f = new Map();
    const pw = player.path.frame(player.s, player.u, {});
    const near = new Map();
    N.query(pw.x, pw.z, 1100, (ref) => {
      if (ref.p.kind !== 'fwy') return;
      const d = Math.hypot(ref.p.x[ref.i] - pw.x, ref.p.z[ref.i] - pw.z);
      const cur = near.get(ref.p);
      if (!cur || d < cur.d) near.set(ref.p, { d, s: ref.p.s[ref.i] });
    });
    for (const [p, n] of near) {
      for (const q of [p, p.twin]) {
        const s = q === p ? n.s : q.len - n.s;
        f.set(q, { s0: s - 900, s1: s + 900, main: false });
      }
    }
    const main = player.path.kind === 'conn' ? player.path.to : player.path;
    const ms = player.path.kind === 'conn' ? player.path.sTo - (player.path.len - player.s) : player.s;
    f.set(main, { s0: ms - 450, s1: ms + 1700, main: true });
    return f;
  }
  function fillTraffic(initial) {
    let budget = initial ? 1000 : 5;
    const pw = player.path.frame(player.s, player.u, {});
    for (const [p, w] of focus) {
      const s0 = Math.max(10, w.s0), s1 = Math.min(p.len - 10, w.s1);
      if (s1 <= s0) continue;
      const target = Math.round((s1 - s0) / 1000 * DENS[settings.traffic] * p.lanes * (w.main ? 1 : 0.8));
      let have = 0;
      for (const c of cars) if (c.path === p && c.s >= s0 && c.s <= s1 && !c.chp) have++;
      let tries = initial ? target * 3 : 3;
      while (have < target && budget > 0 && tries-- > 0 && cars.length < MAXCARS) {
        const s = rand(s0, s1);
        const q = p.frame(s, 0, {});
        const dist = Math.hypot(q.x - pw.x, q.z - pw.z);
        if (initial ? dist < 45 : dist < 320) continue;
        if (spawnCar(p, s)) { have++; budget--; }
      }
      // the occasional CHP cruiser parked on the shoulder
      if (w.main && !initial && Math.random() < 0.004 && !p.surface) {
        const s = Math.min(p.len - 20, (player.path === p ? player.s : w.s0 + 450) + rand(700, 1500));
        if (!p.zoneAt(s, 'R') && !p.arrs.some((a) => Math.abs(a.s - s) < 150) && !cars.some((c) => c.chp && c.path === p && Math.abs(c.s - s) < 2000)) spawnCar(p, s, { chp: true });
      }
    }
  }

  const tmpF = {};
  function updateTraffic(dt) {
    const by = new Map();
    for (const c of cars) { let a = by.get(c.path); if (!a) by.set(c.path, (a = [])); a.push(c); }
    for (const list of by.values()) list.sort((a, b) => a.s - b.s);
    const A = 1.8, B = 3.5;
    for (const [p, list] of by) {
      for (let k = 0; k < list.length; k++) {
        const c = list[k];
        if (c.chp) continue;
        let gap = 1e9, lv = 0;
        for (let j = k + 1; j < list.length && j < k + 14; j++) {
          const o = list[j];
          if (Math.abs(o.u - c.u) < 2.3) { gap = o.s - c.s - o.hl - c.hl; lv = o.v; break; }
        }
        if (player.path === p && player.s > c.s && Math.abs(player.u - c.u) < 2.3) {
          const g2 = player.s - c.s - player.hl - c.hl;
          if (g2 < gap) { gap = g2; lv = player.v * Math.cos(player.psi); }
        }
        const sStar = 3 + c.v * 1.25 + c.v * (c.v - lv) / (2 * Math.sqrt(A * B));
        let acc = A * (1 - Math.pow(c.v / Math.max(1, c.vd), 4) - (gap < 1e8 ? Math.pow(Math.max(0, sStar) / Math.max(0.5, gap), 2) : 0));
        acc = Math.max(-9, acc);
        c.v = Math.max(0, c.v + acc * dt);
        // lane changes
        c.lc -= dt;
        if (c.lc < 0 && p.kind === 'fwy') {
          c.lc = rand(1.5, 4.5);
          const want = gap < 80 && lv < c.vd - 2.5;
          const cand = want ? [c.lane - 1, c.lane + 1] : Math.random() < 0.12 ? [c.lane + 1] : [];
          for (const L of cand) {
            if (L < 0 || L >= p.lanes) continue;
            if (p.len - c.s < 500 && p.deps.some((d) => d.terminal)) break;
            const u2 = p.laneU(L);
            let ok = true;
            for (const o of list) if (o !== c && Math.abs(o.s - c.s) < 16 + o.hl && Math.abs(o.u - u2) < 2.3) { ok = false; break; }
            if (ok && player.path === p && Math.abs(player.s - c.s) < 18 && Math.abs(player.u - u2) < 2.3) ok = false;
            if (ok) { c.lane = L; break; }
          }
        }
        const tu = p.kind === 'conn' ? 0 : p.laneU(c.lane);
        const du = clamp(tu - c.u, -1.7 * dt, 1.7 * dt);
        c.u += du;
        c.psi = Math.atan2(du / Math.max(dt, 1e-3), Math.max(3, c.v)) * 0.8;
        c.s += c.v * dt;
        if (c.s >= p.len) {
          const deps = p.kind === 'fwy' ? p.deps.filter((d) => d.terminal) : null;
          if (p.kind === 'conn') {
            if (p.kindConn === 'ramp') { c.dead = true; continue; }
            c.path = p.to; c.s = p.sTo + (c.s - p.len); c.u = p.uE; c.lane = p.uE > p.to.laneU(0) + 0.1 ? p.to.lanes - 1 : 0;
          } else if (deps && deps.length) {
            const d = deps[clamp(Math.floor((c.u - p.M) / (p.lanes * LW / deps.length)), 0, deps.length - 1)];
            c.path = d.conn; c.s = c.s - p.len; c.u = 0; c.lane = 0;
          } else c.dead = true;
        }
      }
    }
    // place meshes, despawn
    const pw = player.path.frame(player.s, player.u, {});
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      if (c.dead) { removeCar(i); continue; }
      const f = c.path.frame(c.s, c.u, tmpF);
      const dist = Math.hypot(f.x - pw.x, f.z - pw.z);
      const w = focus.get(c.path);
      let kill = dist > 2600;
      if (!kill && c.path.kind === 'fwy') {
        if (!w) kill = dist > 380;
        else if (c.s < w.s0 - 200 || c.s > w.s1 + 200) kill = dist > 330;
      } else if (!kill && dist > 1400) kill = true;
      if (kill) { removeCar(i); continue; }
      const m = c.mesh;
      m.position.set(f.x, f.y, f.z);
      const ca = Math.cos(c.psi), sa = Math.sin(c.psi);
      const dx = f.tx * ca - f.tz * sa, dz = f.tz * ca + f.tx * sa;
      m.rotation.y = Math.atan2(dx, dz);
      m.rotation.x = -Math.atan(f.slope);
      if (c.chp) {
        const on = Math.floor(clock * 6) % 2 === 0;
        m.visible = true;
        m.scale.x = on ? 1 : 1.0001;
      }
    }
  }

  // ---------- Signs (built lazily near the camera) ----------
  const shieldCache = {};
  function drawShield(g, fw, x, y, s) {
    const def = fw.def;
    g.save(); g.translate(x, y);
    if (def.shield === 'I') {
      g.beginPath();
      g.moveTo(0.05 * s, 0.08 * s); g.quadraticCurveTo(0.25 * s, 0.14 * s, 0.5 * s, 0);
      g.quadraticCurveTo(0.75 * s, 0.14 * s, 0.95 * s, 0.08 * s);
      g.quadraticCurveTo(1.04 * s, 0.6 * s, 0.5 * s, 1.0 * s);
      g.quadraticCurveTo(-0.04 * s, 0.6 * s, 0.05 * s, 0.08 * s);
      g.fillStyle = '#ffffff'; g.fill();
      g.save(); g.clip();
      g.fillStyle = '#1a3f9a'; g.fillRect(0, 0.3 * s, s, s);
      g.fillStyle = '#c8102e'; g.fillRect(0, 0, s, 0.3 * s);
      g.restore();
      g.lineWidth = s * 0.05; g.strokeStyle = '#ffffff'; g.stroke();
      g.fillStyle = '#ffffff'; g.font = `bold ${s * (def.num.length > 2 ? 0.4 : 0.5)}px Arial, Helvetica, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(def.num, 0.5 * s, 0.63 * s);
      g.font = `bold ${s * 0.13}px Arial`; g.fillText('INTERSTATE', 0.5 * s, 0.17 * s);
    } else {
      g.beginPath();
      g.moveTo(0.12 * s, 0.04 * s); g.lineTo(0.88 * s, 0.04 * s);
      g.quadraticCurveTo(0.98 * s, 0.1 * s, 0.94 * s, 0.32 * s);
      g.quadraticCurveTo(0.9 * s, 0.75 * s, 0.5 * s, 0.98 * s);
      g.quadraticCurveTo(0.1 * s, 0.75 * s, 0.06 * s, 0.32 * s);
      g.quadraticCurveTo(0.02 * s, 0.1 * s, 0.12 * s, 0.04 * s);
      g.fillStyle = '#0c7a45'; g.fill();
      g.lineWidth = s * 0.06; g.strokeStyle = '#ffffff'; g.stroke();
      g.fillStyle = '#ffffff'; g.font = `bold ${s * (def.num.length > 2 ? 0.36 : 0.46)}px Arial, Helvetica, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(def.num, 0.5 * s, 0.5 * s);
      if (def.toll) {
        g.fillStyle = '#f4c20d'; g.fillRect(0.12 * s, -0.24 * s, 0.76 * s, 0.22 * s);
        g.fillStyle = '#111'; g.font = `bold ${s * 0.17}px Arial`; g.fillText('TOLL', 0.5 * s, -0.12 * s);
      }
    }
    g.restore();
  }
  function shieldURL(fw) {
    if (shieldCache[fw.id]) return shieldCache[fw.id];
    const c = document.createElement('canvas'); c.width = 96; c.height = 120;
    drawShield(c.getContext('2d'), fw, 8, 22, 80);
    return (shieldCache[fw.id] = c.toDataURL());
  }
  function signCanvas(o) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 240;
    const g = c.getContext('2d');
    g.fillStyle = '#0b6a3c'; g.fillRect(0, 0, 512, 240);
    g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(8, 8, 496, 224);
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left';
    if (o.exit) {
      g.fillStyle = '#0b6a3c';
      g.fillStyle = '#fff'; g.fillRect(360, 8, 144, 48);
      g.fillStyle = '#0b6a3c'; g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.fillText('EXIT', 432, 34);
      g.fillStyle = '#fff'; g.textAlign = 'left';
      g.font = 'bold 44px Arial'; fitText(g, o.exit.name, 30, 100, 450);
      g.font = '32px Arial'; fitText(g, o.exit.place, 30, 150, 450);
      bar(g, 'EXIT ONLY', '#f4c20d', '#111');
      arrow(g, 455, 150, 'dr');
    } else {
      const fw = o.to.fw;
      drawShield(g, fw, 26, fw.def.toll ? 52 : 30, 92);
      g.font = 'bold 46px Arial'; g.fillText(o.to.dirName, 140, 62);
      g.font = '38px Arial'; fitText(g, o.to.city, 140, 120, 350);
      if (o.side === 'R') { bar(g, 'EXIT ONLY', '#f4c20d', '#111'); arrow(g, 455, 120, 'dr'); }
      else if (o.side === 'L') { bar(g, 'LEFT LANE', '#ffffff', '#0b6a3c'); arrow(g, 455, 120, 'dl'); }
      else { arrow(g, 455, 120, 'd'); }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
    function bar(g, txt, bg, fg) {
      g.fillStyle = bg; g.fillRect(14, 186, 484, 40);
      g.fillStyle = fg; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.fillText(txt, 256, 207); g.textAlign = 'left';
    }
    function arrow(g, x, y, d) {
      g.save(); g.translate(x, y);
      g.rotate(d === 'dr' ? -Math.PI / 4 : d === 'dl' ? Math.PI / 4 : 0);
      g.fillStyle = '#fff';
      g.fillRect(-6, -34, 12, 40);
      g.beginPath(); g.moveTo(-20, 4); g.lineTo(20, 4); g.lineTo(0, 30); g.closePath(); g.fill();
      g.restore();
    }
    function fitText(g, txt, x, y, w) {
      let size = parseInt(g.font.match(/(\d+)px/)[1], 10);
      while (g.measureText(txt).width > w && size > 16) { size -= 2; g.font = g.font.replace(/\d+px/, size + 'px'); }
      g.fillText(txt, x, y);
    }
  }
  const signs = [];
  for (const p of N.paths) {
    const term = p.deps.filter((d) => d.terminal);
    for (const d of p.deps) {
      if (d.terminal) continue;
      const s = Math.max(6, d.zs - 30);
      signs.push({ p, s, panels: [{ u: d.side === 'R' ? p.outer - 1.2 : p.M + 2.6, exit: d.exit, to: d.conn.to, side: d.side }] });
    }
    if (term.length) {
      const s = Math.max(6, p.len - 300);
      signs.push({ p, s, panels: term.map((d) => ({ u: d.uS, to: d.conn.to, side: null })) });
    }
  }
  for (const sg of signs) { const f = sg.p.frame(sg.s, sg.p.outer / 2, {}); sg.x = f.x; sg.z = f.z; }
  const gantryMat = new THREE.MeshLambertMaterial({ color: 0x9da3a8 });
  const signBackMat = new THREE.MeshLambertMaterial({ color: 0x7b8087 });
  function buildSign(sg) {
    const g = new THREE.Group();
    const p = sg.p, f = p.frame(sg.s, 0, {});
    g.position.set(f.x, f.y, f.z);
    g.rotation.y = Math.atan2(f.tx, f.tz);
    // local: +z = travel direction, +x = left of travel (three's rotation), so lateral u maps to -x
    const uL = 0.6, uR = p.outer + 2.2;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(uR - uL, 0.5, 0.5), gantryMat);
    beam.position.set(-(uL + uR) / 2, 7.4, 0);
    g.add(beam);
    for (const u of [uL, uR]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.6, 0.4), gantryMat); post.position.set(-u, 3.8, 0); g.add(post); }
    for (const pn of sg.panels) {
      const mat = new THREE.MeshBasicMaterial({ map: signCanvas(pn) });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.4), mat);
      pl.position.set(-pn.u, 8.1, -0.3);
      pl.rotation.y = Math.PI;
      const back = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.4), signBackMat);
      back.position.set(-pn.u, 8.1, -0.25);
      g.add(pl, back);
    }
    scene.add(g);
    sg.obj = g;
  }
  function disposeSign(sg) {
    sg.obj.traverse((o) => { if (o.material && o.material.map) { o.material.map.dispose(); o.material.dispose(); } if (o.geometry) o.geometry.dispose(); });
    scene.remove(sg.obj); sg.obj = null;
  }
  function updateSigns() {
    const cx = camera.position.x, cz = camera.position.z;
    let built = 0;
    for (const sg of signs) {
      const d = Math.hypot(sg.x - cx, sg.z - cz);
      if (!sg.obj && d < 1500 && built < 3) { buildSign(sg); built++; }
      else if (sg.obj && d > 1900) disposeSign(sg);
    }
  }

  // ---------- Game state ----------
  const state = {
    mode: 'menu', mission: null, dest: null, timeLeft: 0, par: 0, elapsed: 0, score: 0, near: 0, combo: 0, comboT: 0,
    crashes: 0, tickets: 0, route: null, routeT: 0, focusT: 0, signT: 0, camMode: 0, shake: 0, msgT: 0, lastNext: null, free: false, missedT: 0
  };
  let clock = 0;

  function placePlayer(p, s, lane) {
    player.path = p; player.s = s; player.u = p.laneU(lane); player.psi = 0;
    player.v = 27; player.damage = 0; player.nos = 0.5;
  }

  function startMission(m) {
    state.free = false;
    state.mission = m;
    state.dest = N.exitById[m.dest];
    const p = N.pathFor(m.start.fwy, m.start.dir);
    placePlayer(p, N.sOnPath(p, m.start.at), Math.min(p.lanes - 1, 1));
    beginRun();
  }
  function startRandom() {
    for (let tries = 0; tries < 200; tries++) {
      const dest = N.exits[Math.floor(Math.random() * N.exits.length)];
      const cand = N.paths.filter((p) => p.len > 3000);
      const p = cand[Math.floor(Math.random() * cand.length)];
      const s = rand(300, p.len - 1500);
      if (p.deps.some((d) => s > d.zs - 50 && s < d.g + 50)) continue;
      const r = N.route(p, s, dest);
      if (!r || r.dist < 6000 || r.dist > 17000) continue;
      state.free = false;
      state.mission = { title: 'Random Commute', dest: dest.id, random: true, start: { p, s } };
      state.dest = dest;
      placePlayer(p, s, Math.floor(p.lanes / 2));
      beginRun();
      return;
    }
  }
  function startFree(fwyId) {
    state.free = true;
    state.mission = null; state.dest = null;
    const F = N.fwById[fwyId] || N.fws[0];
    const p = F.paths[0];
    placePlayer(p, Math.min(400, p.len / 3), Math.floor(p.lanes / 2));
    beginRun();
  }
  function beginRun() {
    audio.init();
    clearTraffic();
    state.elapsed = 0; state.score = 0; state.near = 0; state.combo = 0; state.crashes = 0; state.tickets = 0;
    state.route = null; state.lastNext = null; state.missedT = 0;
    if (!state.free) {
      const r = N.route(player.path, player.s, state.dest);
      const slow = settings.traffic === 'rush' ? 23 : settings.traffic === 'normal' ? 26.5 : 28.5;
      state.par = Math.round(r.dist / slow + 25);
      state.timeLeft = state.par;
    }
    focus = computeFocus();
    fillTraffic(true);
    camInit = true;
    hideAll();
    $('hud').classList.remove('hidden');
    $('mission').classList.toggle('hidden', state.free);
    state.mode = 'drive';
    flash(state.free ? 'FREE DRIVE' : 'GO!', state.free ? 'Cruise the OC. M for the map.' : `Get to ${state.dest.place}`);
    updateRoute(true);
  }

  // ---------- Player physics ----------
  function transfer(np, ns, nu) {
    const a = player.path.frame(player.s, 0, {}), b = np.frame(ns, 0, {});
    const rx = -a.tz, rz = a.tx;
    const delta = Math.atan2(b.tx * rx + b.tz * rz, b.tx * a.tx + b.tz * a.tz);
    player.psi -= delta;
    player.path = np; player.s = ns; player.u = nu;
  }
  function uLimits(p, s) {
    if (p.kind === 'conn') return [-1.85, 1.85];
    const lo = (p.surface ? 0.12 : 0.32) + player.hw;
    let hi = p.outer + 2.4 - player.hw;
    const z = p.zoneAt(s, 'R');
    if (z) hi = p.outer + 1.0 + LW * Math.min(1, (s - z.zs) / 60) - player.hw;
    return [lo, Math.max(hi, p.outer + 2.4 - player.hw)];
  }

  function updatePlayer(dt) {
    const thr = pressed('KeyW', 'ArrowUp') || touch.g ? 1 : 0;
    const brk = pressed('KeyS', 'ArrowDown', 'Space') || touch.b ? 1 : 0;
    const steer = (pressed('KeyD', 'ArrowRight') || touch.r ? 1 : 0) - (pressed('KeyA', 'ArrowLeft') || touch.l ? 1 : 0);
    const nos = (pressed('ShiftLeft', 'ShiftRight') || touch.n) && player.nos > 0.02 && thr;
    const vmax = nos ? 72 : 58;
    let v = player.v;
    if (thr) v += (nos ? 11 : 6.2) * Math.max(0, 1 - Math.pow(v / vmax, 1.7)) * dt;
    if (brk) v -= 12 * dt;
    v -= (0.25 + v * 0.004) * dt * (thr ? 0.3 : 1);
    if (!thr && !brk) v -= 0.6 * dt;
    if (v > vmax) v -= (v - vmax) * dt * 0.8;
    player.v = Math.max(0, v);
    player.nos = clamp(player.nos + (nos ? -0.22 : 0.012) * dt, 0, 1);
    player.nosOn = nos;

    const psiMax = 0.12 + 4.5 / (player.v + 8);
    if (steer) player.psi += steer * 1.25 * dt;
    else player.psi -= player.psi * Math.min(1, dt * 3.2);
    player.psi = clamp(player.psi, -psiMax, psiMax);
    if (player.v < 0.5) player.psi *= 0.9;

    const p0 = player.path, s0 = player.s;
    player.s += player.v * Math.cos(player.psi) * dt;
    player.u += player.v * Math.sin(player.psi) * dt;

    const [lo, hi] = uLimits(player.path, player.s);
    if (player.u < lo || player.u > hi) {
      const hit = Math.abs(Math.sin(player.psi)) * player.v;
      player.u = clamp(player.u, lo, hi);
      if (hit > 0.6) {
        player.v *= 1 - Math.min(0.5, hit * 0.03);
        player.damage += hit * 0.6;
        state.shake = Math.min(1, state.shake + hit * 0.05);
        audio.burst(0.25, 2400, Math.min(0.4, hit * 0.04), 2);
      }
      player.psi *= -0.25;
      player.v *= 1 - dt * 0.6;
    }

    // Gores: take the connector if you're in its lane
    const p = player.path;
    if (p.kind === 'fwy') {
      for (const d of p.deps) {
        if (d.terminal || !(s0 < d.g && player.s >= d.g)) continue;
        if ((d.side === 'R' && player.u > p.outer) || (d.side === 'L' && player.u < p.M)) {
          transfer(d.conn, player.s - d.g, clamp(player.u - d.uS, -1.6, 1.6));
          onConnector(d);
          break;
        }
      }
    }
    // End of path
    if (player.path === p && player.s >= p.len) {
      const over = player.s - p.len;
      if (p.kind === 'conn') {
        if (p.kindConn === 'ramp' && !state.free && state.dest === p.exit) { /* handled by arrival */ }
        transfer(p.to, p.sTo + over, clamp(p.uE + player.u, p.to.laneU(0), p.to.laneU(p.to.lanes - 1)));
      } else {
        const deps = p.deps.filter((d) => d.terminal).sort((a, b) => a.group - b.group);
        if (deps.length) {
          const gi = clamp(Math.floor((player.u - p.M) / (p.lanes * LW / deps.length)), 0, deps.length - 1);
          const d = deps[gi];
          transfer(d.conn, over, clamp(player.u - d.uS, -1.6, 1.6));
          onConnector(d);
        } else {
          const t = p.twin;
          player.path = t; player.s = 2; player.psi = 0; player.v *= 0.35;
          player.u = t.laneU(t.lanes - 1);
          camInit = true;
          flash('END OF THE ROAD', `Leaving ${p.fw.def.name}. Turned around onto ${t.title}.`);
        }
      }
    }
    // Arrived?
    if (!state.free && player.path.kind === 'conn' && player.path.exit === state.dest && player.s > player.path.len * 0.45) finish('arrived');
  }
  function onConnector(d) {
    if (d.exit) {
      if (!state.free && d.exit === state.dest) return;
      flash('EXIT ' + d.exit.name.toUpperCase(), state.free ? d.exit.place : 'Wrong exit! Looping back on…');
    } else {
      toast(`→ ${d.conn.to.title}`);
    }
  }

  function updateCollisions(dt) {
    const p = player.path;
    for (const c of cars) {
      if (c.path !== p) continue;
      const ds = c.s - player.s, du = c.u - player.u;
      const ox = player.hl + c.hl - Math.abs(ds), oy = player.hw + c.hw - Math.abs(du);
      // near misses: a car that just slipped from ahead to behind, close beside us
      if (!c.chp) {
        const rel = Math.sign(ds);
        if (c.rel > 0 && rel < 0 && Math.abs(du) < player.hw + c.hw + 1.1 && player.v - c.v > 4 && !c.bumped) nearMiss(c);
        c.rel = rel;
      }
      if (ox > 0 && oy > 0) {
        const relV = Math.abs(player.v - c.v);
        if (ox < oy) {
          if (ds > 0) { player.s -= ox; const nv = c.v - 1.5; c.v = Math.min(c.vd, (player.v + c.v) / 2 + 2); player.v = Math.max(0, Math.min(player.v, nv)); }
          else { player.s += ox; player.v = Math.max(player.v, c.v + 1); c.v *= 0.7; }
        } else {
          player.u -= Math.sign(du) * oy; player.psi *= -0.3;
          player.v *= 0.96;
        }
        const lat = ox >= oy ? Math.abs(Math.sin(player.psi)) * player.v * 0.6 + 2 : 0;
        const imp = (ox < oy ? relV : lat);
        if (!c.bumped || imp > 4) {
          c.bumped = 1.0;
          if (c.chp && !c.ticketed) ticket(c, 'You hit a CHP cruiser!');
          if (imp > 1.5) {
            state.crashes++;
            player.damage += imp * 2.4;
            state.shake = Math.min(1.2, state.shake + imp * 0.07);
            state.combo = 0;
            audio.burst(0.5, 300, Math.min(0.9, 0.2 + imp * 0.05), 0.5);
            audio.burst(0.3, 3000, 0.2, 1.5);
            if (!state.free) state.timeLeft -= Math.min(5, imp * 0.4);
            toast(imp > 8 ? 'CRASH!' : 'Bump');
          }
        }
      }
      if (c.bumped) { c.bumped -= dt; if (c.bumped <= 0) c.bumped = 0; }
      if (c.chp && !c.ticketed && Math.abs(ds) < 60 && player.v * MPH > 95) ticket(c, `CHP clocked you at ${Math.round(player.v * MPH)} mph`);
    }
    if (player.damage >= 100) finish('totaled');
  }
  function nearMiss(c) {
    state.near++;
    state.combo = state.comboT > 0 ? state.combo + 1 : 1;
    state.comboT = 3;
    const pts = 50 * state.combo;
    state.score += pts;
    player.nos = Math.min(1, player.nos + 0.12);
    audio.burst(0.35, 1400 + state.combo * 200, 0.25, 1.2);
    popup(`NEAR MISS${state.combo > 1 ? ' x' + state.combo : ''}  +${pts}`);
  }
  function ticket(c, why) {
    c.ticketed = true;
    state.tickets++;
    audio.siren();
    if (!state.free) state.timeLeft -= 15;
    flash('TICKET', why + (state.free ? '' : ' (−15 s)'));
  }

  // ---------- Route / GPS ----------
  function updateRoute(force) {
    if (state.free) { gpsFree(); return; }
    let p = player.path, s = player.s;
    if (p.kind === 'conn' && p.kindConn === 'ramp') {
      if (p.exit === state.dest) { gpsShow({ title: `Arriving at ${state.dest.place}`, sub: 'Exit ramp', dist: 0, lanes: null, icon: '★' }); return; }
      s = p.sTo; p = p.to;
    }
    const r = N.route(p, s, state.dest);
    state.route = r;
    if (!r) { gpsShow({ title: 'Recalculating…', sub: '', dist: 0 }); return; }
    let next = null;
    for (const st of r.steps) if (st.e.conn || st.e.uturn) { next = st; break; }
    // missed a turn?
    if (state.lastNext && state.lastNext.p === player.path && player.s > state.lastNext.g + 3 && (!next || next.e.conn !== state.lastNext.conn)) {
      popup('Missed it — rerouting'); audio.tone([330, 262], 0.25, 'triangle', 0.08);
    }
    if (next && next.e.conn) state.lastNext = { p: next.node.p, g: next.node.s, conn: next.e.conn };
    else state.lastNext = null;
    const exitD = r.dist;
    if (!next || next.d > exitD) {
      const dep = r.exitDep;
      gpsShow({ title: `Exit ${state.dest.name}`, sub: state.dest.place, dist: exitD, lanes: laneHint(r.goal.p, dep), icon: 'EXIT' });
      return;
    }
    if (next.e.uturn) { gpsShow({ title: 'Road ends — turn around', sub: next.node.p.title, dist: next.d, icon: '↺' }); return; }
    const conn = next.e.conn, dep = next.e.dep;
    gpsShow({ title: `${conn.to.title}`, sub: conn.to.city, dist: next.d, lanes: laneHint(next.node.p, dep), fw: conn.to.fw });
  }
  function laneHint(p, dep) {
    const lanes = [];
    const n = p.lanes;
    if (dep.terminal) {
      const per = n / dep.groups;
      for (let i = 0; i < n; i++) lanes.push({ on: i + 0.5 >= dep.group * per && i + 0.5 <= (dep.group + 1) * per });
      return { lanes, text: dep.groups === 1 ? 'Any lane' : dep.group === 0 ? 'Keep LEFT' : dep.group === dep.groups - 1 ? 'Keep RIGHT' : 'Use MIDDLE lanes' };
    }
    if (dep.side === 'L') { lanes.push({ on: true, aux: true }); for (let i = 0; i < n; i++) lanes.push({ on: false }); return { lanes, text: 'LEFT exit lane' }; }
    for (let i = 0; i < n; i++) lanes.push({ on: false });
    lanes.push({ on: true, aux: true });
    return { lanes, text: 'RIGHT exit lane' };
  }
  function gpsFree() {
    const p = player.path.kind === 'conn' ? player.path.to : player.path;
    const s = player.path.kind === 'conn' ? player.path.sTo : player.s;
    const nx = p.deps.find((d) => d.g > s + 5 && !d.exit);
    if (!nx) { gpsShow({ title: p.deadEnd ? 'Road ends ahead' : 'Interchange ahead', sub: p.title, dist: p.len - s, icon: '↺' }); return; }
    if (nx.terminal) {
      const opts = p.deps.filter((d) => d.terminal).map((d) => d.conn.to.title).join(' / ');
      gpsShow({ title: 'Freeway ends', sub: opts, dist: nx.g - s, icon: '⑂' });
      return;
    }
    gpsShow({ title: `Next: ${nx.conn.to.title}`, sub: nx.conn.to.city, dist: nx.g - s, lanes: laneHint(p, nx), fw: nx.conn.to.fw });
  }
  function fmtDist(m) {
    const mi = m / 1609.34;
    if (mi < 0.19) return Math.max(0, Math.round(m * 3.28084 / 50) * 50) + ' ft';
    return mi.toFixed(1) + ' mi';
  }
  let gpsKey = '';
  function gpsShow(o) {
    $('gpsDist').textContent = o.dist ? fmtDist(o.dist) : '';
    const key = o.title + '|' + o.sub + '|' + (o.lanes ? o.lanes.text + o.lanes.lanes.length : '') + (o.fw ? o.fw.id : '');
    if (key === gpsKey) return;
    gpsKey = key;
    $('gpsTitle').textContent = o.title;
    $('gpsSub').textContent = o.sub || '';
    const ic = $('gpsIcon');
    if (o.fw) ic.innerHTML = `<img src="${shieldURL(o.fw)}" alt="">`;
    else ic.innerHTML = `<span>${o.icon || ''}</span>`;
    const ln = $('gpsLanes');
    if (o.lanes) {
      ln.innerHTML = o.lanes.lanes.map((l) => `<i class="${l.on ? 'on' : ''} ${l.aux ? 'aux' : ''}"></i>`).join('') + `<b>${o.lanes.text}</b>`;
      ln.classList.remove('hidden');
    } else ln.classList.add('hidden');
  }

  // ---------- HUD ----------
  let toastT = 0, popT = 0, flashT = 0;
  function toast(t) { $('toast').textContent = t; $('toast').classList.add('show'); toastT = 1.8; }
  function popup(t) { const el = $('popup'); el.textContent = t; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); popT = 1.2; }
  function flash(a, b) { $('flashA').textContent = a; $('flashB').textContent = b || ''; $('flash').classList.add('show'); flashT = 2.0; }
  const fmtT = (t) => { t = Math.max(0, t); const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + String(s).padStart(2, '0'); };
  let hudT = 0;
  function updateHUD(dt) {
    $('speed').textContent = Math.round(player.v * MPH);
    hudT -= dt;
    if (toastT > 0 && (toastT -= dt) <= 0) $('toast').classList.remove('show');
    if (flashT > 0 && (flashT -= dt) <= 0) $('flash').classList.remove('show');
    if (hudT > 0) return;
    hudT = 0.1;
    $('nosFill').style.width = (player.nos * 100).toFixed(0) + '%';
    $('dmgFill').style.width = clamp(player.damage, 0, 100).toFixed(0) + '%';
    $('score').textContent = state.score.toLocaleString();
    const p = player.path;
    let road;
    if (p.kind === 'conn') road = p.kindConn === 'ramp' ? `Exit ${p.exit.name} · ${p.exit.place}` : `Ramp to ${p.to.title}`;
    else road = `${p.title} · ${p.fw.def.label}`;
    $('road').textContent = road;
    const lim = p.kind === 'conn' ? 45 : p.limit;
    $('limit').textContent = lim;
    $('speedBox').classList.toggle('over', player.v * MPH > lim + 25);
    if (!state.free) {
      $('timer').textContent = fmtT(state.timeLeft);
      $('timer').classList.toggle('low', state.timeLeft < 20);
      $('dest').textContent = state.dest.place;
    }
  }

  // ---------- Minimap / full map ----------
  const mm = $('minimap'), mg = mm.getContext('2d');
  const fm = $('fullmap'), fg = fm.getContext('2d');
  let mmT = 0;
  function drawNetwork(g, tf, scale, thick, routeOnly) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (!routeOnly) {
      for (const F of N.fws) {
        const p = F.paths[0];
        g.strokeStyle = thick > 3 ? F.def.color : '#9aa4ad';
        g.lineWidth = thick;
        g.beginPath();
        const step = Math.max(1, Math.floor(6 / (scale * 4)));
        for (let i = 0; i < p.n; i += step) { const [x, y] = tf(p.x[i], p.z[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
        const [x, y] = tf(p.x[p.n - 1], p.z[p.n - 1]); g.lineTo(x, y);
        g.stroke();
      }
    }
    if (state.route && !state.free) {
      g.strokeStyle = '#33c3ff'; g.lineWidth = thick + 2.5; g.globalAlpha = 0.9;
      g.beginPath();
      let first = true;
      const seg = (p, a, b) => {
        const step = Math.max(1, Math.floor(6 / (scale * 4)));
        for (let s = a; s <= b; s += step * N.STEP) { const f = p.frame(s, p.kind === 'conn' ? 0 : p.outer / 2, tmpF); const [x, y] = tf(f.x, f.z); first ? g.moveTo(x, y) : g.lineTo(x, y); first = false; }
        const f = p.frame(b, p.kind === 'conn' ? 0 : p.outer / 2, tmpF); const [x, y] = tf(f.x, f.z); g.lineTo(x, y);
      };
      const r = state.route;
      let cp = player.path, cs = player.s;
      if (cp.kind === 'conn') { seg(cp, cs, cp.len); cs = cp.sTo; cp = cp.to; }
      for (const st of r.steps) {
        if (st.e.conn) { seg(cp, cs, st.node.s); seg(st.e.conn, 0, st.e.conn.len); cp = st.e.conn.to; cs = st.e.conn.sTo; }
        else if (st.e.uturn) { seg(cp, cs, cp.len); cp = cp.twin; cs = 0; }
      }
      seg(cp, cs, r.goal.s);
      g.stroke();
      g.globalAlpha = 1;
    }
  }
  function destXY() {
    if (!state.dest) return null;
    const r = state.dest.ramps[0];
    const f = r.path.frame(r.dep.g, r.path.outer, {});
    return f;
  }
  function drawMinimap() {
    const w = mm.width, h = mm.height, R = w / 2;
    const f = player.path.frame(player.s, player.u, {});
    const heading = Math.atan2(f.tx, -f.tz) + player.psi;
    const scale = 0.085;
    mg.clearRect(0, 0, w, h);
    mg.save();
    mg.beginPath(); mg.arc(R, R, R - 2, 0, Math.PI * 2); mg.clip();
    mg.fillStyle = 'rgba(16,22,30,0.82)'; mg.fillRect(0, 0, w, h);
    const ca = Math.cos(-heading), sa = Math.sin(-heading);
    const tf = (x, z) => { const dx = (x - f.x) * scale, dz = (z - f.z) * scale; return [R + dx * ca - dz * sa, R * 1.25 + dx * sa + dz * ca]; };
    // ocean
    mg.fillStyle = 'rgba(40,110,170,0.55)';
    mg.beginPath(); W.oceanPoly.forEach((q, i) => { const [x, y] = tf(q.x, q.z); i ? mg.lineTo(x, y) : mg.moveTo(x, y); }); mg.fill();
    drawNetwork(mg, tf, scale, 3);
    const d = destXY();
    if (d) {
      let [x, y] = tf(d.x, d.z);
      const dd = Math.hypot(x - R, y - R);
      if (dd > R - 12) { x = R + (x - R) * (R - 12) / dd; y = R + (y - R) * (R - 12) / dd; }
      mg.fillStyle = '#ffd23f'; mg.beginPath(); mg.arc(x, y, 6, 0, 7); mg.fill();
      mg.strokeStyle = '#000'; mg.lineWidth = 1.5; mg.stroke();
    }
    // player arrow
    mg.fillStyle = '#ff5a4f'; mg.strokeStyle = '#fff'; mg.lineWidth = 2;
    mg.beginPath(); mg.moveTo(R, R * 1.25 - 10); mg.lineTo(R + 7, R * 1.25 + 7); mg.lineTo(R, R * 1.25 + 3); mg.lineTo(R - 7, R * 1.25 + 7); mg.closePath(); mg.fill(); mg.stroke();
    mg.restore();
    // north marker
    const nx = R + Math.sin(-heading) * (R - 12), ny = R - Math.cos(-heading) * (R - 12);
    mg.fillStyle = '#fff'; mg.font = 'bold 13px Arial'; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillText('N', nx, ny);
  }
  function drawFullMap() {
    fm.width = window.innerWidth * Math.min(2, devicePixelRatio); fm.height = window.innerHeight * Math.min(2, devicePixelRatio);
    const w = fm.width, h = fm.height, b = N.bounds, pad = 60 * Math.min(2, devicePixelRatio);
    const scale = Math.min((w - pad * 2) / (b.maxX - b.minX), (h - pad * 2) / (b.maxZ - b.minZ));
    const ox = (w - (b.maxX - b.minX) * scale) / 2, oz = (h - (b.maxZ - b.minZ) * scale) / 2;
    const tf = (x, z) => [ox + (x - b.minX) * scale, oz + (z - b.minZ) * scale];
    fg.fillStyle = '#1b222b'; fg.fillRect(0, 0, w, h);
    fg.fillStyle = '#1f4f78';
    fg.beginPath(); W.oceanPoly.forEach((q, i) => { const [x, y] = tf(q.x, q.z); i ? fg.lineTo(x, y) : fg.moveTo(x, y); }); fg.fill();
    drawNetwork(fg, tf, scale, 5 * Math.min(2, devicePixelRatio));
    // labels
    const k = Math.min(2, devicePixelRatio);
    fg.font = `bold ${13 * k}px Arial`; fg.textAlign = 'center'; fg.textBaseline = 'middle';
    for (const F of N.fws) {
      const p = F.paths[0];
      for (const t of [0.3, 0.75]) {
        const i = Math.floor(p.n * t); const [x, y] = tf(p.x[i], p.z[i]);
        const txt = F.def.name;
        const tw = fg.measureText(txt).width + 10 * k;
        fg.fillStyle = F.def.color; fg.fillRect(x - tw / 2, y - 10 * k, tw, 20 * k);
        fg.fillStyle = '#fff'; fg.fillText(txt, x, y);
      }
    }
    for (const ex of N.exits) {
      if (!ex.ramps.length) continue;
      const r = ex.ramps[0], f = r.path.frame(r.dep.g, 0, {});
      const [x, y] = tf(f.x, f.z);
      const isDest = state.dest === ex;
      fg.fillStyle = isDest ? '#ffd23f' : 'rgba(255,255,255,0.7)';
      fg.beginPath(); fg.arc(x, y, (isDest ? 7 : 3) * k, 0, 7); fg.fill();
      if (isDest || fm.dataset.labels === '1') { fg.font = `${isDest ? 'bold ' : ''}${12 * k}px Arial`; fg.fillText(ex.place, x, y - 14 * k); }
    }
    const f = player.path.frame(player.s, player.u, {});
    const [px, py] = tf(f.x, f.z);
    fg.fillStyle = '#ff5a4f'; fg.strokeStyle = '#fff'; fg.lineWidth = 2 * k;
    fg.beginPath(); fg.arc(px, py, 8 * k, 0, 7); fg.fill(); fg.stroke();
    fg.fillStyle = '#fff'; fg.font = `bold ${15 * k}px Arial`; fg.textAlign = 'left';
    fg.fillText('ORANGE COUNTY FREEWAYS', 24 * k, 30 * k);
    fg.font = `${12 * k}px Arial`; fg.fillStyle = '#b8c2cc';
    fg.fillText('Distances compressed 2.5×. Press M to close.', 24 * k, 52 * k);
  }

  // ---------- Camera ----------
  let camInit = true;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let camHead = 0;
  function updateCamera(dt) {
    const f = player.path.frame(player.s, player.u, {});
    // world heading of the car: rotate tangent by psi toward right
    const ca = Math.cos(player.psi), sa = Math.sin(player.psi);
    const dx = f.tx * ca - f.tz * sa, dz = f.tz * ca + f.tx * sa;
    const yaw = Math.atan2(dx, dz);
    const m = player.mesh;
    m.position.set(f.x, f.y, f.z);
    m.rotation.y = yaw; m.rotation.x = -Math.atan(f.slope);
    m.rotation.z = -player.psi * 0.25;
    if (camInit) { camHead = yaw; }
    let dh = yaw - camHead; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    camHead += dh * Math.min(1, dt * 5);
    const hx = Math.sin(camHead), hz = Math.cos(camHead);
    let want, look;
    if (state.camMode === 0) {
      want = new THREE.Vector3(f.x - hx * 9, f.y + 3.4, f.z - hz * 9);
      look = new THREE.Vector3(f.x + hx * 8, f.y + 1.2, f.z + hz * 8);
    } else if (state.camMode === 1) {
      want = new THREE.Vector3(f.x - hx * 16, f.y + 6.5, f.z - hz * 16);
      look = new THREE.Vector3(f.x + hx * 10, f.y + 1, f.z + hz * 10);
    } else {
      want = new THREE.Vector3(f.x + dx * 0.4, f.y + 1.15, f.z + dz * 0.4);
      look = new THREE.Vector3(f.x + dx * 30, f.y + 1.0, f.z + dz * 30);
    }
    if (camInit) { camPos.copy(want); camLook.copy(look); camInit = false; }
    const k = state.camMode === 2 ? 1 : Math.min(1, dt * 7);
    camPos.lerp(want, k); camLook.lerp(look, state.camMode === 2 ? 1 : Math.min(1, dt * 10));
    camera.position.copy(camPos);
    if (state.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * state.shake * 0.6;
      camera.position.y += (Math.random() - 0.5) * state.shake * 0.4;
      state.shake = Math.max(0, state.shake - dt * 1.8);
    }
    camera.lookAt(camLook);
    const fov = 60 + clamp((player.v - 20) / 50, 0, 1) * 14 + (player.nosOn ? 6 : 0);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
    // sky + sun follow the camera
    sky.position.copy(camera.position);
    const sd = sun.userData.dir;
    sun.position.set(f.x + sd.x * 500, f.y + sd.y * 500, f.z + sd.z * 500);
    sun.target.position.set(f.x, f.y, f.z);
    sunDisc.position.set(camera.position.x + sd.x * 9000, camera.position.y + sd.y * 9000, camera.position.z + sd.z * 9000);
    sunDisc.lookAt(camera.position);
    headlight.position.set(f.x + dx * 1.5, f.y + 1.0, f.z + dz * 1.5);
    headlight.target.position.set(f.x + dx * 40, f.y, f.z + dz * 40);
  }

  // ---------- Finish ----------
  function finish(kind) {
    if (state.mode !== 'drive') return;
    state.mode = 'results';
    const r = $('results');
    const ok = kind === 'arrived';
    let total = 0;
    const rows = [];
    if (ok) {
      const timeBonus = Math.round(Math.max(0, state.timeLeft) * 20);
      const clean = state.crashes === 0 ? 500 : 0;
      total = state.score + timeBonus + clean - state.tickets * 250;
      rows.push(['Time', fmtT(state.elapsed)], ['Time left', `${fmtT(state.timeLeft)}  (+${timeBonus})`], ['Near misses', `${state.near}  (+${state.score})`],
        ['Crashes', `${state.crashes}${clean ? '  (+500 clean run)' : ''}`], ['Tickets', `${state.tickets}${state.tickets ? `  (−${state.tickets * 250})` : ''}`]);
      const key = 'best.' + (state.mission.random ? 'random' : state.mission.dest + '.' + state.mission.title);
      const best = store.get(key, 0);
      if (total > best) store.set(key, total);
      rows.push(['Score', total.toLocaleString() + (total > best ? '  NEW BEST' : `  (best ${best.toLocaleString()})`)]);
      audio.tone([523, 659, 784, 1046], [0.15, 0.15, 0.15, 0.5], 'triangle', 0.09);
    } else {
      rows.push(['Time', fmtT(state.elapsed)], ['Near misses', state.near], ['Crashes', state.crashes], ['Tickets', state.tickets]);
      audio.tone([392, 330, 262], [0.2, 0.2, 0.5], 'triangle', 0.09);
    }
    $('resTitle').textContent = ok ? 'YOU MADE IT' : kind === 'late' ? 'TOO LATE' : 'TOTALED';
    $('resSub').textContent = ok ? `${state.dest.place} via ${state.dest.name}` : kind === 'late' ? `${state.dest.place} will have to wait.` : 'Call a tow truck.';
    $('resRows').innerHTML = rows.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
    r.classList.remove('hidden');
    $('hud').classList.add('hidden');
  }

  // ---------- Menus ----------
  function hideAll() { for (const id of ['menu', 'pause', 'results', 'fullmapWrap', 'freePick']) $(id).classList.add('hidden'); }
  function showMenu() {
    state.mode = 'menu';
    hideAll(); $('hud').classList.add('hidden'); $('menu').classList.remove('hidden');
    renderMissions();
  }
  function renderMissions() {
    $('missions').innerHTML = D.missions.map((m, i) => {
      const ex = N.exitById[m.dest];
      const best = store.get('best.' + m.dest + '.' + m.title, 0);
      return `<button class="card" data-i="${i}"><b>${m.title}</b><span>${m.blurb}</span><em>→ ${ex.place}${best ? ` · best ${best.toLocaleString()}` : ''}</em></button>`;
    }).join('');
    document.querySelectorAll('#missions .card').forEach((b) => b.addEventListener('click', () => startMission(D.missions[+b.dataset.i])));
  }
  function pause(on) {
    if (on && state.mode === 'drive') { state.mode = 'pause'; $('pause').classList.remove('hidden'); }
    else if (!on && state.mode === 'pause') { state.mode = 'drive'; $('pause').classList.add('hidden'); }
  }
  function toggleMap() {
    const el = $('fullmapWrap');
    if (el.classList.contains('hidden')) { if (state.mode !== 'drive' && state.mode !== 'pause') return; drawFullMap(); el.classList.remove('hidden'); if (state.mode === 'drive') { state.mode = 'map'; } }
    else { el.classList.add('hidden'); if (state.mode === 'map') state.mode = 'drive'; }
  }
  function onKey(code) {
    if (code === 'Escape' || code === 'KeyP') {
      if (state.mode === 'map') toggleMap();
      else if (state.mode === 'drive') pause(true);
      else if (state.mode === 'pause') pause(false);
    } else if (code === 'KeyM' || code === 'Tab') toggleMap();
    else if (code === 'KeyC' && state.mode === 'drive') state.camMode = (state.camMode + 1) % 3;
    else if (code === 'KeyH' && state.mode === 'drive') audio.tone([392, 494], 0.35, 'square', 0.06);
    else if (code === 'KeyN') { audio.set(!audio.on); toast(audio.on ? 'Sound on' : 'Sound off'); }
    else if (code === 'KeyR' && state.mode === 'drive' && player.path.kind === 'fwy') {
      player.u = player.path.laneU(Math.floor(player.path.lanes / 2)); player.psi = 0; camInit = true;
    }
  }
  function bindOpt(id, key, vals, after) {
    const el = $(id);
    el.innerHTML = vals.map(([v, t]) => `<button data-v="${v}" class="${settings[key] === v ? 'sel' : ''}">${t}</button>`).join('');
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      settings[key] = b.dataset.v; store.set(key, b.dataset.v);
      el.querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b));
      if (after) after(b.dataset.v);
    }));
  }
  bindOpt('optTod', 'tod', [['day', 'Day'], ['sunset', 'Sunset'], ['night', 'Night']], applyTOD);
  bindOpt('optTraffic', 'traffic', [['light', 'Light'], ['normal', 'Normal'], ['rush', 'Rush hour']]);
  bindOpt('optGfx', 'gfx', [['high', 'High'], ['low', 'Low']], (v) => { renderer.setPixelRatio(v === 'high' ? Math.min(2, window.devicePixelRatio) : 1); renderer.setSize(window.innerWidth, window.innerHeight); });
  $('btnRandom').addEventListener('click', startRandom);
  $('btnFree').addEventListener('click', () => {
    $('freeList').innerHTML = N.fws.map((F) => `<button data-id="${F.id}"><img src="${shieldURL(F)}" alt=""><span><b>${F.def.name}</b>${F.def.label}</span></button>`).join('');
    $('freeList').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => startFree(b.dataset.id)));
    $('menu').classList.add('hidden'); $('freePick').classList.remove('hidden');
  });
  $('btnFreeBack').addEventListener('click', showMenu);
  $('btnResume').addEventListener('click', () => pause(false));
  $('btnQuit').addEventListener('click', showMenu);
  $('btnMenu').addEventListener('click', showMenu);
  $('btnRetry').addEventListener('click', () => {
    const m = state.mission;
    if (m && m.random) { state.dest = N.exitById[m.dest]; placePlayer(m.start.p, m.start.s, Math.floor(m.start.p.lanes / 2)); state.free = false; beginRun(); }
    else if (m) startMission(m);
    else showMenu();
  });
  $('fullmapWrap').addEventListener('click', toggleMap);
  $('btnSound').addEventListener('click', () => { audio.set(!audio.on); $('btnSound').textContent = audio.on ? 'Sound: on' : 'Sound: off'; });
  $('btnSound').textContent = audio.on ? 'Sound: on' : 'Sound: off';

  // ---------- Main loop ----------
  let last = performance.now();
  // Menu backdrop: slow flyover of the Orange Crush
  const crush = N.proj([33.7781, -117.8782]);
  function menuCam(t) {
    const a = t * 0.03;
    camera.position.set(crush.x + Math.cos(a) * 420, 160, crush.z + Math.sin(a) * 420);
    camera.lookAt(crush.x, 0, crush.z);
    sky.position.copy(camera.position);
    const sd = sun.userData.dir;
    sunDisc.position.set(camera.position.x + sd.x * 9000, camera.position.y + sd.y * 9000, camera.position.z + sd.z * 9000);
    sunDisc.lookAt(camera.position);
    if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    if (world.wheel) world.wheel.rotation.z += dt * 0.08;
    if (world.balloon) world.balloon.position.y = Math.sin(clock * 0.3) * 4;
    if (state.mode === 'drive') {
      state.elapsed += dt;
      updatePlayer(dt);
      updateCollisions(dt);
      if ((state.focusT -= dt) <= 0) { state.focusT = 0.5; focus = computeFocus(); }
      fillTraffic(false);
      updateTraffic(dt);
      if ((state.routeT -= dt) <= 0) { state.routeT = 0.4; updateRoute(); }
      if (state.comboT > 0) state.comboT -= dt;
      if (!state.free) {
        state.timeLeft -= dt;
        if (state.timeLeft <= 0) finish('late');
      } else if (player.damage >= 100) player.damage = 0;
      updateCamera(dt);
      updateHUD(dt);
      if ((mmT -= dt) <= 0) { mmT = 0.08; drawMinimap(); }
      audio.update(player.v, (pressed('KeyW', 'ArrowUp') || touch.g) ? 1 : 0);
    } else if (state.mode === 'menu') {
      menuCam(clock);
      audio.update(0, 0);
    } else {
      audio.update(0, 0);
    }
    if ((state.signT -= dt) <= 0) { state.signT = 0.25; updateSigns(); }
    renderer.render(scene, camera);
  }

  // Debug hooks for automated checks
  window.OCFR = {
    N, state, player, cars, startMission, startRandom, startFree, settings, world, camera, applyTOD,
    tick(dt) { // headless simulation step used by automated tests
      if (state.mode !== 'drive') return;
      state.elapsed += dt; updatePlayer(dt); updateCollisions(dt);
      if ((state.focusT -= dt) <= 0) { state.focusT = 0.5; focus = computeFocus(); }
      fillTraffic(false); updateTraffic(dt);
      if ((state.routeT -= dt) <= 0) { state.routeT = 0.4; updateRoute(); }
      if (!state.free) { state.timeLeft -= dt; if (state.timeLeft <= 0) finish('late'); }
    }
  };

  $('loading').classList.add('hidden');
  showMenu();
  requestAnimationFrame(frame);
})();
