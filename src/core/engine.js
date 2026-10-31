import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Owns the renderer, the post-processing chain and the main loop.
 * Systems register an `update(dt, elapsed)` callback through `onUpdate`.
 */
export class Engine {
  constructor(container) {
    this.container = container;
    this.updaters = [];
    this.clock = new THREE.Clock();
    this.elapsed = 0;

    const lowPower = matchMedia('(max-width: 760px)').matches;
    this.quality = lowPower ? 'low' : 'high';

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // needed for screenshots / captures
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#05040b');
    this.scene.fog = new THREE.FogExp2('#08061a', 0.045);

    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.03, 60);
    this.camera.position.set(2.6, 1.9, 2.2);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.85, // strength
      0.55, // radius
      0.82, // threshold
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  onUpdate(fn) {
    this.updaters.push(fn);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  start() {
    const loop = () => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.elapsed += dt;
      for (const fn of this.updaters) fn(dt, this.elapsed);
      this.composer.render();
      requestAnimationFrame(loop);
    };
    loop();
  }
}
