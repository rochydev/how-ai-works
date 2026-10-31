import * as THREE from 'three';
import { showToken } from '../ai/tokenizer.js';
import { SCREEN } from './desk.js';
import { TOKEN_COLORS } from '../screen/draw.js';

const ORIGIN = new THREE.Vector3(0, 1.72, -2.12);
const MAX_TILES = 14;

function tileTexture(label, color) {
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 112;
  const g = c.getContext('2d');
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.beginPath();
  g.roundRect(8, 8, 304, 96, 18);
  g.stroke();
  g.fillStyle = color;
  g.globalAlpha = 0.22;
  g.fill();
  g.globalAlpha = 1;
  g.shadowBlur = 10;
  g.fillStyle = '#ffffff';
  g.font = "700 46px 'JetBrains Mono', monospace";
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label.length > 10 ? `${label.slice(0, 9)}…` : label, 160, 60);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function holoMaterial(map, color = '#ffffff', opacity = 1) {
  return new THREE.MeshBasicMaterial({
    map,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
}

/**
 * The hologram floating above the monitor. It mirrors what happens on the
 * screen in 3D: token tiles, attention arcs, the layer stack, and tokens
 * flying out while the answer streams.
 */
export function createHolo() {
  const group = new THREE.Group();
  group.name = 'holo';

  // projector beam rising from the top of the monitor
  const beamGeo = new THREE.CylinderGeometry(0.62, 0.42, 0.42, 48, 1, true);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform float uTime; uniform float uAlpha; varying vec2 vUv;
      void main(){
        float fade = smoothstep(1.0, 0.0, vUv.y) * 0.5;
        float lines = 0.6 + 0.4 * sin(vUv.y * 80.0 - uTime * 6.0);
        gl_FragColor = vec4(vec3(0.15, 0.85, 1.0) * lines, fade * uAlpha * 0.09);
      }`,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.scale.set(1, 1, 0.25);
  beam.position.set(0, SCREEN.center.y + SCREEN.height / 2 + 0.2, -2.18);
  group.add(beam);

  const tilesGroup = new THREE.Group();
  group.add(tilesGroup);
  const arcsGroup = new THREE.Group();
  group.add(arcsGroup);
  const layersGroup = new THREE.Group();
  group.add(layersGroup);
  const sparksGroup = new THREE.Group();
  group.add(sparksGroup);

  let tiles = [];
  let mode = null;
  let alpha = 0;
  let arcKey = '';
  let tokensKey = null;

  // ---- layer stack ---------------------------------------------------------
  const slabs = [];
  for (let i = 0; i < 6; i++) {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.012, 0.32),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(i % 2 ? '#ff4fd8' : '#25f4ee'),
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    slab.position.set(0, 1.5 + i * 0.085, -2.1);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(slab.geometry),
      new THREE.LineBasicMaterial({ color: slab.material.color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    slab.add(edges);
    layersGroup.add(slab);
    slabs.push(slab);
  }
  const P = 160;
  const pPos = new Float32Array(P * 3);
  const pCol = new Float32Array(P * 3);
  const pSeed = new Float32Array(P);
  for (let i = 0; i < P; i++) {
    pSeed[i] = Math.random();
    const c = new THREE.Color(TOKEN_COLORS[i % TOKEN_COLORS.length]);
    pCol.set([c.r * 2, c.g * 2, c.b * 2], i * 3);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const particles = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ size: 0.014, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  );
  layersGroup.add(particles);

  function buildTiles(tokens) {
    const key = tokens.map((t) => t.id).join(',');
    if (key === tokensKey) return;
    tokensKey = key;
    for (const t of tiles) {
      t.mesh.material.map.dispose();
      t.mesh.material.dispose();
      tilesGroup.remove(t.mesh);
    }
    const list = tokens.slice(-MAX_TILES);
    const n = list.length;
    const spread = Math.min(1.15, 0.13 * n);
    tiles = list.map((tok, i) => {
      const color = TOKEN_COLORS[i % TOKEN_COLORS.length];
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.0525), holoMaterial(tileTexture(showToken(tok.text), color)));
      const u = n > 1 ? i / (n - 1) - 0.5 : 0;
      const home = new THREE.Vector3(u * spread, ORIGIN.y + Math.cos(u * Math.PI) * 0.06, ORIGIN.z + 0.12 - Math.abs(u) * 0.25);
      mesh.position.copy(SCREEN.center);
      mesh.scale.setScalar(0.01);
      tilesGroup.add(mesh);
      return { mesh, home, delay: i * 0.08, born: 0 };
    });
    arcKey = '';
  }

  function buildArcs(weights, focus) {
    const key = `${focus}:${weights.length}:${weights[focus]?.join(',')}`;
    if (key === arcKey) return;
    arcKey = key;
    for (const c of [...arcsGroup.children]) {
      c.geometry.dispose();
      c.material.dispose();
      arcsGroup.remove(c);
    }
    if (focus == null || !tiles.length) return;
    const offset = weights.length - tiles.length;
    const fi = focus - offset;
    if (fi < 0 || fi >= tiles.length) return;
    const a = tiles[fi].home;
    for (let j = 0; j < fi; j++) {
      const w = weights[focus][j + offset];
      if (w < 0.03) continue;
      const b = tiles[j].home;
      const mid = a.clone().add(b).multiplyScalar(0.5);
      mid.y += 0.1 + a.distanceTo(b) * 0.35;
      const curve = new THREE.QuadraticBezierCurve3(a.clone().setY(a.y + 0.03), mid, b.clone().setY(b.y + 0.03));
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 32, 0.0015 + w * 0.009, 6, false),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color('#25f4ee').multiplyScalar(1 + w * 2.5),
          transparent: true,
          opacity: 0.25 + w * 0.75,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      tube.userData.w = w;
      arcsGroup.add(tube);
    }
  }

  const sparks = [];
  function spark(token, i) {
    const color = TOKEN_COLORS[i % TOKEN_COLORS.length];
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.042), holoMaterial(tileTexture(showToken(token.text), color)));
    mesh.position.set(SCREEN.center.x + (Math.random() - 0.5) * 0.4, SCREEN.center.y + 0.05, SCREEN.center.z + 0.02);
    sparksGroup.add(mesh);
    sparks.push({ mesh, life: 0, vel: new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.35 + Math.random() * 0.15, 0.12) });
  }

  return {
    group,
    setMode(m) {
      mode = m;
    },
    /** Called each frame with the shared state. */
    update(dt, t, s) {
      const p = s.pipeline;
      // fade out when the camera is glued to the monitor: it would only block the view
      const active = mode && p.prompt && s.shot !== 'screen';
      alpha += ((active ? 1 : 0) - alpha) * (1 - Math.exp(-dt * 3));
      beamMat.uniforms.uTime.value = t;
      beamMat.uniforms.uAlpha.value = alpha * (mode === 'stream' ? 0.6 : 1);
      group.visible = alpha > 0.01 || sparks.length > 0;

      const showTiles = mode === 'tokens' || mode === 'attention';
      if (showTiles) buildTiles(p.tokens);
      tiles.forEach((tile, i) => {
        tile.born += dt;
        const k = Math.min(1, Math.max(0, (tile.born - tile.delay) * 1.8));
        const target = showTiles ? tile.home : SCREEN.center;
        tile.mesh.position.lerp(target, 1 - Math.exp(-dt * (showTiles ? 4 * k : 6)));
        tile.mesh.position.y += Math.sin(t * 1.5 + i) * 0.0006;
        const sc = showTiles ? k : 0;
        tile.mesh.scale.setScalar(Math.max(0.001, THREE.MathUtils.lerp(tile.mesh.scale.x, sc, 1 - Math.exp(-dt * 6))));
        const focusIdx = s.focus != null ? s.focus - (p.tokens.length - tiles.length) : -1;
        tile.mesh.material.opacity = alpha * (mode === 'attention' && focusIdx >= 0 && focusIdx !== i ? 0.75 : 1);
        tile.mesh.lookAt(s.cameraPosition);
      });
      if (!showTiles && tiles.length && tiles.every((x) => x.mesh.scale.x < 0.02)) {
        tokensKey = null;
        buildTiles([]);
      }

      arcsGroup.visible = mode === 'attention';
      if (mode === 'attention') buildArcs(p.attention[s.head], s.focus);
      for (const c of arcsGroup.children) c.material.opacity = (0.25 + c.userData.w * 0.75) * alpha * (0.8 + 0.2 * Math.sin(t * 6));

      layersGroup.visible = mode === 'layers' && alpha > 0.01;
      if (layersGroup.visible) {
        const active = Math.floor(((t % 3.2) / 3.2) * 6);
        slabs.forEach((slab, i) => {
          slab.material.opacity = (i === active ? 0.45 : 0.12) * alpha;
          slab.children[0].material.opacity = (i === active ? 1 : 0.4) * alpha;
          slab.rotation.y = Math.sin(t * 0.4) * 0.15;
        });
        const arr = pGeo.attributes.position.array;
        for (let i = 0; i < P; i++) {
          const ph = (t * 0.3 + pSeed[i]) % 1;
          const lane = (i % 12) / 11 - 0.5;
          arr[i * 3] = lane * 0.85 + Math.sin(t + i) * 0.01;
          arr[i * 3 + 1] = 1.45 + ph * 0.55;
          arr[i * 3 + 2] = -2.1 + Math.sin(i * 1.7) * 0.1;
        }
        pGeo.attributes.position.needsUpdate = true;
        particles.material.opacity = alpha;
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.life += dt;
        sp.mesh.position.addScaledVector(sp.vel, dt);
        sp.vel.y -= dt * 0.08;
        sp.mesh.material.opacity = Math.max(0, 1 - sp.life / 1.6);
        sp.mesh.lookAt(s.cameraPosition);
        if (sp.life > 1.6) {
          sp.mesh.material.map.dispose();
          sp.mesh.material.dispose();
          sp.mesh.geometry.dispose();
          sparksGroup.remove(sp.mesh);
          sparks.splice(i, 1);
        }
      }
    },
    spark,
  };
}
