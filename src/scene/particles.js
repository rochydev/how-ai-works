import * as THREE from 'three';
import { rng } from './textures.js';

function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Floating dust in the light and steam rising from the mug. */
export function createParticles({ mugTop }) {
  const group = new THREE.Group();
  const r = rng(99);
  const dot = softDot();

  const N = 420;
  const pos = new Float32Array(N * 3);
  const seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (r() - 0.5) * 5.6;
    pos[i * 3 + 1] = r() * 2.8;
    pos[i * 3 + 2] = (r() - 0.5) * 4.6;
    seeds[i] = r() * 100;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      size: 0.012,
      map: dot,
      color: '#c9c2ff',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(dust);

  const S = 26;
  const steam = [];
  const steamMat = new THREE.SpriteMaterial({
    map: dot,
    color: '#ffffff',
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  for (let i = 0; i < S; i++) {
    const s = new THREE.Sprite(steamMat.clone());
    s.userData.life = r();
    s.userData.drift = (r() - 0.5) * 0.02;
    group.add(s);
    steam.push(s);
  }

  return {
    group,
    update(dt, t) {
      const p = dustGeo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const k = seeds[i];
        p[i * 3] += Math.sin(t * 0.13 + k) * dt * 0.02;
        p[i * 3 + 1] += Math.sin(t * 0.21 + k * 2) * dt * 0.015 - dt * 0.004;
        p[i * 3 + 2] += Math.cos(t * 0.17 + k) * dt * 0.02;
        if (p[i * 3 + 1] < 0) p[i * 3 + 1] = 2.8;
        // keep the air in front of the monitor clear: the close-up camera lives there
        if (Math.abs(p[i * 3]) < 0.75 && p[i * 3 + 1] > 0.8 && p[i * 3 + 1] < 1.7 && p[i * 3 + 2] < -1.2 && p[i * 3 + 2] > -2.3) {
          p[i * 3 + 2] = -1.2;
        }
      }
      dustGeo.attributes.position.needsUpdate = true;

      for (const s of steam) {
        s.userData.life += dt * 0.35;
        if (s.userData.life > 1) s.userData.life -= 1;
        const l = s.userData.life;
        s.position.set(
          mugTop.x + Math.sin(l * 6 + t) * 0.012 + s.userData.drift * l * 4,
          mugTop.y + l * 0.22,
          mugTop.z + Math.cos(l * 5 + t) * 0.01,
        );
        s.scale.setScalar(0.03 + l * 0.07);
        s.material.opacity = Math.sin(l * Math.PI) * 0.1;
      }
    },
  };
}
