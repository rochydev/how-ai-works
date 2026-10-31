import * as THREE from 'three';
import { ROOM } from './room.js';
import { neonSignTexture, posterTexture, rugTexture, rng } from './textures.js';

/** Bed, shelves, plant, lava lamp, posters, neon sign and rug. */
export function createProps() {
  const group = new THREE.Group();
  group.name = 'props';
  const { w, d } = ROOM;
  const r = rng(42);
  const updaters = [];

  // ---- Neon sign -------------------------------------------------------
  const neon = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.43),
    new THREE.MeshBasicMaterial({
      map: neonSignTexture('hello, world', '</> tokens in · tokens out'),
      transparent: true,
      toneMapped: false,
      depthWrite: false,
    }),
  );
  neon.material.color.setScalar(1.35);
  neon.position.set(1.62, 1.92, -d / 2 + 0.02);
  group.add(neon);
  const neonLight = new THREE.PointLight('#ff4fd8', 1.6, 2.2, 1.8);
  neonLight.position.set(1.62, 1.9, -2.2);
  group.add(neonLight);
  updaters.push((dt, t) => {
    // occasional neon flicker
    const flicker = Math.sin(t * 37) > 0.995 || (t % 11 > 10.85 && Math.sin(t * 90) > 0);
    neon.material.color.setScalar(flicker ? 0.5 : 1.35);
    neonLight.intensity = flicker ? 0.4 : 1.6;
  });

  // ---- Posters ---------------------------------------------------------
  const poster = (kind, pos, rotY, scale = 1) => {
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5 * scale, 0.7 * scale),
      new THREE.MeshStandardMaterial({ map: posterTexture(kind), roughness: 0.7 }),
    );
    p.position.copy(pos);
    p.rotation.y = rotY;
    group.add(p);
  };
  poster('attention', new THREE.Vector3(-1.72, 1.62, -d / 2 + 0.012), 0, 0.95);
  poster('synth', new THREE.Vector3(-w / 2 + 0.012, 1.55, -1.85), Math.PI / 2, 1.05);
  poster('binary', new THREE.Vector3(-w / 2 + 0.012, 1.5, 0.75), Math.PI / 2, 0.9);

  // ---- Rug -------------------------------------------------------------
  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 48),
    new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.05, 0.004, -1.0);
  rug.receiveShadow = true;
  group.add(rug);

  // ---- Bed -------------------------------------------------------------
  const bed = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: '#1b1828', roughness: 0.6 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.22, 2.0), frameMat);
  frame.position.y = 0.13;
  bed.add(frame);
  const mattress = new THREE.Mesh(
    new THREE.BoxGeometry(0.96, 0.16, 1.96),
    new THREE.MeshStandardMaterial({ color: '#d8d4e8', roughness: 0.9 }),
  );
  mattress.position.y = 0.32;
  bed.add(mattress);
  const blanketGeo = new THREE.BoxGeometry(1.02, 0.06, 1.35, 12, 1, 12);
  const bp = blanketGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    bp.setY(i, bp.getY(i) + Math.sin(bp.getX(i) * 9) * 0.012 + Math.cos(bp.getZ(i) * 7) * 0.012);
  }
  blanketGeo.computeVertexNormals();
  const blanket = new THREE.Mesh(blanketGeo, new THREE.MeshStandardMaterial({ color: '#3b2470', roughness: 0.95 }));
  blanket.position.set(0, 0.42, 0.3);
  bed.add(blanket);
  for (const x of [-0.24, 0.24]) {
    const pillow = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.08, 0.28, 6, 12),
      new THREE.MeshStandardMaterial({ color: '#efeaff', roughness: 0.9 }),
    );
    pillow.rotation.z = Math.PI / 2;
    pillow.scale.set(1, 1, 0.55);
    pillow.position.set(x, 0.46, -0.78);
    bed.add(pillow);
  }
  const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.7, 0.06), frameMat);
  headboard.position.set(0, 0.45, -1.0);
  bed.add(headboard);
  bed.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  bed.position.set(w / 2 - 0.52, 0, 0.85);
  group.add(bed);

  // ---- Nightstand + lava lamp -----------------------------------------
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.4), frameMat);
  stand.position.set(w / 2 - 0.25, 0.25, -0.45);
  stand.castShadow = true;
  group.add(stand);
  const lava = createLavaLamp();
  lava.group.position.set(w / 2 - 0.25, 0.5, -0.45);
  group.add(lava.group);
  updaters.push(lava.update);

  // ---- Shelves ---------------------------------------------------------
  const shelfMat = new THREE.MeshStandardMaterial({ color: '#2a1d18', roughness: 0.6 });
  const shelf = (pos, rotY, len) => {
    const s = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(len, 0.025, 0.2), shelfMat);
    board.castShadow = board.receiveShadow = true;
    s.add(board);
    let x = -len / 2 + 0.04;
    while (x < len / 2 - 0.15) {
      if (r() < 0.15) {
        x += 0.08;
        continue;
      }
      const bh = 0.16 + r() * 0.1;
      const bw = 0.025 + r() * 0.025;
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, 0.15),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.6 + r() * 0.45, 0.45, 0.25 + r() * 0.2),
          roughness: 0.8,
        }),
      );
      book.position.set(x + bw / 2, bh / 2 + 0.012, 0);
      if (r() < 0.1) book.rotation.z = 0.25;
      book.castShadow = true;
      s.add(book);
      x += bw + 0.004;
    }
    // little glowing cube "AI" figure at the end
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.07, 0.07),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.2, 2.4), toneMapped: false, wireframe: true }),
    );
    cube.position.set(len / 2 - 0.08, 0.06, 0);
    s.add(cube);
    updaters.push((dt) => {
      cube.rotation.y += dt * 0.6;
      cube.rotation.x += dt * 0.3;
    });
    s.position.copy(pos);
    s.rotation.y = rotY;
    group.add(s);
  };
  shelf(new THREE.Vector3(w / 2 - 0.11, 1.45, 0.75), -Math.PI / 2, 1.1);
  shelf(new THREE.Vector3(w / 2 - 0.11, 1.85, 0.75), -Math.PI / 2, 1.1);
  shelf(new THREE.Vector3(-1.45, 2.12, -d / 2 + 0.11), 0, 0.85);

  // ---- Plant -----------------------------------------------------------
  const plant = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.12, 0.32, 20),
    new THREE.MeshStandardMaterial({ color: '#1d1b2e', roughness: 0.5 }),
  );
  pot.position.y = 0.16;
  plant.add(pot);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#1f6b4a', roughness: 0.7, side: THREE.DoubleSide });
  const leaves = [];
  for (let i = 0; i < 16; i++) {
    const leafGeo = new THREE.PlaneGeometry(0.12, 0.5, 1, 6);
    const lp = leafGeo.attributes.position;
    for (let j = 0; j < lp.count; j++) {
      const y = lp.getY(j) + 0.25;
      lp.setZ(j, y * y * 0.6);
      lp.setX(j, lp.getX(j) * Math.sin(((y + 0.02) / 0.52) * Math.PI));
    }
    leafGeo.translate(0, 0.25, 0);
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    const pivot = new THREE.Group();
    pivot.position.y = 0.3;
    pivot.rotation.y = (i / 16) * Math.PI * 2 + r();
    leaf.rotation.x = -0.25 - r() * 0.5;
    leaf.scale.setScalar(0.8 + r() * 0.6);
    leaf.castShadow = true;
    pivot.add(leaf);
    plant.add(pivot);
    leaves.push({ leaf, base: leaf.rotation.x, ph: r() * 6 });
  }
  plant.position.set(-1.35, 0, -2.05);
  group.add(plant);
  updaters.push((dt, t) => {
    for (const l of leaves) l.leaf.rotation.x = l.base + Math.sin(t * 0.8 + l.ph) * 0.03;
  });

  // ---- Floor gamer stuff: subwoofer-ish speaker with glowing ring --------
  const speaker = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.32, 0.28),
    new THREE.MeshStandardMaterial({ color: '#111018', roughness: 0.5 }),
  );
  speaker.position.set(-0.7, 0.16, -2.15);
  speaker.castShadow = true;
  group.add(speaker);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.08, 0.006, 8, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.5, 2.0), toneMapped: false }),
  );
  ring.position.set(-0.7, 0.17, -2.009);
  group.add(ring);

  return {
    group,
    update(dt, t) {
      for (const fn of updaters) fn(dt, t);
    },
  };
}

