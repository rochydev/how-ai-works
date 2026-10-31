import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { canvasTexture, codeLines } from './textures.js';

export const DESK = { top: 0.75, z: -2.1, width: 1.9, depth: 0.78 };
export const SCREEN = { width: 1.0, height: 0.5625, center: new THREE.Vector3(0, 1.17, -2.262) };

const KEY_ROWS = ['1234567890-', 'qwertyuiop', 'asdfghjklñ', 'zxcvbnm,.'];
const KEY_PITCH = 0.027;

/**
 * Desk with the main monitor (whose screen is driven by the ScreenOS),
 * a vertical code monitor, RGB keyboard, mouse and a glass-panel tower.
 */
export function createDesk() {
  RectAreaLightUniformsLib.init();
  const group = new THREE.Group();
  group.name = 'desk';

  const dark = new THREE.MeshStandardMaterial({ color: '#16151f', roughness: 0.45, metalness: 0.4 });
  const black = new THREE.MeshStandardMaterial({ color: '#0a0a10', roughness: 0.35, metalness: 0.5 });
  const wood = new THREE.MeshStandardMaterial({ color: '#2a1d18', roughness: 0.6 });

  // ---- Desk ------------------------------------------------------------
  const top = new THREE.Mesh(new THREE.BoxGeometry(DESK.width, 0.04, DESK.depth), wood);
  top.position.set(0, DESK.top - 0.02, DESK.z);
  top.castShadow = top.receiveShadow = true;
  group.add(top);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, DESK.top - 0.04, DESK.depth - 0.1), black);
    leg.position.set(sx * (DESK.width / 2 - 0.1), (DESK.top - 0.04) / 2, DESK.z);
    leg.castShadow = true;
    group.add(leg);
  }
  const mat = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.004, 0.38),
    new THREE.MeshStandardMaterial({ color: '#121022', roughness: 0.9 }),
  );
  mat.position.set(0.08, DESK.top + 0.002, -1.92);
  mat.receiveShadow = true;
  group.add(mat);
  const matEdge = new THREE.Mesh(
    new THREE.BoxGeometry(0.955, 0.0045, 0.385),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#b26bff').multiplyScalar(1.6), toneMapped: false }),
  );
  matEdge.position.copy(mat.position).y -= 0.0008;
  group.add(matEdge);

  // ---- Main monitor ----------------------------------------------------
  const monitor = new THREE.Group();
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(SCREEN.width + 0.03, SCREEN.height + 0.035, 0.03), black);
  bezel.position.copy(SCREEN.center).z -= 0.017;
  bezel.castShadow = true;
  monitor.add(bezel);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.06), dark);
  back.position.set(0, SCREEN.center.y, SCREEN.center.z - 0.06);
  monitor.add(back);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.03), dark);
  neck.position.set(0, DESK.top + 0.2, SCREEN.center.z - 0.09);
  monitor.add(neck);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.015, 0.2), dark);
  base.position.set(0, DESK.top + 0.008, SCREEN.center.z - 0.04);
  base.castShadow = true;
  monitor.add(base);

  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN.width, SCREEN.height),
    new THREE.MeshBasicMaterial({ color: '#0b0a18', toneMapped: false }),
  );
  screenMesh.position.copy(SCREEN.center);
  screenMesh.name = 'screen';
  monitor.add(screenMesh);

  // Glow of the screen onto the character, keyboard and desk
  const screenLight = new THREE.RectAreaLight('#8f86ff', 6, SCREEN.width, SCREEN.height);
  screenLight.position.copy(SCREEN.center).z += 0.01;
  screenLight.lookAt(SCREEN.center.x, SCREEN.center.y, 5);
  monitor.add(screenLight);

  // Bias light behind monitor
  const bias = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.36),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff4fd8').multiplyScalar(2.2), toneMapped: false }),
  );
  bias.position.set(0, SCREEN.center.y, SCREEN.center.z - 0.092);
  bias.rotation.y = Math.PI;
  monitor.add(bias);
  group.add(monitor);

  // ---- Vertical code monitor -------------------------------------------
  const code = createCodeMonitor(black, dark);
  code.group.position.set(-0.86, 0, -2.12);
  code.group.rotation.y = 0.5;
  group.add(code.group);

  // ---- Keyboard ----------------------------------------------------------
  const keyboard = createKeyboard(black);
  keyboard.group.position.set(0, DESK.top + 0.004, -1.9);
  group.add(keyboard.group);

  // ---- Mouse -------------------------------------------------------------
  const mouse = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.05, 6, 12), black);
  body.rotation.x = Math.PI / 2;
  body.scale.set(1, 1, 0.55);
  body.position.y = 0.012;
  body.castShadow = true;
  mouse.add(body);
  const mouseLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.004, 0.002, 0.05),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#25f4ee').multiplyScalar(2), toneMapped: false }),
  );
  mouseLed.position.set(0, 0.024, 0.005);
  mouse.add(mouseLed);
  mouse.position.set(0.38, DESK.top + 0.004, -1.86);
  group.add(mouse);

  // ---- Tower -------------------------------------------------------------
  const tower = createTower(black, dark);
  tower.group.position.set(0.79, DESK.top, -2.2);
  group.add(tower.group);

  // ---- Mug ---------------------------------------------------------------
  const mug = new THREE.Group();
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.034, 0.095, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: '#e8e2f5', roughness: 0.35, side: THREE.DoubleSide }),
  );
  cup.position.y = 0.0475;
  cup.castShadow = true;
  mug.add(cup);
  const coffee = new THREE.Mesh(
    new THREE.CircleGeometry(0.035, 20),
    new THREE.MeshStandardMaterial({ color: '#2b160c', roughness: 0.2 }),
  );
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.082;
  mug.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.007, 8, 16, Math.PI), cup.material);
  handle.position.set(0.04, 0.05, 0);
  handle.rotation.z = -Math.PI / 2;
  mug.add(handle);
  mug.position.set(-0.5, DESK.top, -1.86);
  group.add(mug);

  return {
    group,
    screenMesh,
    screenLight,
    keyboard,
    mugTop: new THREE.Vector3(-0.5, DESK.top + 0.1, -1.86),
    mousePosition: mouse.position,
    update(dt, t) {
      code.update(dt, t);
      keyboard.update(dt, t);
      tower.update(dt, t);
    },
  };
}

