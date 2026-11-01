/* PMC interactive hero: configure a part in 3D, then follow it from quote to machining,
   inspection, packing and door-to-door delivery. Loaded on demand by site.js. */
import * as THREE from '../vendor/three/three.module.min.js';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';

const MM = 0.01; // scene units per millimetre; parts are modelled in millimetres

const MATERIALS = {
  aluminium: { label: 'Aluminium 6061', color: 0xd4d8dd, metalness: 1, roughness: 0.32 },
  steel: { label: 'Stainless steel 304', color: 0xaeb4bb, metalness: 1, roughness: 0.2 },
  brass: { label: 'Brass C360', color: 0xd8b35c, metalness: 1, roughness: 0.28 },
  anodised: { label: 'Black anodised aluminium', color: 0x2a2e35, metalness: 0.75, roughness: 0.4 },
};

const STEPS = ['Design', 'Quote', 'Machine', 'Inspect', 'Deliver'];

/* ---------- Part geometry (millimetres, extruded upwards from y = 0) ---------- */

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

function circle(x, y, r) {
  const p = new THREE.Path();
  p.absarc(x, y, r, 0, Math.PI * 2, true);
  return p;
}

function disc(r, holeR) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, Math.PI * 2, false);
  if (holeR) s.holes.push(circle(0, 0, holeR));
  return s;
}

function slot(cx, cy, len, w) {
  const p = new THREE.Path();
  const r = w / 2;
  const hx = len / 2 - r;
  p.moveTo(cx - hx, cy - r);
  p.lineTo(cx + hx, cy - r);
  p.absarc(cx + hx, cy, r, -Math.PI / 2, Math.PI / 2, false);
  p.lineTo(cx - hx, cy + r);
  p.absarc(cx - hx, cy, r, Math.PI / 2, Math.PI * 1.5, false);
  return p;
}

// Extrude a shape so it stands `height` mm tall with its base at `base` mm. The bevel grows the
// outline by BEVEL mm per side (a bevelOffset would avoid that but leaves stray edges on flat faces).
const BEVEL = 0.8;
function extrude(shape, height, base = 0, curveSegments = 40) {
  const bevel = BEVEL;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: height - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, base + bevel, 0);
  return g;
}

const layer = (shape, height, base = 0, dx = 0, curveSegments = 40) => ({ shape, height, base, dx, curveSegments });

const PARTS = {
  bracket() {
    const plate = roundedRect(160, 100, 10);
    [[-64, -36], [64, -36], [-64, 36], [64, 36]].forEach(([x, y]) => plate.holes.push(circle(x, y, 5.5)));
    plate.holes.push(slot(30, 0, 56, 16));
    return {
      name: 'mounting bracket',
      layers: [layer(plate, 14), layer(disc(22, 9), 18, 13.6, -34)],
      checks: ['Length 160.00 mm', 'Width 100.00 mm', 'Boss bore Ø18.00 mm', 'Holes Ø11.00 mm ×4', 'Slot width 16.00 mm'],
    };
  },
  flange() {
    const plate = disc(72, 26);
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      plate.holes.push(circle(Math.cos(a) * 54, Math.sin(a) * 54, 6.5));
    }
    return {
      name: 'flange',
      layers: [layer(plate, 14, 0, 0, 72), layer(disc(38, 26), 24, 13.6, 0, 72)],
      checks: ['Outside Ø144.00 mm', 'Bore Ø52.00 mm', 'Bolt circle Ø108.00 mm', 'Holes Ø13.00 mm ×6', 'Hub height 24.00 mm'],
    };
  },
  gear() {
    const teeth = 22;
    const m = 5.5;
    const rp = (teeth * m) / 2;
    const ra = rp + m;
    const rf = rp - 1.25 * m;
    const p = (Math.PI * 2) / teeth;
    const s = new THREE.Shape();
    for (let k = 0; k < teeth; k += 1) {
      const c = k * p;
      const pts = [[rf, c - 0.31 * p], [rp, c - 0.24 * p], [ra, c - 0.14 * p], [ra, c + 0.14 * p], [rp, c + 0.24 * p], [rf, c + 0.31 * p], [rf, c + 0.5 * p]];
      pts.forEach(([r, a], i) => {
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (k === 0 && i === 0) s.moveTo(x, y); else s.lineTo(x, y);
      });
    }
    s.closePath();
    s.holes.push(circle(0, 0, 15));
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      s.holes.push(circle(Math.cos(a) * 38, Math.sin(a) * 38, 8.5));
    }
    return {
      name: 'spur gear',
      layers: [layer(s, 20, 0, 0, 24), layer(disc(26, 15), 12, 19.6, 0, 48)],
      checks: ['22 teeth, module 5.5', 'Outside Ø132.00 mm', 'Pitch Ø121.00 mm', 'Bore Ø30.00 mm', 'Face width 20.00 mm'],
    };
  },
};

