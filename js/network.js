// Builds the drivable freeway network from OC_DATA: smoothed centerlines, one path per
// direction, interchange connectors, exit ramps, and a routing graph for the GPS.
(function () {
  'use strict';
  const D = window.OC_DATA;
  const N = (window.OCN = {});

  // Map is compressed 2.5x so commutes take minutes, not half an hour.
  const SCALE = 0.4, LAT0 = 33.70, LON0 = -117.85;
  const KX = Math.cos(LAT0 * Math.PI / 180) * 111320 * SCALE, KZ = 110574 * SCALE;
  const LW = 3.7, STEP = 4;
  const GORE = 200, AUX = 240, MERGE = 200, RAMP = 330, EXIT_AUX = 200;
  Object.assign(N, { SCALE, LW, STEP, AUX, RAMP });

  const proj = (ll) => ({ x: (ll[1] - LON0) * KX, z: -(ll[0] - LAT0) * KZ });
  N.proj = proj;

  // ---------- Path: a one-way ribbon of road sampled every ~4 m ----------
  class Path {
    constructor(x, y, z, o) {
      const n = x.length;
      this.x = x; this.y = y; this.z = z; this.n = n;
      const s = new Float64Array(n);
      for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]);
      this.s = s; this.len = s[n - 1]; this.ds = this.len / (n - 1);
      this.tx = new Float64Array(n); this.tz = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
        let dx = x[b] - x[a], dz = z[b] - z[a];
        const l = Math.hypot(dx, dz) || 1;
        this.tx[i] = dx / l; this.tz[i] = dz / l;
      }
      this.deps = []; this.arrs = []; this.exits = [];
      Object.assign(this, o);
    }
    idx(s) {
      const S = this.s, n = this.n;
      if (s <= 0) return 0;
      if (s >= this.len) return n - 2;
      let i = Math.min(n - 2, Math.max(0, Math.floor(s / this.ds)));
      while (i > 0 && S[i] > s) i--;
      while (i < n - 2 && S[i + 1] <= s) i++;
      return i;
    }
    frame(s, u, o) {
      o = o || {};
      const i = this.idx(s), S = this.s;
      const seg = S[i + 1] - S[i] || 1;
      const f = Math.min(1, Math.max(0, (s - S[i]) / seg));
      let tx = this.tx[i] + (this.tx[i + 1] - this.tx[i]) * f;
      let tz = this.tz[i] + (this.tz[i + 1] - this.tz[i]) * f;
      const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      o.tx = tx; o.tz = tz;
      o.x = this.x[i] + (this.x[i + 1] - this.x[i]) * f - tz * u;
      o.z = this.z[i] + (this.z[i + 1] - this.z[i]) * f + tx * u;
      o.y = this.y[i] + (this.y[i + 1] - this.y[i]) * f;
      o.slope = (this.y[i + 1] - this.y[i]) / seg;
      return o;
    }
    get outer() { return this.M + this.lanes * LW; }
    laneU(i) { return this.M + LW * (i + 0.5); }
    // Right-hand auxiliary lane zones (exit-only lanes) active at s
    zoneAt(s, side) {
      for (const d of this.deps) {
        if (d.terminal || d.side !== side) continue;
        if (s >= d.zs && s <= d.g + 2) return d;
      }
      return null;
    }
  }
  N.Path = Path;

  function resample(pts, step) {
    // pts: [{x,y,z}] dense polyline -> uniform arrays
    const xs = [pts[0].x], ys = [pts[0].y], zs = [pts[0].z];
    let carry = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const L = Math.hypot(b.x - a.x, b.z - a.z);
      if (L < 1e-6) continue;
      let d = step - carry;
      while (d <= L) {
        const f = d / L;
        xs.push(a.x + (b.x - a.x) * f); ys.push(a.y + (b.y - a.y) * f); zs.push(a.z + (b.z - a.z) * f);
        d += step;
      }
      carry = L - (d - step);
    }
    const last = pts[pts.length - 1];
    if (carry > step * 0.3) { xs.push(last.x); ys.push(last.y); zs.push(last.z); }
    else { xs[xs.length - 1] = last.x; ys[ys.length - 1] = last.y; zs[zs.length - 1] = last.z; }
    return [Float64Array.from(xs), Float64Array.from(ys), Float64Array.from(zs)];
  }

  // ---------- 1. Smoothed centerlines ----------
  const fws = D.freeways.map((def, idx) => {
    const P = def.pts.map(proj);
    const curve = new THREE.CatmullRomCurve3(P.map((p) => new THREE.Vector3(p.x, 0, p.z)), false, 'centripetal');
    curve.arcLengthDivisions = P.length * 400;
    const L = curve.getLength();
    const sp = curve.getSpacedPoints(Math.max(4, Math.round(L / STEP)));
    return { def, idx, id: def.id, cx: sp.map((v) => v.x), cz: sp.map((v) => v.z), ends: [null, null], crossings: [] };
  });
  N.fws = fws;
  const fwById = {};
  fws.forEach((f) => (fwById[f.id] = f));
  N.fwById = fwById;

  function nearestOn(cx, cz, x, z) {
    let best = 1e18, bi = 0;
    for (let i = 0; i < cx.length; i++) {
      const d = (cx[i] - x) ** 2 + (cz[i] - z) ** 2;
      if (d < best) { best = d; bi = i; }
    }
    return { i: bi, d: Math.sqrt(best) };
  }

  // ---------- 2. Interchanges ----------
  // Freeway ends that land on another freeway (T / Y interchanges)
  const endJ = [];
  for (const A of fws) {
    for (const e of [0, 1]) {
      const i = e === 0 ? 0 : A.cx.length - 1;
      const x = A.cx[i], z = A.cz[i];
      for (const B of fws) {
        if (B === A) continue;
        const nb = nearestOn(B.cx, B.cz, x, z);
        if (nb.d < 120 && nb.i > 10 && nb.i < B.cx.length - 10) {
          endJ.push({ A, e, B, x: B.cx[nb.i], z: B.cz[nb.i] });
        }
      }
    }
  }
  // Mid-route crossings (full interchanges)
  const crossJ = [];
  function segX(ax, az, bx, bz, cx, cz, dx, dz) {
    const r1x = bx - ax, r1z = bz - az, r2x = dx - cx, r2z = dz - cz;
    const den = r1x * r2z - r1z * r2x;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((cx - ax) * r2z - (cz - az) * r2x) / den;
    const u = ((cx - ax) * r1z - (cz - az) * r1x) / den;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { x: ax + r1x * t, z: az + r1z * t };
  }
  const nearEnd = (F, x, z) => {
    const n = F.cx.length - 1;
    return Math.hypot(F.cx[0] - x, F.cz[0] - z) < 160 || Math.hypot(F.cx[n] - x, F.cz[n] - z) < 160;
  };
  for (let a = 0; a < fws.length; a++) {
    for (let b = a + 1; b < fws.length; b++) {
      const A = fws[a], B = fws[b], K = 6;
      for (let i = 0; i + K < A.cx.length + K - 1; i += K) {
        const i2 = Math.min(i + K, A.cx.length - 1);
        if (i2 === i) break;
        const minAx = Math.min(A.cx[i], A.cx[i2]) - 1, maxAx = Math.max(A.cx[i], A.cx[i2]) + 1;
        const minAz = Math.min(A.cz[i], A.cz[i2]) - 1, maxAz = Math.max(A.cz[i], A.cz[i2]) + 1;
        for (let j = 0; j < B.cx.length - 1; j += K) {
          const j2 = Math.min(j + K, B.cx.length - 1);
          if (Math.max(B.cx[j], B.cx[j2]) < minAx || Math.min(B.cx[j], B.cx[j2]) > maxAx) continue;
          if (Math.max(B.cz[j], B.cz[j2]) < minAz || Math.min(B.cz[j], B.cz[j2]) > maxAz) continue;
          const p = segX(A.cx[i], A.cz[i], A.cx[i2], A.cz[i2], B.cx[j], B.cz[j], B.cx[j2], B.cz[j2]);
          if (!p || nearEnd(A, p.x, p.z) || nearEnd(B, p.x, p.z)) continue;
          if (crossJ.some((c) => c.A === A && c.B === B && Math.hypot(c.x - p.x, c.z - p.z) < 150)) continue;
          crossJ.push({ A, B, x: p.x, z: p.z });
        }
      }
    }
  }

  // ---------- 3. Trim freeway ends that terminate into another freeway ----------
  for (const j of endJ) {
    const A = j.A, R = 40 + j.B.def.lanes * LW + 8;
    if (j.e === 0) {
      let k = 0;
      while (k < A.cx.length - 2 && Math.hypot(A.cx[k] - j.x, A.cz[k] - j.z) < R) k++;
      if (!A.trim0 || k > A.trim0) A.trim0 = k;
    } else {
      let k = A.cx.length - 1;
      while (k > 1 && Math.hypot(A.cx[k] - j.x, A.cz[k] - j.z) < R) k--;
      if (A.trim1 === undefined || k < A.trim1) A.trim1 = k;
    }
  }
  for (const F of fws) {
    const a = F.trim0 || 0, b = F.trim1 === undefined ? F.cx.length - 1 : F.trim1;
    F.cx = F.cx.slice(a, b + 1); F.cz = F.cz.slice(a, b + 1);
    const n = F.cx.length;
    F.cs = new Float64Array(n);
    for (let i = 1; i < n; i++) F.cs[i] = F.cs[i - 1] + Math.hypot(F.cx[i] - F.cx[i - 1], F.cz[i] - F.cz[i - 1]);
    F.len = F.cs[n - 1];
    F.cy = new Float64Array(n);
  }
  const sOn = (F, x, z) => F.cs[nearestOn(F.cx, F.cz, x, z).i];

  // Bridges: the freeway later in the list flies over the earlier one
  for (const c of crossJ) {
    const top = c.B, sc = sOn(top, c.x, c.z);
    for (let i = 0; i < top.cx.length; i++) {
      const d = Math.abs(top.cs[i] - sc);
      let h = 0;
      if (d < 45) h = 1; else if (d < 300) h = 0.5 + 0.5 * Math.cos(Math.PI * (d - 45) / 255);
      top.cy[i] = Math.max(top.cy[i], 8.5 * h);
    }
  }

  // ---------- 4. Directional paths ----------
  const paths = [];
  for (const F of fws) {
    const def = F.def;
    const surface = !!def.surface;
    const base = { kind: 'fwy', fw: F, lanes: def.lanes, M: surface ? 0.3 : 5.0, surface, limit: def.limit };
    const x = Float64Array.from(F.cx), z = Float64Array.from(F.cz), y = Float64Array.from(F.cy);
    const fwd = new Path(x, y, z, Object.assign({ dir: 0 }, base));
    const rev = new Path(x.slice().reverse(), y.slice().reverse(), z.slice().reverse(), Object.assign({ dir: 1 }, base));
    fwd.twin = rev; rev.twin = fwd;
    F.paths = [fwd, rev];
    fwd.id = paths.length; paths.push(fwd);
    rev.id = paths.length; paths.push(rev);
    for (const p of [fwd, rev]) {
      p.dirName = def.dirs[p.dir][0];
      p.city = def.dirs[p.dir][1];
      p.title = def.name + ' ' + p.dirName;
    }
  }
  N.paths = paths;
  const sPath = (p, x, z) => {
    const sc = sOn(p.fw, x, z);
    return p.dir === 0 ? sc : p.len - sc;
  };
  const tmp = {}, tmp2 = {};
  const right = (f) => ({ x: -f.tz, z: f.tx });

  // ---------- 5. Movements (which connector goes where) ----------
  const moves = [];
  const pushMove = (m) => {
    if (m.from.surface) m.side = 'R';
    if (m.to.surface) m.arriveSide = 'R';
    moves.push(m);
  };
  for (const c of crossJ) {
    for (const [A, B] of [[c.A, c.B], [c.B, c.A]]) {
      for (const a of A.paths) {
        const sa = sPath(a, c.x, c.z);
        const fa = a.frame(sa, 0, {});
        for (const b of B.paths) {
          const sb = sPath(b, c.x, c.z);
          const fb = b.frame(sb, 0, {});
          if (fa.tx * fb.tx + fa.tz * fb.tz < -0.8) continue;
          if (sa < GORE + 120 || sb + MERGE > b.len - 40) continue;
          const r = right(fa);
          const side = fb.tx * r.x + fb.tz * r.z > 0 ? 'R' : 'L';
          pushMove({ from: a, sPoint: sa, to: b, sTo: sb + MERGE, side, arriveSide: side, turn: fb.tx * r.x + fb.tz * r.z });
        }
      }
    }
  }
  for (const j of endJ) {
    const A = j.A, B = j.B;
    // path of A that ends here, and the one that starts here
    const aEnd = j.e === 1 ? A.paths[0] : A.paths[1];
    const aStart = aEnd.twin;
    const fe = aEnd.frame(aEnd.len, 0, {});
    const fs = aStart.frame(0, 0, {});
    for (const b of B.paths) {
      const sb = sPath(b, j.x, j.z);
      const fb = b.frame(sb, 0, {});
      // leaving A onto B
      if (fe.tx * fb.tx + fe.tz * fb.tz >= -0.5 && sb + MERGE < b.len - 40) {
        const r = right(fe);
        const turn = fb.tx * r.x + fb.tz * r.z;
        pushMove({ from: aEnd, terminal: true, to: b, sTo: sb + MERGE, turn, arriveSide: turn > 0 ? 'R' : 'L' });
      }
      // leaving B onto A
      if (fb.tx * fs.tx + fb.tz * fs.tz >= -0.5 && sb > GORE + 120) {
        const r = right(fb);
        const turn = fs.tx * r.x + fs.tz * r.z;
        const p0 = b.frame(sb - GORE, 0, {});
        const ra = right(fs);
        const arr = (p0.x - fs.x) * ra.x + (p0.z - fs.z) * ra.z > 0 ? 'R' : 'L';
        pushMove({ from: b, sPoint: sb, to: aStart, sTo: Math.min(40, aStart.len * 0.2), side: turn > 0 ? 'R' : 'L', arriveSide: arr, turn });
      }
    }
  }

  // ---------- 6. Place gores so exit-only lanes never overlap ----------
  for (const p of paths) {
    const mine = moves.filter((m) => m.from === p);
    const term = mine.filter((m) => m.terminal);
    const endLimit = p.len - (term.length ? 260 : 60);
    for (const side of ['L', 'R']) {
      const list = mine.filter((m) => !m.terminal && m.side === side).sort((a, b) => b.sPoint - a.sPoint);
      let cursor = endLimit;
      for (const m of list) {
        const g = Math.min(m.sPoint - GORE, cursor);
        let aux = AUX;
        if (g - aux < 20) aux = g - 20;
        if (aux < 90) { m.dropped = true; continue; }
        m.g = g; m.zs = g - aux;
        cursor = m.zs - 60;
      }
    }
    term.sort((a, b) => a.turn - b.turn);
    term.forEach((m, i) => { m.group = i; m.groups = term.length; m.g = p.len; });
  }

  // ---------- 7. Connector geometry ----------
  const conns = [];
  N.conns = conns;
  function bezierPath(P0, t0, P3, t3, y0, y3, bump, k) {
    const pts = [];
    const P1 = { x: P0.x + t0.x * k, z: P0.z + t0.z * k };
    const P2 = { x: P3.x - t3.x * k, z: P3.z - t3.z * k };
    const M = 160;
    for (let i = 0; i <= M; i++) {
      const t = i / M, a = 1 - t;
      const x = a * a * a * P0.x + 3 * a * a * t * P1.x + 3 * a * t * t * P2.x + t * t * t * P3.x;
      const z = a * a * a * P0.z + 3 * a * a * t * P1.z + 3 * a * t * t * P2.z + t * t * t * P3.z;
      const sm = t * t * (3 - 2 * t);
      pts.push({ x, z, y: y0 + (y3 - y0) * sm + bump * Math.sin(Math.PI * t) });
    }
    return resample(pts, STEP);
  }
  function makeConn(arr, o) {
    const c = new Path(arr[0], arr[1], arr[2], Object.assign({ kind: 'conn', lanes: 1, M: -LW / 2, limit: 55 }, o));
    c.id = paths.length + conns.length;
    conns.push(c);
    return c;
  }
  for (const m of moves) {
    if (m.dropped) continue;
    const a = m.from, b = m.to;
    let uS;
    if (m.terminal) uS = a.M + (m.group + 0.5) * a.lanes * LW / m.groups;
    else uS = m.side === 'R' ? a.outer + LW / 2 : a.M - LW / 2;
    const uE = m.arriveSide === 'R' ? b.laneU(b.lanes - 1) : b.laneU(0);
    const f0 = a.frame(m.g, uS, {}), f3 = b.frame(m.sTo, uE, {});
    const chord = Math.hypot(f3.x - f0.x, f3.z - f0.z);
    const bump = m.side === 'L' || m.turn < -0.3 ? 11 : 2;
    const arr = bezierPath(f0, { x: f0.tx, z: f0.tz }, f3, { x: f3.tx, z: f3.tz }, f0.y, f3.y, bump, Math.max(40, chord * 0.42));
    const c = makeConn(arr, { from: a, to: b, sTo: m.sTo, uS, uE, side: m.side || null, terminal: !!m.terminal, kindConn: 'jct' });
    const dep = { conn: c, side: m.terminal ? null : m.side, g: m.g, zs: m.zs, terminal: !!m.terminal, group: m.group, groups: m.groups, uS };
    a.deps.push(dep);
    b.arrs.push({ conn: c, s: m.sTo, side: m.arriveSide });
  }

  // ---------- 8. Exits (off-ramp that loops back on, so a missed turn costs time) ----------
  const exits = [];
  N.exits = exits;
  for (const ex of D.exits) {
    const F = fwById[ex.fwy];
    if (!F) continue;
    const P = proj(ex.at);
    const rec = Object.assign({ ramps: [] }, ex);
    for (const p of F.paths) {
      const sp = sPath(p, P.x, P.z);
      const term = p.deps.some((d) => d.terminal);
      const endLimit = p.len - (term ? 260 : 60);
      let placed = null;
      for (let k = 0; k <= 6 && !placed; k++) {
        const g = sp - 40 - k * 60;
        const zs = g - EXIT_AUX;
        if (zs < 40 || g + RAMP > endLimit) continue;
        const clash = p.deps.some((d) => !d.terminal && d.side === 'R' && d.zs < g + RAMP + 60 && d.g > zs - 60);
        if (!clash) placed = { g, zs };
      }
      if (!placed) continue;
      const uS = p.outer + LW / 2, uE = p.laneU(p.lanes - 1);
      const pts = [];
      const fr = (s, u) => { const f = p.frame(s, u, {}); return new THREE.Vector3(f.x, f.y, f.z); };
      const ctrl = [fr(placed.g, uS), fr(placed.g + 30, uS + 1.5), fr(placed.g + RAMP * 0.35, uS + 26), fr(placed.g + RAMP * 0.65, uS + 26), fr(placed.g + RAMP - 30, uE + 1.5), fr(placed.g + RAMP, uE)];
      const cv = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
      const sp2 = cv.getPoints(120);
      sp2.forEach((v, i) => pts.push({ x: v.x, z: v.z, y: v.y + 5 * Math.sin(Math.PI * i / 120) }));
      const c = makeConn(resample(pts, STEP), { from: p, to: p, sTo: placed.g + RAMP, uS, uE, side: 'R', kindConn: 'ramp', exit: rec });
      const dep = { conn: c, side: 'R', g: placed.g, zs: placed.zs, exit: rec, uS };
      p.deps.push(dep);
      p.exits.push(dep);
      rec.ramps.push({ path: p, dep, conn: c });
    }
    exits.push(rec);
  }
  N.exitById = {};
  exits.forEach((e) => (N.exitById[e.id] = e));
  for (const p of paths) p.deps.sort((a, b) => a.g - b.g);

  // ---------- 9. Spatial hash (for nearby roads / scenery rejection) ----------
  const CELL = 100;
  const grid = new Map();
  const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;
  function addPt(x, z, ref) {
    const k = key(Math.floor(x / CELL), Math.floor(z / CELL));
    let a = grid.get(k);
    if (!a) grid.set(k, (a = []));
    a.push(ref);
  }
  for (const p of paths) {
    if (p.dir !== 0) continue;
    for (let i = 0; i < p.n; i += 2) addPt(p.x[i], p.z[i], { p, i, w: p.outer + 6 });
  }
  for (const c of conns) for (let i = 0; i < c.n; i += 2) addPt(c.x[i], c.z[i], { p: c, i, w: 4 });
  N.query = function (x, z, r, cb) {
    const c0 = Math.floor((x - r) / CELL), c1 = Math.floor((x + r) / CELL);
    const d0 = Math.floor((z - r) / CELL), d1 = Math.floor((z + r) / CELL);
    for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) {
      const a = grid.get(key(cx, cz));
      if (a) for (const ref of a) cb(ref);
    }
  };
  // distance from point to nearest road edge (negative = on a road)
  N.roadClearance = function (x, z, r) {
    let best = r;
    N.query(x, z, r, (ref) => {
      const d = Math.hypot(ref.p.x[ref.i] - x, ref.p.z[ref.i] - z) - ref.w;
      if (d < best) best = d;
    });
    return best;
  };

  // ---------- 10. Routing graph ----------
  const nodes = [];
  function nodeAt(p, s) {
    p.nodes = p.nodes || [];
    for (const nd of p.nodes) if (Math.abs(nd.s - s) < 0.5) return nd;
    const nd = { p, s, out: [], id: nodes.length };
    nodes.push(nd); p.nodes.push(nd);
    return nd;
  }
  const all = paths.concat(conns);
  for (const p of paths) {
    nodeAt(p, 0); nodeAt(p, p.len);
    for (const d of p.deps) {
      const nd = nodeAt(p, d.g);
      if (d.exit) { nd.exit = d.exit; continue; }
      const tgt = nodeAt(d.conn.to, d.conn.sTo);
      nd.out.push({ to: tgt, w: d.conn.len, conn: d.conn, dep: d });
    }
  }
  for (const p of paths) {
    p.nodes.sort((a, b) => a.s - b.s);
    for (let i = 0; i + 1 < p.nodes.length; i++) p.nodes[i].out.push({ to: p.nodes[i + 1], w: p.nodes[i + 1].s - p.nodes[i].s });
    if (!p.deps.some((d) => d.terminal)) {
      const last = p.nodes[p.nodes.length - 1];
      last.out.push({ to: p.twin.nodes[0], w: 400, uturn: true });
      p.deadEnd = true;
    }
  }
  N.nodes = nodes;
  N.allPaths = all;

  // Shortest route from (path, s) to an exit. Returns {dist, steps:[{node, edge}]}
  N.route = function (path, s, exitRec) {
    let startNodes = [];
    if (path.kind === 'conn') {
      if (path.kindConn === 'ramp') return null;
      const tgt = path.to.nodes.find((nd) => Math.abs(nd.s - path.sTo) < 0.5);
      startNodes.push({ nd: tgt, d: Math.max(0, path.len - s) });
    } else {
      const nd = path.nodes.find((n) => n.s >= s - 0.5);
      if (nd) startNodes.push({ nd, d: Math.max(0, nd.s - s) });
    }
    const goal = new Set();
    for (const r of exitRec.ramps) {
      const nd = r.path.nodes.find((n) => Math.abs(n.s - r.dep.g) < 0.5);
      if (nd) goal.add(nd);
    }
    const dist = new Float64Array(nodes.length).fill(Infinity);
    const prev = new Array(nodes.length);
    const heap = [];
    const push = (d, nd) => {
      heap.push([d, nd]);
      let i = heap.length - 1;
      while (i > 0) { const pa = (i - 1) >> 1; if (heap[pa][0] <= heap[i][0]) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
        }
      }
      return top;
    };
    for (const st of startNodes) { dist[st.nd.id] = st.d; push(st.d, st.nd); }
    let found = null;
    while (heap.length) {
      const [d, nd] = pop();
      if (d > dist[nd.id]) continue;
      if (goal.has(nd)) { found = nd; break; }
      for (const e of nd.out) {
        const nd2 = d + e.w;
        if (nd2 < dist[e.to.id]) { dist[e.to.id] = nd2; prev[e.to.id] = { from: nd, e }; push(nd2, e.to); }
      }
    }
    if (!found) return null;
    const steps = [];
    let cur = found;
    while (prev[cur.id]) { steps.unshift({ node: prev[cur.id].from, e: prev[cur.id].e, d: dist[prev[cur.id].from.id] }); cur = prev[cur.id].from; }
    return { dist: dist[found.id], steps, goal: found, exitDep: exitRec.ramps.find((r) => r.path === found.p).dep };
  };

  N.pathFor = function (fwyId, dir) { return fwById[fwyId].paths[dir]; };
  N.sOnPath = function (p, ll) { const P = proj(ll); return sPath(p, P.x, P.z); };

  // Map bounds
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const p of paths) for (let i = 0; i < p.n; i += 10) {
    minX = Math.min(minX, p.x[i]); maxX = Math.max(maxX, p.x[i]);
    minZ = Math.min(minZ, p.z[i]); maxZ = Math.max(maxZ, p.z[i]);
  }
  N.bounds = { minX, maxX, minZ, maxZ };
  N._cross = crossJ; N._end = endJ; N._moves = moves;
  N.stats = { crossings: crossJ.length, ends: endJ.length, conns: conns.length, moves: moves.length, dropped: moves.filter((m) => m.dropped).length };
})();