function createCodeMonitor(black, dark) {
  const group = new THREE.Group();
  const sw = 0.33;
  const sh = 0.58;
  const W = 330;
  const H = 580;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const lines = codeLines();
  const lineH = 19;

  const draw = (scroll) => {
    g.fillStyle = '#0a0916';
    g.fillRect(0, 0, W, H);
    g.font = "500 12px 'JetBrains Mono', monospace";
    const start = Math.floor(scroll / lineH);
    for (let i = -1; i < H / lineH + 1; i++) {
      const idx = start + i;
      const line = lines[((idx % lines.length) + lines.length) % lines.length];
      const y = i * lineH - (scroll % lineH) + 20;
      g.fillStyle = '#4a4670';
      g.fillText(String((idx % 999) + 1).padStart(3, ' '), 6, y);
      let col = '#cfcaf5';
      if (line.startsWith('#')) col = '#6f6a9a';
      else if (/^(def|while|for)/.test(line.trim())) col = '#ff7de4';
      else if (line.includes('return')) col = '#25f4ee';
      g.fillStyle = col;
      g.fillText(line, 38, y);
    }
    g.fillStyle = 'rgba(178,107,255,0.12)';
    g.fillRect(0, H - 26, W, 26);
    g.fillStyle = '#b26bff';
    g.fillText('● training.py   UTF-8   Python', 10, H - 9);
  };
  draw(0);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(sw, sh),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  screen.material.color.setScalar(0.85);
  screen.position.set(0, 1.2, 0.016);
  group.add(screen);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.025, sh + 0.025, 0.028), black);
  bezel.position.set(0, 1.2, 0);
  bezel.castShadow = true;
  group.add(bezel);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.03), dark);
  arm.position.set(0, 0.95, -0.04);
  group.add(arm);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.015, 0.16), dark);
  foot.position.set(0, DESK.top + 0.008, -0.03);
  group.add(foot);

  let scroll = 0;
  let acc = 0;
  return {
    group,
    update(dt) {
      scroll += dt * 14;
      acc += dt;
      if (acc > 1 / 20) {
        acc = 0;
        draw(scroll);
        tex.needsUpdate = true;
      }
    },
  };
}