/* ---------- Delivery destination, guessed from the time zone (no prompt, nothing sent) ---------- */

const ZONES = {
  'America/Toronto': ['Toronto', 43.65, -79.38], 'America/Montreal': ['Montréal', 45.5, -73.57],
  'America/Vancouver': ['Vancouver', 49.28, -123.12], 'America/Edmonton': ['Calgary', 51.05, -114.07],
  'America/Winnipeg': ['Winnipeg', 49.9, -97.14], 'America/Halifax': ['Halifax', 44.65, -63.57],
  'America/Regina': ['Regina', 50.45, -104.6], 'America/St_Johns': ["St. John's", 47.56, -52.71],
  'America/New_York': ['New York', 40.71, -74.0], 'America/Detroit': ['Detroit', 42.33, -83.05],
  'America/Chicago': ['Chicago', 41.88, -87.63], 'America/Denver': ['Denver', 39.74, -104.99],
  'America/Phoenix': ['Phoenix', 33.45, -112.07], 'America/Los_Angeles': ['Los Angeles', 34.05, -118.24],
  'America/Mexico_City': ['Mexico City', 19.43, -99.13], 'America/Monterrey': ['Monterrey', 25.69, -100.32],
  'America/Sao_Paulo': ['São Paulo', -23.55, -46.63], 'America/Bogota': ['Bogotá', 4.71, -74.07],
  'Europe/London': ['London', 51.51, -0.13], 'Europe/Dublin': ['Dublin', 53.35, -6.26],
  'Europe/Paris': ['Paris', 48.86, 2.35], 'Europe/Berlin': ['Berlin', 52.52, 13.4],
  'Europe/Amsterdam': ['Amsterdam', 52.37, 4.9], 'Europe/Brussels': ['Brussels', 50.85, 4.35],
  'Europe/Madrid': ['Madrid', 40.42, -3.7], 'Europe/Rome': ['Milan', 45.46, 9.19],
  'Europe/Zurich': ['Zürich', 47.37, 8.54], 'Europe/Vienna': ['Vienna', 48.21, 16.37],
  'Europe/Stockholm': ['Stockholm', 59.33, 18.07], 'Europe/Warsaw': ['Warsaw', 52.23, 21.01],
  'Europe/Istanbul': ['Istanbul', 41.01, 28.98], 'Asia/Dubai': ['Dubai', 25.2, 55.27],
  'Asia/Riyadh': ['Riyadh', 24.71, 46.68], 'Asia/Qatar': ['Doha', 25.29, 51.53],
  'Asia/Kolkata': ['New Delhi', 28.61, 77.21], 'Asia/Calcutta': ['New Delhi', 28.61, 77.21],
  'Asia/Singapore': ['Singapore', 1.35, 103.82], 'Asia/Kuala_Lumpur': ['Kuala Lumpur', 3.14, 101.69],
  'Asia/Bangkok': ['Bangkok', 13.76, 100.5], 'Asia/Shanghai': ['Shanghai', 31.23, 121.47],
  'Asia/Tokyo': ['Tokyo', 35.68, 139.69], 'Asia/Seoul': ['Seoul', 37.57, 126.98],
  'Australia/Sydney': ['Sydney', -33.87, 151.21], 'Australia/Melbourne': ['Melbourne', -37.81, 144.96],
  'Africa/Johannesburg': ['Johannesburg', -26.2, 28.05], 'Africa/Lagos': ['Lagos', 6.52, 3.38],
};
const REGIONS = {
  America: ['North America', 41.5, -87.0], Europe: ['Europe', 50.1, 8.7], Asia: ['Asia', 1.35, 103.82],
  Australia: ['Australia', -33.87, 151.21], Africa: ['Africa', -1.29, 36.82], Pacific: ['the Pacific', -36.85, 174.76],
};
const FACTORY = { lat: 13.08, lon: 80.27 };

function destination() {
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* default below */ }
  if (ZONES[tz]) { const [city, lat, lon] = ZONES[tz]; return { city, lat, lon }; }
  const [city, lat, lon] = REGIONS[tz.split('/')[0]] || REGIONS.America;
  return { city, lat, lon };
}
const mapXY = ({ lat, lon }) => ({ x: lon + 180, y: 80 - lat }); // matches world-dots.svg (viewBox 0 0 360 138)

/* ---------- Small helpers ---------- */

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const span = (t, a, b) => clamp01((t - a) / (b - a));

