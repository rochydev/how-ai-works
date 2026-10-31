import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SCREEN } from '../scene/desk.js';
import { easeInOut } from '../screen/draw.js';

const HEAD_CLEARANCE = 0.32;

/**
 * Cinematic camera: named shots with eased transitions, a little handheld
 * drift and mouse parallax, plus a free orbit mode.
 */
export class Director {
  constructor(engine, { onShotChange } = {}) {
    this.engine = engine;
    this.camera = engine.camera;
    this.onShotChange = onShotChange;
    this.controls = new OrbitControls(this.camera, engine.renderer.domElement);
    this.controls.enabled = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.4;
    this.controls.maxDistance = 4.2;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.target.set(0, 1.1, -1.9);

    this.shot = 'room';
    this.from = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 45, shift: new THREE.Vector2() };
    this.to = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 45, shift: new THREE.Vector2() };
    this.current = { pos: this.camera.position.clone(), target: new THREE.Vector3(0, 1, -1.8), fov: 45, shift: new THREE.Vector2() };
    this.progress = 1;
    this.duration = 1.6;
    this.parallax = new THREE.Vector2();
    this.parallaxSmooth = new THREE.Vector2();
    this.layout = { panelRight: 0.28, top: 0.08, bottom: 0.12, mobile: false };
    this.orbitIntro = false;

    this.cut('room');

    const dom = engine.renderer.domElement;
    dom.addEventListener('pointermove', (e) => {
      this.parallax.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    });
    let down = null;
    dom.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    dom.addEventListener('pointerup', () => (down = null));
    dom.addEventListener('pointermove', (e) => {
      if (!down || this.shot === 'free') return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) this.goFree();
    });
    dom.addEventListener('wheel', () => this.shot !== 'free' && this.goFree(), { passive: true });
  }

  setLayout(layout) {
    this.layout = { ...this.layout, ...layout };
    if (this.shot !== 'free') this.retarget();
  }

  shotSpec(name) {
    const spec = this.baseSpec(name);
    spec.shift ??= new THREE.Vector2();
    return spec;
  }

  baseSpec(name) {
    const aspect = this.camera.aspect;
    switch (name) {
      case 'room':
        return { pos: new THREE.Vector3(2.55, 1.9, 1.95), target: new THREE.Vector3(-0.15, 1.0, -1.55), fov: aspect < 1 ? 70 : 46 };
      case 'shoulder':
        return { pos: new THREE.Vector3(0.55, 1.86, -0.2), target: new THREE.Vector3(0.1, 0.98, -2.2), fov: aspect < 1 ? 64 : 42 };
      case 'holo':
        return { pos: new THREE.Vector3(1.15, 1.74, -0.25), target: new THREE.Vector3(0.36, 1.42, -2.05), fov: aspect < 1 ? 72 : 50 };
      case 'screen':
        return this.screenShot();
      default:
        return this.baseSpec('room');
    }
  }

  /** Frame the monitor inside the area the HUD leaves free. */
  screenShot() {
    const { panelRight, top, bottom, panelBottom = 0 } = this.layout;
    const aspect = this.camera.aspect;
    const left = 0.02;
    const right = 1 - panelRight - 0.02;
    const topF = top + 0.02;
    const bottomF = 1 - bottom - panelBottom - 0.02;
    const availW = Math.max(0.3, right - left);
    const availH = Math.max(0.25, bottomF - topF);
    // view size (world units at the screen plane) needed to fit the monitor
    const needH = Math.max(SCREEN.height / availH, SCREEN.width / availW / aspect) * 1.04;
    let dist = 0.62;
    let fov = THREE.MathUtils.radToDeg(2 * Math.atan(needH / 2 / dist));
    if (fov > 78) {
      fov = 78;
      dist = needH / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    } else if (fov < 40) {
      fov = 40;
      dist = needH / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    }
    // Keep the camera square to the monitor and shift the lens instead, so the
    // monitor lands in the centre of the area the HUD leaves free.
    const shift = new THREE.Vector2(left + right - 1, 1 - (topF + bottomF));
    const c = SCREEN.center;
    return { pos: new THREE.Vector3(c.x, c.y, c.z + dist), target: c.clone(), fov, shift };
  }

  cut(name) {
    const spec = this.shotSpec(name);
    this.shot = name;
    this.current.pos.copy(spec.pos);
    this.current.target.copy(spec.target);
    this.current.fov = spec.fov;
    this.current.shift.copy(spec.shift);
    this.to = spec;
    this.progress = 1;
  }

  go(name, duration = 1.6) {
    if (name === 'free') return this.goFree();
    this.controls.enabled = false;
    this.shot = name;
    this.from = {
      pos: this.camera.position.clone(),
      target: this.current.target.clone(),
      fov: this.camera.fov,
      shift: this.current.shift.clone(),
    };
    this.to = this.shotSpec(name);
    this.progress = 0;
    this.duration = duration;
    this.onShotChange?.(name);
  }

  retarget() {
    this.to = this.shotSpec(this.shot);
    if (this.progress >= 1) {
      this.from = { pos: this.camera.position.clone(), target: this.current.target.clone(), fov: this.camera.fov, shift: this.current.shift.clone() };
      this.progress = 0;
      this.duration = 0.6;
    }
  }

  goFree() {
    if (this.shot === 'free') return;
    this.shot = 'free';
    this.controls.target.copy(this.current.target);
    this.controls.enabled = true;
    this.onShotChange?.('free');
  }

  update(dt, t) {
    const cam = this.camera;
    if (this.shot === 'free') {
      this.controls.update();
      this.current.target.copy(this.controls.target);
      this.current.fov += (50 - this.current.fov) * (1 - Math.exp(-dt * 2));
      this.current.shift.multiplyScalar(Math.exp(-dt * 3));
      cam.fov = this.current.fov;
      this.applyProjection();
      return;
    }
    if (this.progress < 1) {
      this.progress = Math.min(1, this.progress + dt / this.duration);
      const k = easeInOut(this.progress);
      this.current.pos.lerpVectors(this.from.pos, this.to.pos, k);
      this.current.target.lerpVectors(this.from.target, this.to.target, k);
      this.current.fov = this.from.fov + (this.to.fov - this.from.fov) * k;
      this.current.shift.lerpVectors(this.from.shift, this.to.shift, k);
    } else {
      this.current.pos.copy(this.to.pos);
      this.current.target.copy(this.to.target);
      this.current.fov = this.to.fov;
      this.current.shift.copy(this.to.shift);
    }
    // handheld drift + parallax, damped near the monitor so text stays readable
    const near = this.shot === 'screen' ? 0.15 : 1;
    this.parallaxSmooth.lerp(this.parallax, 1 - Math.exp(-dt * 3));
    const drift = new THREE.Vector3(Math.sin(t * 0.31) * 0.02, Math.sin(t * 0.43) * 0.012, Math.cos(t * 0.27) * 0.015).multiplyScalar(near);
    const par = new THREE.Vector3(-this.parallaxSmooth.x * 0.06, this.parallaxSmooth.y * 0.035, 0).multiplyScalar(near);
    if (this.orbitIntro) {
      const a = Math.sin(t * 0.12) * 0.35;
      const base = this.current.pos.clone().sub(this.current.target);
      base.applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      cam.position.copy(this.current.target).add(base);
    } else cam.position.copy(this.current.pos);
    cam.position.add(drift).add(par);
    cam.fov = this.current.fov;
    this.applyProjection();
    cam.lookAt(this.current.target);
  }

  /** Perspective projection + lens shift (in NDC units). */
  applyProjection() {
    const cam = this.camera;
    cam.updateProjectionMatrix();
    cam.projectionMatrix.elements[8] = -this.current.shift.x;
    cam.projectionMatrix.elements[9] = -this.current.shift.y;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  /** True when the camera is about to clip into the character's head. */
  nearHead(headPos) {
    // in the monitor shot the character would sit between the lens and the screen
    if (this.shot === 'screen' && this.progress > 0.6) return true;
    return this.camera.position.distanceTo(headPos) < HEAD_CLEARANCE;
  }
}