function createKeyboard(black) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.022, 0.15), black);
  base.position.y = 0.011;
  base.castShadow = true;
  group.add(base);

  const keys = [];
  KEY_ROWS.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      keys.push({ ch, x: -0.15 + c * KEY_PITCH + r * 0.009, z: -0.045 + r * KEY_PITCH });
    });
  });
  keys.push({ ch: ' ', x: 0.0, z: -0.045 + 4 * KEY_PITCH, wide: 6 });
  keys.push({ ch: '\n', x: 0.17, z: -0.045 + 1.5 * KEY_PITCH, wide: 1.6 });
  keys.push({ ch: '\b', x: 0.172, z: -0.045, wide: 1.6 });

  const capGeo = new THREE.BoxGeometry(0.022, 0.011, 0.022);
  const caps = new THREE.InstancedMesh(
    capGeo,
    new THREE.MeshStandardMaterial({ color: '#15141c', roughness: 0.5 }),
    keys.length,
  );
  const glowGeo = new THREE.BoxGeometry(0.025, 0.004, 0.025);
  const glow = new THREE.InstancedMesh(glowGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), keys.length);
  const m = new THREE.Matrix4();
  const press = new Float32Array(keys.length);
  keys.forEach((k, i) => {
    const sx = k.wide || 1;
    m.compose(new THREE.Vector3(k.x, 0.028, k.z), new THREE.Quaternion(), new THREE.Vector3(sx, 1, 1));
    caps.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(k.x, 0.022, k.z), new THREE.Quaternion(), new THREE.Vector3(sx, 1, 1));
    glow.setMatrixAt(i, m);
    glow.setColorAt(i, new THREE.Color('#b26bff'));
  });
  caps.castShadow = true;
  group.add(glow, caps);

  const index = new Map(keys.map((k, i) => [k.ch, i]));
  const color = new THREE.Color();
  const capMatrix = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();

  const keyFor = (ch) => {
    const lower = (ch || ' ').toLowerCase();
    const normalized = lower.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (index.has(lower)) return index.get(lower);
    if (index.has(normalized)) return index.get(normalized);
    // Any other symbol: map deterministically onto a key so typing still animates
    return lower.charCodeAt(0) % (keys.length - 3);
  };

  return {
    group,
    /** World-space position of the key for a character (for hand IK). */
    keyWorldPosition(ch, target = new THREE.Vector3()) {
      const k = keys[keyFor(ch)];
      return group.localToWorld(target.set(k.x, 0.04, k.z));
    },
    press(ch) {
      press[keyFor(ch)] = 1;
    },
    update(dt, t) {
      for (let i = 0; i < keys.length; i++) {
        press[i] = Math.max(0, press[i] - dt * 4);
        const hue = (keys[i].x * 1.6 + t * 0.12) % 1;
        color.setHSL((hue + 1) % 1, 0.9, 0.55).multiplyScalar(1.4 + press[i] * 4);
        if (press[i] > 0) color.lerp(new THREE.Color(4, 4, 4), press[i] * 0.5);
        glow.setColorAt(i, color);
        caps.getMatrixAt(i, capMatrix);
        capMatrix.decompose(pos, quat, scl);
        pos.y = 0.028 - press[i] * 0.004;
        capMatrix.compose(pos, quat, scl);
        caps.setMatrixAt(i, capMatrix);
      }
      glow.instanceColor.needsUpdate = true;
      caps.instanceMatrix.needsUpdate = true;
    },
  };
}

function createTower(black, dark) {
  const group = new THREE.Group();
  const w = 0.21;
  const h = 0.46;
  const d = 0.42;
  // Open box: the +x face is left out so the interior shows through the glass
  const shellMat = black.clone();
  shellMat.side = THREE.DoubleSide;
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [hidden, shellMat, shellMat, shellMat, shellMat, shellMat]);
  shell.position.y = h / 2;
  shell.castShadow = true;
  group.add(shell);

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(d - 0.02, h - 0.02),
    new THREE.MeshStandardMaterial({
      color: '#8c7bd6',
      roughness: 0.05,
      metalness: 0.2,
      transparent: true,
      opacity: 0.18,
    }),
  );
  glass.position.set(w / 2 + 0.002, h / 2, 0);
  glass.rotation.y = Math.PI / 2;
  group.add(glass);

  // Interior, mounted against the far (-x) wall of the case
  const inner = new THREE.Group();
  inner.position.set(-w / 2 + 0.012, 0, 0);
  group.add(inner);
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(d - 0.04, h - 0.04),
    new THREE.MeshStandardMaterial({ color: '#0d0c16', roughness: 0.6 }),
  );
  board.position.set(-0.0005, h / 2, 0);
  board.rotation.y = Math.PI / 2;
  inner.add(board);

  const fans = [];
  const ringMat = new THREE.MeshBasicMaterial({ toneMapped: false, color: new THREE.Color(2, 0.6, 2.6) });
  const fanPos = [
    [0.12, 0.34],
    [0.12, 0.2],
    [-0.12, 0.38],
  ];
  for (const [z, y] of fanPos) {
    const fan = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.006, 8, 32), ringMat);
    fan.add(ring);
    const blades = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.016, 0.002), dark);
      blade.position.x = 0.022;
      const pivot = new THREE.Group();
      pivot.rotation.z = (i / 7) * Math.PI * 2;
      blade.rotation.x = 0.4;
      pivot.add(blade);
      blades.add(pivot);
    }
    fan.add(blades);
    fan.position.set(0.004, y, z);
    fan.rotation.y = Math.PI / 2;
    inner.add(fan);
    fans.push(blades);
  }
  // GPU with LED stripe
  const gpu = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.26), dark);
  gpu.position.set(0.016, 0.13, -0.04);
  inner.add(gpu);
  const gpuLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.002, 0.006, 0.24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.6, 2.6), toneMapped: false }),
  );
  gpuLed.position.set(0.032, 0.155, -0.04);
  inner.add(gpuLed);
  // RAM sticks
  for (let i = 0; i < 4; i++) {
    const ram = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.07, 0.006),
      new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(i * 0.18, 0.9, 0.55).multiplyScalar(2), toneMapped: false }),
    );
    ram.position.set(0.006, 0.33, -0.05 - i * 0.014);
    inner.add(ram);
  }
  const towerLight = new THREE.PointLight('#c56bff', 1.4, 1.4, 2);
  towerLight.position.set(0.02, h / 2, 0);
  group.add(towerLight);

  return {
    group,
    update(dt, t) {
      for (const f of fans) f.rotation.z -= dt * 9;
      ringMat.color.setHSL((t * 0.05) % 1, 0.9, 0.55).multiplyScalar(2.4);
    },
  };
}