function radialTexture(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  draw(c.getContext('2d'), 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}

/* ---------- Main ---------- */

export function initLab(root, { reduceMotion }) {
  const q = (sel) => root.querySelector(sel);
  const qa = (sel) => Array.from(root.querySelectorAll(sel));
  const canvas = q('[data-lab-canvas]');
  const stageEl = q('[data-lab-stage]');
  const statusEl = q('[data-lab-status]');
  const stepEl = q('[data-lab-step]');
  const dimsEl = q('[data-lab-dims]');
  const checksEl = q('[data-lab-checks]');
  const barEl = q('[data-lab-bar]');
  const sendBtn = q('[data-lab-send]');
  const stopBtn = q('[data-lab-stop]');
  const doneEl = q('[data-lab-done]');
  const doneTitle = q('[data-lab-done-title]');
  const quoteLink = q('[data-lab-quote]');
  const arcEl = q('[data-lab-arc]');
  const parcelEl = q('[data-lab-parcel]');
  const toPin = q('[data-lab-to]');
  const toLabel = q('[data-lab-to-label]');
  const stepItems = qa('[data-lab-steps] li');
  const partBtns = qa('[data-part]');
  const matBtns = qa('[data-material]');
  const reduce = () => reduceMotion.matches;

  /* Renderer, scene, camera */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  camera.position.set(2.4, 1.9, 3.1);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = 1.45;
  controls.autoRotate = !reduce();
  controls.autoRotateSpeed = 1.1;
  let idleTimer = 0;
  controls.addEventListener('start', () => { controls.autoRotate = false; clearTimeout(idleTimer); });
  controls.addEventListener('end', () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { controls.autoRotate = !reduce() && stage === 'design'; }, 6000);
  });

  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-2, 4, 3);
  const rim = new THREE.DirectionalLight(0xff5a5f, 0.55);
  rim.position.set(3, 1.2, -3);
  scene.add(key, rim, new THREE.HemisphereLight(0xdfe6ee, 0x0c0e11, 0.35));

  // Machine-bed grid and a soft contact shadow, both fading out at the edges.
  const gridTex = radialTexture((ctx, n) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= n; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, n); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(n, i); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'destination-in';
    const g = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, n, n);
  });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: gridTex, transparent: true, depthWrite: false }));
  grid.rotation.x = -Math.PI / 2;
  const shadowTex = radialTexture((ctx, n) => {
    const g = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.6)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, n, n);
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.001;
  scene.add(grid, shadow);

  const work = new THREE.Group(); // everything in millimetres
  work.scale.setScalar(MM);
  scene.add(work);

  /* Materials */
  const metal = new THREE.MeshStandardMaterial({ color: 0xd4d8dd, metalness: 1, roughness: 0.32 });
  const blueprint = new THREE.MeshBasicMaterial({ color: 0x10273f, transparent: true, opacity: 0.5, depthWrite: false });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x0b0d10, transparent: true, opacity: 0.32 });
  const stockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.55, roughness: 0.62, envMapIntensity: 0.25 });
  const toolMetal = new THREE.MeshStandardMaterial({ color: 0xc9cdd3, metalness: 1, roughness: 0.25, flatShading: true });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x23272e, metalness: 0.6, roughness: 0.45 });
  const brandRed = new THREE.MeshStandardMaterial({ color: 0xe9141d, metalness: 0.2, roughness: 0.5 });
  const cardboard = new THREE.MeshStandardMaterial({ color: 0xb68a58, metalness: 0, roughness: 0.92 });

  /* State */
  let partKind = 'bracket';
  let matKind = 'aluminium';
  let part = null; // { group, meshes, edges, box, def }
  let stage = 'design';
  let stageT = 0;
  let stock = null;
  let tool = null;
  let path = null;
  let chips = null;
  let scanner = null;
  let box = null;
  const dest = destination();

  function setMaterial(kind) {
    matKind = kind;
    const m = MATERIALS[kind];
    metal.color.setHex(m.color);
    metal.metalness = m.metalness;
    metal.roughness = m.roughness;
    matBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.material === kind)));
    updateReadout();
  }

  function updateReadout() {
    if (!part) return;
    const s = part.box.getSize(new THREE.Vector3());
    dimsEl.innerHTML = '';
    dimsEl.append(`${Math.round(s.x - BEVEL * 2)} × ${Math.round(s.z - BEVEL * 2)} × ${Math.round(s.y)} mm`, document.createElement('br'), MATERIALS[matKind].label);
    canvas.setAttribute('aria-label', `3D model of a ${part.def.name} in ${MATERIALS[matKind].label}. Drag, or use the arrow keys, to rotate.`);
    const url = new URL(quoteLink.getAttribute('href'), location.href);
    url.searchParams.set('service', 'cnc-machining');
    url.searchParams.set('material', MATERIALS[matKind].label);
    quoteLink.href = `${url.pathname.split('/').pop()}${url.search}${url.hash}`;
  }

  function buildPart(kind) {
    if (part) { work.remove(part.group); disposeTree(part.group); }
    partKind = kind;
    const def = PARTS[kind]();
    def.geos = def.layers.map((l) => extrude(l.shape, l.height, l.base, l.curveSegments).translate(l.dx, 0, 0));
    const bbox = new THREE.Box3();
    def.geos.forEach((g) => { g.computeBoundingBox(); bbox.union(g.boundingBox); });
    const off = new THREE.Vector3(-(bbox.min.x + bbox.max.x) / 2, -bbox.min.y, -(bbox.min.z + bbox.max.z) / 2);
    def.geos.forEach((g) => { g.translate(off.x, off.y, off.z); g.computeBoundingBox(); g.computeBoundingSphere(); });
    bbox.translate(off);
    const group = new THREE.Group();
    const meshes = def.geos.map((g) => new THREE.Mesh(g, metal));
    const edges = def.geos.map((g) => new THREE.LineSegments(new THREE.EdgesGeometry(g, 28), edgeMat));
    meshes.forEach((m) => group.add(m));
    edges.forEach((e) => group.add(e));
    work.add(group);
    const outlines = def.layers.map((l) => {
      const { shape: contour, holes } = l.shape.extractPoints(24);
      return { contour, holes, top: l.base + l.height, dx: l.dx + off.x, dz: off.z };
    });
    part = { group, meshes, edges, box: bbox, def, outlines };
    const size = bbox.getSize(new THREE.Vector3());
    shadow.scale.set(size.x * MM * 1.7, size.z * MM * 1.7, 1);
    partBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.part === kind)));
    frame(1);
    updateReadout();
  }

  // Keep the current viewing angle but move the camera so the part (plus `pad`) fits the view.
  function frame(pad, instant = true) {
    const size = part.box.getSize(new THREE.Vector3()).multiplyScalar(MM);
    const radius = Math.max(size.x, size.z, size.y * 1.6) * 0.62 * pad;
    const fit = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
    const aspectFix = camera.aspect < 1 ? 1 / camera.aspect : 1;
    const target = new THREE.Vector3(0, size.y * 0.35, 0);
    const dir = camera.position.clone().sub(controls.target).normalize();
    const pos = target.clone().add(dir.multiplyScalar(fit * Math.min(aspectFix, 1.6)));
    if (instant) { controls.target.copy(target); camera.position.copy(pos); }
    return { target, pos };
  }

  /* Camera tween used when the journey starts */
  let camTween = null;
  function tweenCamera(polar, azimuth, pad, dur = 0.9) {
    const { target } = frame(pad, false);
    const size = part.box.getSize(new THREE.Vector3()).multiplyScalar(MM);
    const radius = Math.max(size.x, size.z, size.y * 1.6) * 0.62 * pad;
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * Math.min(camera.aspect < 1 ? 1 / camera.aspect : 1, 1.6);
    const end = new THREE.Vector3().setFromSphericalCoords(dist, polar, azimuth).add(target);
    if (reduce()) { controls.target.copy(target); camera.position.copy(end); return; }
    camTween = { t: 0, dur, from: camera.position.clone(), to: end, tFrom: controls.target.clone(), tTo: target };
  }

  /* ---------- Machining simulation: a height-field of stock columns cut by an end mill ---------- */

  function buildStock() {
    const b = part.box;
    const margin = 8;
    const minX = b.min.x - margin;
    const minZ = b.min.z - margin;
    const sx = b.max.x - b.min.x + margin * 2;
    const sz = b.max.z - b.min.z + margin * 2;
    const height = b.max.y + 6;
    const cell = Math.max(sx, sz) / 46;
    const cols = Math.ceil(sx / cell);
    const rows = Math.ceil(sz / cell);
    const count = cols * rows;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), stockMat, count);
    const tops = new Float32Array(count); // part surface height under each column
    const heights = new Float32Array(count).fill(height);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) tops[r * cols + c] = topAt(minX + (c + 0.5) * cell, minZ + (r + 0.5) * cell);
    }
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    const s = { mesh, tops, heights, cols, rows, cell, minX, minZ, height, dirty: true };
    work.add(mesh);
    updateStock(s);
    return s;
  }

  // Height of the finished part at (x, z) in millimetres: the tallest layer whose outline contains the point.
  const inPoly = (pts, x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
      const a = pts[i];
      const b = pts[j];
      if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  };
  function topAt(x, z) {
    let top = 0;
    part.outlines.forEach((o) => {
      const sx = x - o.dx;
      const sy = -(z - o.dz); // shapes are drawn in XY, then rotated so +Y becomes -Z
      if (o.top > top && inPoly(o.contour, sx, sy) && !o.holes.some((h) => inPoly(h, sx, sy))) top = o.top;
    });
    return top;
  }

  const col = new THREE.Color();
  const stockLow = new THREE.Color(0x24282e);
  const stockHigh = new THREE.Color(0x5a6068);
  const m4 = new THREE.Matrix4();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  const q4 = new THREE.Quaternion();
  function updateStock(s) {
    for (let r = 0; r < s.rows; r += 1) {
      for (let c = 0; c < s.cols; c += 1) {
        const i = r * s.cols + c;
        const h = s.heights[i];
        v3.set(s.minX + (c + 0.5) * s.cell, h / 2, s.minZ + (r + 0.5) * s.cell);
        s3.set(h > 0.01 ? s.cell * 0.995 : 0.0001, Math.max(h, 0.0001), h > 0.01 ? s.cell * 0.995 : 0.0001);
        s.mesh.setMatrixAt(i, m4.compose(v3, q4, s3));
        s.mesh.setColorAt(i, col.copy(stockLow).lerp(stockHigh, h / s.height));
      }
    }
    s.mesh.instanceMatrix.needsUpdate = true;
    s.mesh.instanceColor.needsUpdate = true;
    s.dirty = false;
  }

  // Lower every column under the cutter (radius R at x, z) to depth d; columns where the
  // finished part reaches d are removed entirely so the real part surface shows through.
  function cut(x, z, d, R) {
    const s = stock;
    let removed = 0;
    const c0 = Math.max(0, Math.floor((x - R - s.minX) / s.cell));
    const c1 = Math.min(s.cols - 1, Math.floor((x + R - s.minX) / s.cell));
    const r0 = Math.max(0, Math.floor((z - R - s.minZ) / s.cell));
    const r1 = Math.min(s.rows - 1, Math.floor((z + R - s.minZ) / s.cell));
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const cx = s.minX + (c + 0.5) * s.cell - x;
        const cz = s.minZ + (r + 0.5) * s.cell - z;
        if (cx * cx + cz * cz > R * R) continue;
        const i = r * s.cols + c;
        if (s.heights[i] <= d + 0.01) continue;
        removed += s.heights[i] - d;
        s.heights[i] = s.tops[i] >= d - 0.01 ? 0 : d;
      }
    }
    if (removed > 0) s.dirty = true;
    return removed;
  }

  function buildTool(R) {
    const g = new THREE.Group();
    const mill = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 36, 7, 1), toolMetal);
    mill.position.y = 18;
    const holder = new THREE.Mesh(new THREE.CylinderGeometry(11, 16, 24, 32), darkMetal);
    holder.position.y = 36 + 12;
    const spinGroup = new THREE.Group();
    spinGroup.add(mill, holder);
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 44, 48), darkMetal);
    nose.position.y = 60 + 22;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(24.5, 24.5, 4, 48), brandRed);
    ring.position.y = 63;
    g.add(spinGroup, nose, ring);
    g.userData.spin = spinGroup;
    work.add(g);
    return g;
  }

  // Zig-zag roughing passes at three depths, with rapid moves between them.
  function buildPath(s, R) {
    const segs = [];
    const step = R * 1.5;
    const x0 = s.minX - R * 0.4;
    const x1 = s.minX + s.cols * s.cell + R * 0.4;
    const z0 = s.minZ + R * 0.5;
    const z1 = s.minZ + s.rows * s.cell - R * 0.5;
    const safe = s.height + 24;
    const depths = [s.height * 0.62, s.height * 0.3, 0];
    let pos = new THREE.Vector3(x0, safe, z0);
    const move = (to, cutting, depthIndex) => { segs.push({ a: pos.clone(), b: to.clone(), cutting, depthIndex }); pos = to.clone(); };
    depths.forEach((d, k) => {
      move(new THREE.Vector3(x0, safe, z0), false, k);
      move(new THREE.Vector3(x0, d, z0), false, k);
      let dir = 1;
      for (let z = z0; z <= z1 + 0.01; z += step) {
        const zz = Math.min(z, z1);
        move(new THREE.Vector3(pos.x, d, zz), true, k);
        move(new THREE.Vector3(dir > 0 ? x1 : x0, d, zz), true, k);
        dir *= -1;
      }
      move(new THREE.Vector3(pos.x, safe, pos.z), false, k);
    });
    let total = 0;
    segs.forEach((sg) => { sg.len = sg.a.distanceTo(sg.b) * (sg.cutting ? 1 : 0.35); sg.start = total; total += sg.len; });
    return { segs, total, depths, R, done: 0, seg: 0 };
  }

  function buildChips() {
    const n = 420;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xe6e9ed, size: 0.022, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false }));
    pts.frustumCulled = false;
    work.add(pts);
    return { pts, pos, vel: new Float32Array(n * 3), life: new Float32Array(n), next: 0, n };
  }

  function emitChips(x, y, z, count, R) {
    if (!chips || reduce()) return;
    for (let k = 0; k < count; k += 1) {
      const i = chips.next;
      chips.next = (chips.next + 1) % chips.n;
      const a = Math.random() * Math.PI * 2;
      chips.pos.set([x + Math.cos(a) * R, y + 1, z + Math.sin(a) * R], i * 3);
      const sp = 60 + Math.random() * 120;
      chips.vel.set([Math.cos(a) * sp, 80 + Math.random() * 160, Math.sin(a) * sp], i * 3);
      chips.life[i] = 0.5 + Math.random() * 0.45;
    }
  }

  function updateChips(dt) {
    if (!chips) return;
    for (let i = 0; i < chips.n; i += 1) {
      if (chips.life[i] <= 0) { chips.pos[i * 3 + 1] = -9999; continue; }
      chips.life[i] -= dt;
      chips.vel[i * 3 + 1] -= 980 * dt;
      chips.pos[i * 3] += chips.vel[i * 3] * dt;
      chips.pos[i * 3 + 1] = Math.max(0.5, chips.pos[i * 3 + 1] + chips.vel[i * 3 + 1] * dt);
      chips.pos[i * 3 + 2] += chips.vel[i * 3 + 2] * dt;
    }
    chips.pts.geometry.attributes.position.needsUpdate = true;
  }

  function removeObj(o) { if (o) { work.remove(o); disposeTree(o); } }

  /* ---------- Inspection scanner and shipping box ---------- */

  function buildScanner() {
    const b = part.box;
    const h = b.max.y + 24;
    const d = b.max.z - b.min.z + 30;
    const g = new THREE.Group();
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(d, h), new THREE.MeshBasicMaterial({ color: 0xff3b42, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    sheet.rotation.y = Math.PI / 2;
    sheet.position.y = h / 2;
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, d), new THREE.MeshBasicMaterial({ color: 0xff5a5f }));
    line.position.y = 0.5;
    g.add(sheet, line);
    work.add(g);
    return g;
  }

  function buildBox() {
    const b = part.box;
    const pad = 12;
    const w = b.max.x - b.min.x + pad * 2;
    const dpt = b.max.z - b.min.z + pad * 2;
    const h = b.max.y + pad;
    const t = 3;
    const g = new THREE.Group();
    const walls = new THREE.Group();
    const add = (geo, x, y, z) => { const m = new THREE.Mesh(geo, cardboard); m.position.set(x, y, z); walls.add(m); return m; };
    add(new THREE.BoxGeometry(w, t, dpt), 0, -t / 2, 0);
    add(new THREE.BoxGeometry(w, h, t), 0, h / 2, dpt / 2);
    add(new THREE.BoxGeometry(w, h, t), 0, h / 2, -dpt / 2);
    add(new THREE.BoxGeometry(t, h, dpt), w / 2, h / 2, 0);
    add(new THREE.BoxGeometry(t, h, dpt), -w / 2, h / 2, 0);
    g.add(walls);
    const flaps = [];
    const flap = (geo, px, pz, axis, sign, ox, oz) => {
      const pivot = new THREE.Group();
      pivot.position.set(px, h, pz);
      const m = new THREE.Mesh(geo, cardboard);
      m.position.set(ox, 0, oz);
      pivot.add(m);
      pivot.userData = { axis, sign };
      g.add(pivot);
      flaps.push(pivot);
    };
    flap(new THREE.BoxGeometry(w, t, dpt / 2), 0, dpt / 2, 'x', -1, 0, -dpt / 4);
    flap(new THREE.BoxGeometry(w, t, dpt / 2), 0, -dpt / 2, 'x', 1, 0, dpt / 4);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(w * 0.16, 0.6, dpt + 2), new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 0.6 }));
    tape.position.y = h + t / 2 + 0.4;
    const label = new THREE.Mesh(new THREE.BoxGeometry(w * 0.26, 0.7, dpt * 0.22), brandRed);
    label.position.set(w * 0.25, h + t / 2 + 0.45, dpt * 0.18);
    g.add(tape, label);
    work.add(g);
    return { g, walls, flaps, tape, label, h };
  }

  /* ---------- Journey stages ---------- */

  const say = (text) => { if (statusEl.textContent !== text) statusEl.textContent = text; };
  const setStep = (i) => {
    stepEl.textContent = `Step ${String(i + 1).padStart(2, '0')} · ${STEPS[i]}`;
    stepItems.forEach((li, k) => {
      li.classList.toggle('is-done', k < i);
      li.classList.toggle('is-current', k === i);
      if (k === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  };

  const STAGES = {
    quote: {
      dur: 2.2, step: 1,
      enter() {
        part.meshes.forEach((m) => { m.material = blueprint; });
        edgeMat.color.setHex(0xff5a5f);
        edgeMat.opacity = 1;
        tweenCamera(0.95, 0.75, 1.15);
        say('Reviewing your drawing…');
      },
      update(t) {
        if (t > 0.38) say('Manufacturability check ✓');
        if (t > 0.72) say(`Quote approved · ${MATERIALS[matKind].label} ✓`);
      },
      exit() {
        part.meshes.forEach((m) => { m.material = metal; });
        edgeMat.color.setHex(0x0b0d10);
        edgeMat.opacity = 0;
      },
    },
    machine: {
      dur: 7, step: 2,
      enter() {
        stock = buildStock();
        const R = Math.max(7, stock.cell * 1.7);
        tool = buildTool(R);
        path = buildPath(stock, R);
        chips = buildChips();
        tool.position.copy(path.segs[0].a);
        tweenCamera(0.92, 0.62, 1.55);
        root.classList.add('is-machining');
        say('CNC machining · roughing pass 1 of 3');
      },
      update(t, dt) {
        const target = path.total * clamp01(t / 0.97);
        const R = path.R;
        // Walk the tool along the path, cutting every couple of millimetres so fast moves leave no gaps.
        let removed = 0;
        while (path.done < target) {
          const sg = path.segs[path.seg];
          const remaining = sg.start + sg.len - path.done;
          const stepLen = Math.min(remaining, target - path.done, sg.cutting ? 2 : 50);
          path.done += stepLen;
          const f = sg.len > 0 ? clamp01((path.done - sg.start) / sg.len) : 1;
          tool.position.lerpVectors(sg.a, sg.b, f);
          if (sg.cutting || tool.position.y < stock.height) removed += cut(tool.position.x, tool.position.z, tool.position.y, R);
          if (path.done >= sg.start + sg.len - 1e-6 && path.seg < path.segs.length - 1) path.seg += 1;
          if (stepLen <= 0) break;
        }
        if (removed > 0) emitChips(tool.position.x, tool.position.y, tool.position.z, Math.min(8, 2 + Math.round(removed / 40)), R);
        if (stock.dirty) updateStock(stock);
        tool.userData.spin.rotation.y += dt * 40;
        updateChips(dt);
        const pass = path.segs[path.seg].depthIndex;
        say(pass < 2 ? `CNC machining · roughing pass ${pass + 1} of 3` : 'CNC machining · finishing pass');
      },
      exit() {
        removeObj(stock && stock.mesh); stock = null;
        removeObj(tool); tool = null;
        removeObj(chips && chips.pts); chips = null;
        root.classList.remove('is-machining');
      },
    },
    inspect: {
      dur: 3, step: 3,
      enter() {
        scanner = buildScanner();
        checksEl.replaceChildren(...part.def.checks.map((c) => { const li = document.createElement('li'); li.textContent = c; return li; }));
        tweenCamera(0.98, 0.9, 1.15);
        say('Inspecting against your drawing…');
      },
      update(t) {
        const b = part.box;
        scanner.position.x = THREE.MathUtils.lerp(b.min.x - 14, b.max.x + 14, ease(span(t, 0, 0.75)));
        scanner.visible = t < 0.8;
        Array.from(checksEl.children).forEach((li, i) => li.classList.toggle('is-on', t > 0.1 + i * 0.13));
        if (t > 0.82) say('Quality check passed ✓');
      },
      exit() { removeObj(scanner); scanner = null; checksEl.replaceChildren(); },
    },
    pack: {
      dur: 2.2, step: 4,
      enter() { box = buildBox(); say('Packing for transit…'); tweenCamera(0.85, 0.7, 1.3); },
      update(t) {
        const grow = ease(span(t, 0, 0.45));
        box.walls.scale.y = Math.max(0.001, grow);
        box.walls.visible = grow > 0.01;
        const close = ease(span(t, 0.45, 0.85));
        box.flaps.forEach((p) => {
          p.visible = grow > 0.98;
          p.rotation[p.userData.axis] = p.userData.sign * (1 - close) * 1.9;
        });
        box.tape.visible = t > 0.88;
        box.label.visible = t > 0.92;
        part.group.visible = close < 0.6;
      },
    },
    ship: {
      dur: 3.6, step: 4,
      enter() {
        const from = mapXY(FACTORY);
        const to = mapXY(dest);
        const lift = Math.max(10, Math.hypot(to.x - from.x, to.y - from.y) * 0.32);
        const cx = (from.x + to.x) / 2;
        const cy = Math.min(from.y, to.y) - lift;
        arcEl.setAttribute('d', `M${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`);
        this.len = arcEl.getTotalLength();
        arcEl.style.strokeDasharray = `${this.len}`;
        arcEl.style.strokeDashoffset = `${this.len}`;
        toPin.style.left = `${(to.x / 360) * 100}%`;
        toPin.style.top = `${(to.y / 138) * 100}%`;
        toLabel.textContent = `You · ${dest.city}`;
        root.classList.add('is-shipping');
        say(`Shipping door to door · India → ${dest.city}`);
      },
      update(t) {
        const p = ease(span(t, 0.08, 0.92));
        arcEl.style.strokeDashoffset = `${this.len * (1 - p)}`;
        const pt = arcEl.getPointAtLength(this.len * p);
        parcelEl.style.left = `${(pt.x / 360) * 100}%`;
        parcelEl.style.top = `${(pt.y / 138) * 100}%`;
      },
    },
    done: {
      dur: Infinity, step: 4,
      enter() {
        root.classList.add('is-done');
        stepItems.forEach((li) => li.classList.add('is-done'));
        doneTitle.textContent = `Delivered to your door in ${dest.city}.`;
        doneEl.hidden = false;
        say('Delivered ✓');
        barEl.style.width = '100%';
      },
    },
  };
  const ORDER = ['quote', 'machine', 'inspect', 'pack', 'ship', 'done'];
  const JOURNEY = ORDER.slice(0, -1).reduce((sum, k) => sum + STAGES[k].dur, 0);
  let elapsed = 0;

  function enterStage(name) {
    stage = name;
    stageT = 0;
    const st = STAGES[name];
    setStep(st.step);
    st.enter.call(st);
  }

  function start() {
    if (stage !== 'design') return;
    controls.autoRotate = false;
    elapsed = 0;
    root.classList.add('is-running');
    [...partBtns, ...matBtns].forEach((b) => { b.disabled = true; });
    sendBtn.disabled = true;
    stopBtn.hidden = false;
    const r = stageEl.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) stageEl.scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' });
    enterStage('quote');
  }

  function reset() {
    if (stage !== 'design' && STAGES[stage].exit) STAGES[stage].exit.call(STAGES[stage]);
    removeObj(stock && stock.mesh); removeObj(tool); removeObj(chips && chips.pts); removeObj(scanner);
    if (box) removeObj(box.g);
    stock = tool = chips = scanner = box = null;
    camTween = null;
    part.group.visible = true;
    part.meshes.forEach((m) => { m.material = metal; });
    edgeMat.color.setHex(0x0b0d10);
    edgeMat.opacity = 0.32;
    checksEl.replaceChildren();
    doneEl.hidden = true;
    root.classList.remove('is-running', 'is-machining', 'is-shipping', 'is-done');
    [...partBtns, ...matBtns].forEach((b) => { b.disabled = false; });
    sendBtn.disabled = false;
    stopBtn.hidden = true;
    barEl.style.width = '0%';
    stage = 'design';
    setStep(0);
    say('Drag to rotate. Pick a part and material, then send it to us.');
    controls.autoRotate = !reduce();
  }

  /* ---------- Loop (runs only while the hero is on screen) ---------- */

  const clock = new THREE.Clock();
  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (camTween) {
      camTween.t += dt / camTween.dur;
      const k = ease(clamp01(camTween.t));
      camera.position.lerpVectors(camTween.from, camTween.to, k);
      controls.target.lerpVectors(camTween.tFrom, camTween.tTo, k);
      if (camTween.t >= 1) camTween = null;
    }
    if (stage !== 'design') {
      const st = STAGES[stage];
      stageT += dt;
      if (stage !== 'done') {
        elapsed += dt;
        barEl.style.width = `${Math.min(100, (elapsed / JOURNEY) * 100)}%`;
      }
      const t = clamp01(stageT / st.dur);
      if (st.update) st.update.call(st, t, dt);
      if (stageT >= st.dur) {
        if (st.exit) st.exit.call(st);
        enterStage(ORDER[ORDER.indexOf(stage) + 1]);
      }
    }
    controls.update();
    renderer.render(scene, camera);
  }

  function resize() {
    const w = stageEl.clientWidth;
    const h = stageEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (stage === 'design' && part) frame(1);
  }
  new ResizeObserver(resize).observe(stageEl);

  let running = false;
  const run = (on) => {
    if (on === running) return;
    running = on;
    clock.getDelta();
    renderer.setAnimationLoop(on ? tick : null);
  };
  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; run(onScreen && !document.hidden); }, { threshold: 0.05 }).observe(root);
  document.addEventListener('visibilitychange', () => run(onScreen && !document.hidden));

  /* ---------- Controls ---------- */

  partBtns.forEach((b) => b.addEventListener('click', () => { if (stage === 'design') buildPart(b.dataset.part); }));
  matBtns.forEach((b) => b.addEventListener('click', () => { if (stage === 'design') setMaterial(b.dataset.material); }));
  sendBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', reset);
  q('[data-lab-replay]').addEventListener('click', () => { reset(); start(); });
  canvas.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const off = camera.position.clone().sub(controls.target);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), (e.key === 'ArrowLeft' ? -1 : 1) * 0.26);
    camera.position.copy(controls.target).add(off);
    controls.autoRotate = false;
  });
  reduceMotion.addEventListener('change', () => { controls.autoRotate = !reduce() && stage === 'design'; });

  buildPart(partKind);
  setMaterial(matKind);
  resize();
  setStep(0);
  run(true);
  root.classList.add('is-ready');
  sendBtn.disabled = false;

  // Small hook for automated checks and the poster renderer.
  return { start, reset, buildPart, setMaterial, renderer, get stage() { return stage; } };
}
