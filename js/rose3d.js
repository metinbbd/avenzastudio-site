// Giriş sahnesi: ön ve arka fotoğraftan hacimli, dönen Rose Hoodie.
// Gövde, siluetin kenardan uzaklık haritasından şişirilir; ön yüze ön fotoğraf,
// arka yüze arka fotoğraf giydirilir. WebGL yoksa CSS'teki düz dönme kalır.
import * as THREE from './three.module.min.js';

const stage = document.querySelector('.stage');
const IMG = 'img/urun/';
const TURN = 14;                 // bir tam tur (saniye)
const A = 0.2, R = 13, B = 0.07;  // gövde kalınlığı, kenar yuvarlaklığı (hücre), göğüs kavisi

function load(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

function buildGeometry(hm, aspect) {
  const gw = hm.width, gh = hm.height;
  const cv = document.createElement('canvas'); cv.width = gw; cv.height = gh;
  const cx = cv.getContext('2d'); cx.drawImage(hm, 0, 0);
  const px = cx.getImageData(0, 0, gw, gh).data;
  const d = (x, y) => px[(y * gw + x) * 4] / 2.5;         // kenara uzaklık (hücre, yumuşatılmış)
  const W = 2 * aspect, H = 2;
  const pos = [], uv = [], idxF = [], idxB = [];
  const z = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const dd = d(x, y);
    const xn = (x + 0.5) / gw * 2 - 1;
    const t = Math.pow(dd / R, 1.35);
    z[y * gw + x] = dd > 0 ? A * (1 - Math.exp(-t)) + B * (1 - Math.exp(-t / 3)) * (1 - xn * xn) : 0;
  }
  const inside = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh && d(x, y) > 0;
  // yüz başına ayrı köşe: ön (0..n-1), arka (n..2n-1)
  const n = gw * gh;
  for (let s = 0; s < 2; s++) for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const X = ((x + 0.5) / gw - 0.5) * W, Y = (0.5 - (y + 0.5) / gh) * H;
    pos.push(X, Y, s === 0 ? z[y * gw + x] : -z[y * gw + x]);
    uv.push((x + 0.5) / gw, 1 - (y + 0.5) / gh);
  }
  for (let y = 0; y < gh - 1; y++) for (let x = 0; x < gw - 1; x++) {
    if (!(inside(x, y) || inside(x + 1, y) || inside(x, y + 1) || inside(x + 1, y + 1))) continue;
    const a = y * gw + x, b = a + 1, c = a + gw, e = c + 1;
    idxF.push(a, c, b, b, c, e);
    idxB.push(n + a, n + b, n + c, n + b, n + e, n + c);
  }
  const make = (idx) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  return { front: make(idxF), back: make(idxB), W, H };
}

async function start() {
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) return;
  const [on, arka, hm] = await Promise.all([load(IMG + 'rose-3d-on.webp'), load(IMG + 'rose-3d-arka.webp'), load(IMG + 'rose-3d-yukseklik.png')]);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const canvas = renderer.domElement; canvas.className = 'stage-3d'; canvas.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0.05, 5.1);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xe4e7e9, 2.55));
  const key = new THREE.DirectionalLight(0xffffff, 0.6); key.position.set(-2.5, 2.5, 3.5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.35); rim.position.set(3, 1, -2.5); scene.add(rim);

  const tex = (img) => { const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; return t; };
  const geo = buildGeometry(hm, on.width / on.height);
  const mat = (img) => new THREE.MeshStandardMaterial({ map: tex(img), alphaTest: 0.5, roughness: 0.92, metalness: 0 });
  // iç yüz: baskısız düz kumaş (kenardaki ince aralıktan baskı görünmesin)
  const alphaOnly = (img) => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const a = p[i + 3]; p[i] = p[i + 1] = p[i + 2] = a; p[i + 3] = 255; }
    x.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
  };
  const inner = new THREE.MeshStandardMaterial({ color: 0xe3e5e6, alphaMap: alphaOnly(on), alphaTest: 0.5, roughness: 1, metalness: 0, side: THREE.BackSide });
  const body = new THREE.Group();
  body.add(new THREE.Mesh(geo.front, mat(on)));
  body.add(new THREE.Mesh(geo.back, mat(arka)));
  body.add(new THREE.Mesh(geo.front, inner));
  body.add(new THREE.Mesh(geo.back, inner));
  body.rotation.x = 0.06;
  const pivot = new THREE.Group(); pivot.add(body); pivot.position.y = 0.06; scene.add(pivot);

  const spin = stage.querySelector('.spin'), shadow = stage.querySelector('.shadow');
  stage.insertBefore(canvas, spin);
  stage.classList.add('is-3d');

  const resize = () => {
    const r = stage.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
  };
  resize(); new ResizeObserver(resize).observe(stage);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let angle = reduce.matches ? 0.45 : 0, hover = false, drag = null, visible = true, last = performance.now(), vel = 0;
  const link = stage.closest('a');
  link.setAttribute('draggable', 'false');
  link.addEventListener('dragstart', (e) => e.preventDefault());
  link.addEventListener('pointerenter', () => { hover = true; });
  link.addEventListener('pointerleave', () => { hover = false; });
  canvas.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); drag = { x: e.clientX, a: angle, moved: false }; vel = 0; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x; if (Math.abs(dx) > 4) drag.moved = true;
    const na = drag.a + dx * 0.012; vel = na - angle; angle = na;
  });
  const endDrag = () => { if (drag && drag.moved) link.dataset.dragged = '1'; drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { drag = null; });
  link.addEventListener('click', (e) => { if (link.dataset.dragged) { delete link.dataset.dragged; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) { last = performance.now(); requestAnimationFrame(frame); } }).observe(stage);

  function frame(t) {
    if (!visible) return;
    const dt = Math.min((t - last) / 1000, 0.05); last = t;
    if (!drag) {
      if (Math.abs(vel) > 0.0005) { angle += vel; vel *= 0.92; }
      else if (!hover && !reduce.matches) angle += dt * Math.PI * 2 / TURN;
    }
    pivot.rotation.y = angle;
    pivot.position.y = 0.06 + (reduce.matches ? 0 : Math.sin(t / 1400) * 0.015);
    if (shadow) shadow.style.transform = 'scaleX(' + (0.62 + 0.38 * Math.abs(Math.cos(angle))).toFixed(3) + ')';
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

start().catch(() => {});
