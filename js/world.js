// Turns the OCN network into three.js meshes: roads, ramps, bridges, scenery, coast.
(function () {
  'use strict';
  const N = window.OCN, D = window.OC_DATA, LW = N.LW;
  const W = (window.OCW = {});

  // Deterministic random so the city looks the same every run
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const rr = (a, b) => a + (b - a) * rnd();
  W.rnd = rnd;

  // ---------- Road textures ----------
  const PXM = 16, PERIOD = 12;
  const texCache = {};
  function canvasTex(w, h, draw, aniso) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso || 8;
    return t;
  }
  W.canvasTex = canvasTex;
  function asphalt(g, w, h, base) {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h / 18; i++) {
      const v = Math.floor(rr(-18, 18));
      g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 260})`;
      g.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
  }
  function roadSpec(p) {
    if (p.kind === 'conn') return { u0: -2.8, u1: 2.8 };
    return { u0: p.surface ? 0 : 0.3, u1: p.outer + 2.6 };
  }
  function roadTex(p) {
    const k = p.kind === 'conn' ? 'conn' : `${p.lanes}|${p.M}|${p.surface}`;
    if (texCache[k]) return texCache[k];
    const sp = roadSpec(p);
    const w = Math.ceil((sp.u1 - sp.u0) * PXM), h = PERIOD * PXM;
    const X = (u) => (u - sp.u0) * PXM;
    const t = canvasTex(w, h, (g) => {
      asphalt(g, w, h, '#3b3c40');
      const line = (u, wid, col, dash) => {
        g.fillStyle = col;
        if (dash) g.fillRect(X(u) - wid * PXM / 2, 0, wid * PXM, 3 * PXM);
        else g.fillRect(X(u) - wid * PXM / 2, 0, wid * PXM, h);
      };
      if (p.kind === 'conn') {
        line(-1.95, 0.15, '#e7c13a'); line(1.95, 0.15, '#f2f2f2');
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(X(2.05), 0, w, h); g.fillRect(0, 0, X(-2.05), h);
        return;
      }
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(X(p.outer + 0.15), 0, w, h);
      if (p.surface) { line(0.12, 0.12, '#e7c13a'); }
      else { g.fillRect(0, 0, X(p.M - 0.4), h); line(p.M - 0.3, 0.15, '#e7c13a'); }
      for (let i = 1; i < p.lanes; i++) line(p.M + i * LW, 0.15, '#eeeeee', true);
      line(p.outer + 0.05, 0.15, '#f2f2f2');
      // Botts' dots feel: tiny reflectors along lane lines
      g.fillStyle = '#ffffff';
      for (let i = 1; i < p.lanes; i++) g.fillRect(X(p.M + i * LW) - 2, 7 * PXM, 4, 4);
    });
    t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
    return (texCache[k] = t);
  }
  function auxTex(side) {
    const k = 'aux' + side;
    if (texCache[k]) return texCache[k];
    const wm = LW + 1.2;
    const t = canvasTex(Math.ceil(wm * PXM), PERIOD * PXM, (g, w, h) => {
      asphalt(g, w, h, '#3b3c40');
      g.fillStyle = '#f2f2f2';
      if (side === 'R') {
        for (let y = 0; y < h; y += h / 3) g.fillRect(0, y, 0.3 * PXM, h / 6);
        g.fillRect((LW + 0.05) * PXM, 0, 0.15 * PXM, h);
        g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect((LW + 0.2) * PXM, 0, w, h);
      } else {
        g.fillStyle = '#e7c13a'; g.fillRect(0.3 * PXM, 0, 0.15 * PXM, h);
        g.fillStyle = '#f2f2f2';
        for (let y = 0; y < h; y += h / 3) g.fillRect((LW + 0.4) * PXM, y, 0.3 * PXM, h / 6);
      }
    });
    t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
    return (texCache[k] = t);
  }

  // ---------- Geometry helpers ----------
  // Ribbon over samples [i0, i1] of a path, lateral range from fa(i) to fb(i).
  function ribbon(p, i0, i1, fa, fb, uv, yOff) {
    const n = i1 - i0 + 1;
    const pos = new Float32Array(n * 6), nor = new Float32Array(n * 6), tex = new Float32Array(n * 4);
    for (let k = 0; k < n; k++) {
      const i = i0 + k, tx = p.tx[i], tz = p.tz[i];
      const a = fa(i), b = fb(i), y = p.y[i] + yOff;
      pos.set([p.x[i] - tz * a, y, p.z[i] + tx * a, p.x[i] - tz * b, y, p.z[i] + tx * b], k * 6);
      nor.set([0, 1, 0, 0, 1, 0], k * 6);
      const v = p.s[i] / PERIOD;
      tex.set([uv(a, i), v, uv(b, i), v], k * 4);
    }
    const idx = [];
    for (let k = 0; k < n - 1; k++) {
      const a = k * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(tex, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }

  // Accumulates plain colored quads into one big mesh
  class Bucket {
    constructor() { this.p = []; this.c = []; }
    quad(a, b, c, d, col) {
      // a,b,c,d: [x,y,z] in order around the quad
      this.p.push(...a, ...b, ...c, ...a, ...c, ...d);
      for (let i = 0; i < 6; i++) this.c.push(col.r, col.g, col.b);
    }
    mesh(mat) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.computeVertexNormals();
      return new THREE.Mesh(g, mat);
    }
  }

  // Merge simple parts into one vertex-colored geometry with up to 2 material groups
  W.mergeParts = function (parts) {
    const groups = [[], []];
    for (const pt of parts) groups[pt.m || 0].push(pt);
    const P = [], Nn = [], C = [], grp = [];
    let start = 0;
    groups.forEach((list, gi) => {
      let count = 0;
      for (const pt of list) {
        let g = pt.g.index ? pt.g.toNonIndexed() : pt.g.clone();
        if (pt.mat) g.applyMatrix4(pt.mat);
        const pa = g.attributes.position.array, na = g.attributes.normal.array;
        const col = new THREE.Color(pt.c);
        for (let i = 0; i < pa.length; i += 3) {
          P.push(pa[i], pa[i + 1], pa[i + 2]); Nn.push(na[i], na[i + 1], na[i + 2]);
          C.push(col.r, col.g, col.b);
        }
        count += pa.length / 3;
      }
      if (count) grp.push([start, count, gi]);
      start += count;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    for (const [s, c, m] of grp) g.addGroup(s, c, m);
    g.computeBoundingSphere();
    return g;
  };
  const box = (w, h, d, x, y, z, ry) => {
    const m = new THREE.Matrix4().makeRotationY(ry || 0);
    m.setPosition(x, y, z);
    return { g: new THREE.BoxGeometry(w, h, d), mat: m };
  };
  W.box = box;

  // ---------- Ocean polygon (also used to keep houses out of the water) ----------
  const pch = N.fwById['1'].paths[0];
  const coast = [];
  {
    const f = {};
    const ext = pch.frame(0, 0, f);
    coast.push({ x: ext.x - ext.tx * 1500 - ext.tz * 300, z: ext.z - ext.tz * 1500 + ext.tx * 300 });
    for (let s = 0; s <= pch.len; s += 120) {
      const q = pch.frame(s, pch.outer + 70, {});
      coast.push({ x: q.x, z: q.z });
    }
    for (const ll of D.coastSouth) coast.push(N.proj(ll));
  }
  const oceanPoly = coast.slice();
  {
    const last = coast[coast.length - 1], first = coast[0];
    oceanPoly.push({ x: last.x + 3000, z: last.z + 12000 }, { x: first.x - 16000, z: last.z + 12000 }, { x: first.x - 16000, z: first.z - 3000 });
  }
  W.inOcean = function (x, z) {
    let c = false;
    for (let i = 0, j = oceanPoly.length - 1; i < oceanPoly.length; j = i++) {
      const a = oceanPoly[i], b = oceanPoly[j];
      if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
    }
    return c;
  };
  W.oceanPoly = oceanPoly;

  // ---------- Build everything ----------
  W.build = function (scene, renderer, quality) {
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const out = { lampMat: null, nightMats: [], mountains: [] };
    const roadMats = {};
    const roadMat = (p) => {
      const k = p.kind === 'conn' ? 'conn' : `${p.lanes}|${p.M}|${p.surface}`;
      if (!roadMats[k]) {
        const t = roadTex(p); t.anisotropy = aniso;
        roadMats[k] = new THREE.MeshLambertMaterial({ map: t });
      }
      return roadMats[k];
    };

    // Roads (chunked so frustum culling helps)
    const CH = 300;
    for (const p of N.allPaths) {
      const sp = roadSpec(p), mat = roadMat(p);
      const uv = (u) => (u - sp.u0) / (sp.u1 - sp.u0);
      const yo = p.kind === 'conn' ? 0.09 : 0.06;
      for (let i0 = 0; i0 < p.n - 1; i0 += CH) {
        const i1 = Math.min(p.n - 1, i0 + CH);
        const m = new THREE.Mesh(ribbon(p, i0, i1, () => sp.u0, () => sp.u1, uv, yo), mat);
        m.matrixAutoUpdate = false;
        scene.add(m);
      }
    }
    // Exit-only lanes
    const auxMatR = new THREE.MeshLambertMaterial({ map: auxTex('R'), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const auxMatL = new THREE.MeshLambertMaterial({ map: auxTex('L'), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const p of N.paths) {
      for (const d of p.deps) {
        if (d.terminal) continue;
        const i0 = p.idx(d.zs), i1 = Math.min(p.n - 1, p.idx(d.g) + 1);
        if (i1 - i0 < 2) continue;
        const wm = LW + 1.2;
        if (d.side === 'R') {
          const ua = p.outer - 0.1;
          const fb = (i) => ua + wm * Math.min(1, (p.s[i] - d.zs) / 60);
          scene.add(new THREE.Mesh(ribbon(p, i0, i1, () => ua, fb, (u) => (u - ua) / wm, 0.075), auxMatR));
        } else {
          const ub = p.M + 0.25;
          const fa = (i) => ub - wm * Math.min(1, (p.s[i] - d.zs) / 60);
          scene.add(new THREE.Mesh(ribbon(p, i0, i1, fa, () => ub, (u) => (u - (ub - wm)) / wm, 0.075), auxMatL));
        }
      }
    }

    // Concrete: median barriers, bridge decks, parapets
    const conc = new Bucket();
    const cBar = new THREE.Color('#b8b3a8'), cDeck = new THREE.Color('#8f8a80'), cPar = new THREE.Color('#c9c4b8');
    const P3 = (p, i, u, dy) => [p.x[i] - p.tz[i] * u, p.y[i] + dy, p.z[i] + p.tx[i] * u];
    for (const F of N.fws) {
      if (F.def.surface) continue;
      const p = F.paths[0];
      for (let i = 0; i < p.n - 1; i++) {
        const j = i + 1;
        conc.quad(P3(p, i, -0.32, 0.05), P3(p, j, -0.32, 0.05), P3(p, j, -0.14, 0.9), P3(p, i, -0.14, 0.9), cBar);
        conc.quad(P3(p, i, -0.14, 0.9), P3(p, j, -0.14, 0.9), P3(p, j, 0.14, 0.9), P3(p, i, 0.14, 0.9), cPar);
        conc.quad(P3(p, i, 0.14, 0.9), P3(p, j, 0.14, 0.9), P3(p, j, 0.32, 0.05), P3(p, i, 0.32, 0.05), cBar);
      }
    }
    const pillars = [];
    for (const p of N.allPaths) {
      const sp = roadSpec(p);
      const edges = p.kind === 'conn' ? [sp.u0, sp.u1] : [sp.u1];
      for (let i = 0; i < p.n - 1; i++) {
        const j = i + 1;
        if (p.y[i] < 1.0 || p.y[j] < 1.0) continue;
        for (const u of edges) {
          const sgn = u > 0 ? 1 : -1;
          // parapet (inner face, top, outer face) + deck skirt
          conc.quad(P3(p, i, u, 0.05), P3(p, j, u, 0.05), P3(p, j, u, 1.0), P3(p, i, u, 1.0), cPar);
          conc.quad(P3(p, i, u, 1.0), P3(p, j, u, 1.0), P3(p, j, u + 0.35 * sgn, 1.0), P3(p, i, u + 0.35 * sgn, 1.0), cPar);
          conc.quad(P3(p, j, u + 0.35 * sgn, 1.0), P3(p, j, u + 0.35 * sgn, -1.5), P3(p, i, u + 0.35 * sgn, -1.5), P3(p, i, u + 0.35 * sgn, 1.0), cDeck);
        }
        // underside
        conc.quad(P3(p, j, sp.u0, -1.5), P3(p, j, sp.u1, -1.5), P3(p, i, sp.u1, -1.5), P3(p, i, sp.u0, -1.5), cDeck);
        if (i % 10 === 0 && p.y[i] > 4) pillars.push([p.x[i] - p.tz[i] * (sp.u0 + sp.u1) / 2, p.z[i] + p.tx[i] * (sp.u0 + sp.u1) / 2, p.y[i] - 1.4, Math.atan2(p.tx[i], p.tz[i]), (sp.u1 - sp.u0) * 0.5]);
      }
    }
    const concMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const cm = conc.mesh(concMat);
    cm.matrixAutoUpdate = false;
    scene.add(cm);
    const instMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    function instanced(geo, mat, list, setup) {
      const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
      const o = new THREE.Object3D();
      list.forEach((it, k) => { setup(o, it, m, k); o.updateMatrix(); m.setMatrixAt(k, o.matrix); });
      m.count = list.length;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.frustumCulled = false;
      scene.add(m);
      return m;
    }
    instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x9a958a }), pillars, (o, it) => {
      o.position.set(it[0], it[2] / 2, it[1]); o.rotation.set(0, it[3], 0); o.scale.set(it[4], it[2], 1.4);
    });

    // ---------- Ground, beach, ocean ----------
    const b = N.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const gw = b.maxX - b.minX + 40000, gd = b.maxZ - b.minZ + 40000;
    const groundTex = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#a7a582'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const c = ['#9c9d78', '#b3ad89', '#98a072', '#aea887', '#8e9a6a'][i % 5];
        g.fillStyle = c; g.globalAlpha = 0.5;
        g.fillRect(rnd() * w, rnd() * h, rr(4, 18), rr(4, 18));
      }
      g.globalAlpha = 0.55; g.fillStyle = '#8d8a80';
      for (let k = 0; k < 4; k++) { g.fillRect(k * 128 + 60, 0, 5, h); g.fillRect(0, k * 128 + 30, w, 5); }
      g.globalAlpha = 0.8; g.fillStyle = '#7b7a74';
      g.fillRect(250, 0, 9, h); g.fillRect(0, 410, w, 9);
      g.globalAlpha = 1;
    }, aniso);
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(gw / 360, gd / 360);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd), new THREE.MeshLambertMaterial({ map: groundTex }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -0.05, cz);
    scene.add(ground);

    const shape = new THREE.Shape(oceanPoly.map((q) => new THREE.Vector2(q.x, -q.z)));
    const ocean = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshPhongMaterial({ color: 0x1d6b9e, shininess: 90, specular: 0x6f9fbf }));
    ocean.rotation.x = -Math.PI / 2; ocean.position.y = 0.12;
    scene.add(ocean);
    out.ocean = ocean;
    const sandTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#e2d2a2'; g.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { g.fillStyle = rnd() < 0.5 ? '#d6c591' : '#ecdcae'; g.fillRect(rnd() * w, rnd() * h, 2, 2); } });
    sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
    const sand = new THREE.Mesh(ribbon(pch, 0, pch.n - 1, () => pch.outer + 2.6, () => pch.outer + 95, (u) => u / 20, 0.03), new THREE.MeshLambertMaterial({ map: sandTex }));
    scene.add(sand);

    // ---------- Mountains ----------
    const mtnMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    for (const [lat, lon, rk, hm] of D.mountains) {
      const P = N.proj([lat, lon]);
      let r = rk * 1000 * N.SCALE;
      const clear = N.roadClearance(P.x, P.z, r);
      r = Math.min(r, clear - 40);
      if (r < 250) continue;
      const h = hm * 0.55 * (r / (rk * 1000 * N.SCALE));
      const g = new THREE.ConeGeometry(r, h, 18, 5);
      const pa = g.attributes.position;
      const cols = [];
      for (let i = 0; i < pa.count; i++) {
        const y = pa.getY(i), t = (y + h / 2) / h;
        if (t > 0.02 && t < 0.98) {
          const k = 1 + rr(-0.18, 0.18);
          pa.setX(i, pa.getX(i) * k); pa.setZ(i, pa.getZ(i) * k); pa.setY(i, y + rr(-0.06, 0.06) * h);
        }
        const c = new THREE.Color().setHSL(0.13 + rr(-0.02, 0.03), 0.22 + t * 0.1, 0.36 + t * 0.12 + rr(-0.03, 0.03));
        cols.push(c.r, c.g, c.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mtnMat);
      m.position.set(P.x, h / 2 - 2, P.z);
      scene.add(m);
      out.mountains.push({ x: P.x, z: P.z, r });
    }
    const inMountain = (x, z) => out.mountains.some((m) => Math.hypot(m.x - x, m.z - z) < m.r + 30);

    // ---------- Neighborhoods ----------
    const fwPaths = N.paths.filter((p) => p.dir === 0);
    const totalLen = fwPaths.reduce((a, p) => a + p.len, 0);
    const pickSample = () => {
      let t = rnd() * totalLen;
      for (const p of fwPaths) { if (t < p.len) return { p, s: t }; t -= p.len; }
      return { p: fwPaths[0], s: 0 };
    };
    const rural = (x, z) => {
      const lat = 33.70 - z / (110574 * N.SCALE), lon = -117.85 + x / (Math.cos(33.7 * Math.PI / 180) * 111320 * N.SCALE);
      return (lat > 33.745 && lon > -117.775) || (lon > -117.70 && lat > 33.66) || (lat < 33.62 && lon > -117.85 && lon < -117.76 && lat > 33.56);
    };
    const houses = [], shops = [], trees = [], palms = [];
    const nHouseBlocks = quality === 'low' ? 380 : 760;
    const f = {};
    for (let bk = 0; bk < nHouseBlocks; bk++) {
      const { p, s } = pickSample();
      const side = rnd() < 0.5 ? -1 : 1;
      const off = rr(70, 900) * side;
      p.frame(s, off, f);
      if (rural(f.x, f.z) || W.inOcean(f.x, f.z)) continue;
      const tx = f.tx, tz = f.tz, rx = -tz, rz = tx;
      const ang = Math.atan2(tx, tz);
      const rows = 2 + Math.floor(rnd() * 3), cols = 4 + Math.floor(rnd() * 6);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const a = (c - cols / 2) * 19, bb = r * 24 * side;
        const x = f.x + tx * a + rx * bb, z = f.z + tz * a + rz * bb;
        if (N.roadClearance(x, z, 40) < 14 || W.inOcean(x, z) || inMountain(x, z)) continue;
        houses.push({ x, z, ang, w: rr(10, 14), d: rr(10, 13), h: rnd() < 0.35 ? rr(6, 7.5) : rr(3.6, 4.6) });
        if (rnd() < 0.5) trees.push({ x: x + rx * 9 * side + rr(-4, 4), z: z + rz * 9 * side + rr(-4, 4), s: rr(3.5, 6) });
      }
    }
    const nShops = quality === 'low' ? 260 : 520;
    for (let k = 0; k < nShops; k++) {
      const { p, s } = pickSample();
      const off = rr(55, 260) * (rnd() < 0.5 ? -1 : 1);
      p.frame(s, off, f);
      if (rural(f.x, f.z) || W.inOcean(f.x, f.z) || inMountain(f.x, f.z)) continue;
      const w = rr(25, 60), d = rr(25, 50);
      if (N.roadClearance(f.x, f.z, 80) < Math.max(w, d) * 0.6 + 6) continue;
      shops.push({ x: f.x, z: f.z, ang: Math.atan2(f.tx, f.tz), w, d, h: rr(7, 16) });
    }
    for (const lm of D.landmarks) {
      if (lm.kind !== 'towers') continue;
      const P = N.proj(lm.at);
      for (let k = 0; k < lm.n; k++) {
        const x = P.x + rr(-180, 180), z = P.z + rr(-180, 180);
        if (N.roadClearance(x, z, 60) < 30) continue;
        shops.push({ x, z, ang: rr(0, 3), w: rr(26, 40), d: rr(26, 40), h: rr(45, 95), tower: true });
      }
    }
    // Palms line the freeways and PCH
    for (const p of fwPaths) {
      const every = p.surface ? 22 : 70;
      for (let s = 20; s < p.len; s += every * rr(0.6, 1.4)) {
        for (const side of [-1, 1]) {
          if (rnd() < 0.45) continue;
          const u = side * (p.outer + rr(9, 24));
          p.frame(s, u, f);
          if (f.y > 0.5 || W.inOcean(f.x, f.z) || N.roadClearance(f.x, f.z, 30) < 5) continue;
          palms.push({ x: f.x, z: f.z, h: rr(11, 21), lean: rr(-0.08, 0.08), r: rr(0, 6.28) });
        }
      }
    }
    // Sound walls along urban freeways
    const walls = [];
    const wallFw = { '5': 1, '405': 1, '55': 1, '57': 1, '22': 1, '91': 1 };
    for (const p of N.paths) {
      if (!wallFw[p.fw.id]) continue;
      for (let s = 30; s < p.len - 30; s += 24) {
        const near = p.deps.some((d) => s > (d.zs || d.g) - 120 && s < d.g + (d.exit ? N.RAMP + 60 : 200)) ||
          p.arrs.some((a) => Math.abs(a.s - s) < 320);
        if (near) continue;
        const fa = p.frame(s, p.outer + 5.5, {});
        if (fa.y > 0.3 || W.inOcean(fa.x, fa.z) || rural(fa.x, fa.z)) continue;
        let blocked = false;
        N.query(fa.x, fa.z, 40, (ref) => { if (ref.p.kind === 'conn' && Math.hypot(ref.p.x[ref.i] - fa.x, ref.p.z[ref.i] - fa.z) < 14) blocked = true; });
        if (blocked) continue;
        walls.push({ x: fa.x, z: fa.z, ang: Math.atan2(fa.tx, fa.tz), c: rnd() });
      }
    }

    const tmpC = new THREE.Color();
    const stucco = ['#ece0c8', '#dccaa9', '#f1e9da', '#cfbb9f', '#f3e4c8', '#c9b9a2', '#e2d6c0', '#d8c3a5'];
    const roofs = ['#b4573a', '#9f4a31', '#8a5a43', '#6e6a66', '#a86b4a', '#7c4e3a'];
    instanced(new THREE.BoxGeometry(1, 1, 1), instMat, houses, (o, it, m, k) => {
      o.position.set(it.x, it.h / 2, it.z); o.rotation.set(0, it.ang, 0); o.scale.set(it.w, it.h, it.d);
      m.setColorAt(k, tmpC.set(stucco[k % stucco.length]));
    });
    const roofGeo = new THREE.ConeGeometry(1, 1, 4, 1); roofGeo.rotateY(Math.PI / 4); roofGeo.translate(0, 0.5, 0);
    instanced(roofGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), houses, (o, it, m, k) => {
      o.position.set(it.x, it.h, it.z); o.rotation.set(0, it.ang, 0); o.scale.set(it.w * 0.78, rr(2.2, 3.4), it.d * 0.78);
      m.setColorAt(k, tmpC.set(roofs[(k * 7) % roofs.length]));
    });
    const winTex = canvasTex(64, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7f98ad';
      for (let y = 6; y < h; y += 14) for (let x = 4; x < w; x += 12) g.fillRect(x, y, 8, 8);
    });
    winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
    const shopMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: winTex });
    out.shopMat = shopMat;
    const shopGeo = new THREE.BoxGeometry(1, 1, 1);
    instanced(shopGeo, shopMat, shops, (o, it, m, k) => {
      o.position.set(it.x, it.h / 2, it.z); o.rotation.set(0, it.ang, 0); o.scale.set(it.w, it.h, it.d);
      m.setColorAt(k, tmpC.set(it.tower ? ['#c9d4dc', '#9fb4c4', '#e4e4e0', '#b8c2c8'][k % 4] : ['#e7e2d6', '#d2cdc4', '#efe9df', '#c8c0b2', '#dcd2c0'][k % 5]));
    });
    instanced(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), trees, (o, it, m, k) => {
      o.position.set(it.x, it.s * 0.9, it.z); o.scale.set(it.s, it.s * 0.9, it.s);
      m.setColorAt(k, tmpC.setHSL(0.24 + rr(-0.04, 0.05), 0.35, 0.28 + rr(-0.05, 0.06)));
    });
    // Palm: trunk + crown
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 1, 6); trunkGeo.translate(0, 0.5, 0);
    instanced(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x8a7458 }), palms, (o, it) => {
      o.position.set(it.x, 0, it.z); o.rotation.set(it.lean, it.r, 0); o.scale.set(1, it.h, 1);
    });
    const crownParts = [];
    for (let k = 0; k < 8; k++) {
      const m = new THREE.Matrix4().makeRotationY(k * Math.PI / 4).multiply(new THREE.Matrix4().makeRotationZ(-0.45)).multiply(new THREE.Matrix4().makeTranslation(2.1, 0, 0));
      crownParts.push({ g: new THREE.BoxGeometry(4.2, 0.12, 0.9), mat: m, c: k % 2 ? '#3f6b2a' : '#4f7d33' });
    }
    const crownGeo = W.mergeParts(crownParts);
    instanced(crownGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), palms, (o, it) => {
      o.position.set(it.x + Math.sin(it.lean) * it.h * 0.0, it.h, it.z); o.rotation.set(0, it.r, 0); o.scale.set(1, 1, 1);
    });
    instanced(new THREE.BoxGeometry(24.4, 4.2, 0.5), instMat, walls, (o, it, m, k) => {
      o.position.set(it.x, 2.1, it.z); o.rotation.set(0, it.ang + Math.PI / 2, 0);
      m.setColorAt(k, tmpC.setHSL(0.1, 0.18, 0.66 + it.c * 0.06));
    });

    // Freeway lights
    const lamps = [];
    for (const p of N.paths) {
      if (p.surface) continue;
      for (let s = 40; s < p.len; s += 95) {
        if (p.zoneAt(s, 'R')) continue;
        const fa = p.frame(s, p.outer + 2.4, {});
        lamps.push({ x: fa.x, y: fa.y, z: fa.z, ang: Math.atan2(fa.tx, fa.tz) });
      }
    }
    const poleGeo = new THREE.BoxGeometry(0.25, 11, 0.25); poleGeo.translate(0, 5.5, 0);
    instanced(poleGeo, new THREE.MeshLambertMaterial({ color: 0x8e9196 }), lamps, (o, it) => { o.position.set(it.x, it.y, it.z); o.rotation.set(0, it.ang, 0); });
    const headGeo = new THREE.BoxGeometry(2.2, 0.25, 0.6); headGeo.translate(-1.0, 11, 0);
    out.lampMat = new THREE.MeshBasicMaterial({ color: 0x777777 });
    instanced(headGeo, out.lampMat, lamps, (o, it) => { o.position.set(it.x, it.y, it.z); o.rotation.set(0, it.ang + Math.PI, 0); });
    // Lamp heads point back toward the road (rotation chosen so -x faces the lanes)

    buildLandmarks(scene, out);
    out.counts = { houses: houses.length, shops: shops.length, palms: palms.length, walls: walls.length, lamps: lamps.length, pillars: pillars.length };
    return out;
  };

  function buildLandmarks(scene, out) {
    const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
    for (const lm of D.landmarks) {
      const P = N.proj(lm.at);
      const g = new THREE.Group();
      g.position.set(P.x, 0, P.z);
      if (lm.kind === 'bigA') {
        const red = lam(0xc8102e);
        const legL = new THREE.Mesh(new THREE.BoxGeometry(5, 64, 4), red); legL.position.set(-9, 31, 0); legL.rotation.z = -0.22;
        const legR = new THREE.Mesh(new THREE.BoxGeometry(5, 64, 4), red); legR.position.set(9, 31, 0); legR.rotation.z = 0.22;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 4), red); bar.position.set(0, 26, 0);
        const halo = new THREE.Mesh(new THREE.TorusGeometry(7, 0.9, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
        halo.position.set(0, 68, 0); halo.rotation.x = Math.PI / 2;
        g.add(legL, legR, bar, halo);
        const stad = new THREE.Mesh(new THREE.CylinderGeometry(70, 76, 22, 24, 1, true), new THREE.MeshLambertMaterial({ color: 0x8c8f94, side: THREE.DoubleSide }));
        stad.position.set(-110, 11, 40);
        g.add(stad);
      } else if (lm.kind === 'matterhorn') {
        const m = new THREE.Mesh(new THREE.ConeGeometry(30, 58, 7, 3), new THREE.MeshLambertMaterial({ color: 0x9aa0a6, flatShading: true }));
        m.position.y = 29;
        const snow = new THREE.Mesh(new THREE.ConeGeometry(12.5, 24, 7, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
        snow.position.y = 46.5;
        g.add(m, snow);
      } else if (lm.kind === 'arena') {
        const a = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 26, 28), lam(0x4a4f57));
        a.position.y = 13;
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(72, 72, 4, 28), lam(0xf47a38));
        ring.position.y = 24;
        g.add(a, ring);
      } else if (lm.kind === 'wheel') {
        const w = new THREE.Mesh(new THREE.TorusGeometry(18, 0.9, 6, 32), lam(0xe0e0e0));
        w.position.y = 22;
        const hub = new THREE.Mesh(new THREE.BoxGeometry(2, 22, 2), lam(0xbbbbbb)); hub.position.y = 11;
        g.add(w, hub);
        for (let k = 0; k < 12; k++) {
          const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), lam([0xe74c3c, 0xf1c40f, 0x3498db, 0x2ecc71][k % 4]));
          cab.position.set(Math.cos(k / 12 * Math.PI * 2) * 18, 22 + Math.sin(k / 12 * Math.PI * 2) * 18, 0);
          g.add(cab);
        }
        out.wheel = w;
      } else if (lm.kind === 'balloon') {
        const b = new THREE.Mesh(new THREE.SphereGeometry(11, 20, 14), lam(0xf28c28));
        b.position.y = 110;
        const basket = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 5), lam(0x6b4a2a)); basket.position.y = 96;
        g.add(b, basket);
        out.balloon = g;
      } else if (lm.kind === 'pier') {
        const deck = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 250), lam(0xb8a98f));
        deck.position.set(0, 5, 0);
        g.rotation.y = -0.75;
        g.position.y = 0;
        deck.position.z = 125;
        const end = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 12), lam(0xe1503c)); end.position.set(0, 8, 245);
        g.add(deck, end);
        for (let z = 10; z < 250; z += 18) {
          const pl = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), lam(0x6d6152)); pl.position.set(0, 2, z); g.add(pl);
        }
      } else continue;
      scene.add(g);
    }
  }
})();