function createLavaLamp() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#8a8aa0', metalness: 0.9, roughness: 0.25 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.07, 0.12, 20), metal);
  base.position.y = 0.06;
  group.add(base);
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.06, 0.26, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2e88').multiplyScalar(0.55), transparent: true, opacity: 0.55 }),
  );
  glass.position.y = 0.25;
  group.add(glass);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.06, 20), metal);
  cap.position.y = 0.41;
  group.add(cap);
  const blobMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.9, 0.3), toneMapped: false });
  const blobs = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.015 + i * 0.003, 12, 10), blobMat);
    group.add(b);
    blobs.push({ b, ph: i * 1.7, sp: 0.25 + i * 0.07 });
  }
  const light = new THREE.PointLight('#ff6a3d', 1.2, 1.6, 2);
  light.position.y = 0.3;
  group.add(light);
  return {
    group,
    update(dt, t) {
      for (const { b, ph, sp } of blobs) {
        const y = 0.14 + (0.5 + 0.5 * Math.sin(t * sp + ph)) * 0.2;
        b.position.set(Math.sin(t * 0.7 + ph) * 0.012, y, Math.cos(t * 0.5 + ph) * 0.012);
        b.scale.y = 1 + Math.sin(t * 1.3 + ph) * 0.25;
      }
      light.intensity = 1.0 + Math.sin(t * 1.7) * 0.2;
    },
  };
}
