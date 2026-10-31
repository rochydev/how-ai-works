import * as THREE from 'three';
import { woodFloorTexture, wallTexture, skylineTexture, rainTexture } from './textures.js';

export const ROOM = { w: 6, h: 2.9, d: 5 };

/**
 * Walls, floor, ceiling, the window with the night city and the
 * base lighting (moonlight + soft hemisphere fill).
 */
export function createRoom() {
  const group = new THREE.Group();
  group.name = 'room';
  const { w, h, d } = ROOM;

  const floorMat = new THREE.MeshStandardMaterial({
    map: woodFloorTexture(),
    roughness: 0.55,
    metalness: 0.05,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.92 });
  const addWall = (width, height, pos, rotY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    m.position.copy(pos);
    m.rotation.y = rotY;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  addWall(w, h, new THREE.Vector3(0, h / 2, -d / 2), 0); // back
  addWall(w, h, new THREE.Vector3(0, h / 2, d / 2), Math.PI); // front
  addWall(d, h, new THREE.Vector3(-w / 2, h / 2, 0), Math.PI / 2); // left (window)
  addWall(d, h, new THREE.Vector3(w / 2, h / 2, 0), -Math.PI / 2); // right

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: '#0c0b18', roughness: 1 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = h;
  group.add(ceiling);

  // Skirting boards
  const skirtMat = new THREE.MeshStandardMaterial({ color: '#0d0c1a', roughness: 0.6 });
  const skirt = (len, pos, rotY) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.015), skirtMat);
    m.position.copy(pos);
    m.rotation.y = rotY;
    group.add(m);
  };
  skirt(w, new THREE.Vector3(0, 0.04, -d / 2 + 0.008), 0);
  skirt(d, new THREE.Vector3(-w / 2 + 0.008, 0.04, 0), Math.PI / 2);
  skirt(d, new THREE.Vector3(w / 2 - 0.008, 0.04, 0), Math.PI / 2);

  const win = createWindow();
  win.group.position.set(-w / 2 + 0.01, 1.55, -0.55);
  win.group.rotation.y = Math.PI / 2;
  group.add(win.group);

  // ---- Lighting -------------------------------------------------------
  const hemi = new THREE.HemisphereLight('#4b3a8c', '#07050d', 0.55);
  group.add(hemi);

  const moon = new THREE.SpotLight('#8e9bff', 55, 12, Math.PI / 6, 0.6, 1.6);
  moon.position.set(-5.2, 2.7, -0.55);
  moon.target.position.set(0.4, 0, -0.4);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.bias = -0.0004;
  moon.shadow.radius = 4;
  group.add(moon, moon.target);

  return {
    group,
    update(dt, t) {
      win.update(dt, t);
    },
  };
}

function createWindow() {
  const group = new THREE.Group();
  const ww = 1.35;
  const wh = 1.1;

  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(ww, wh),
    new THREE.MeshBasicMaterial({ map: skylineTexture(), toneMapped: false }),
  );
  sky.material.color.setScalar(0.95);
  group.add(sky);

  const rainTex = rainTexture();
  const rain = new THREE.Mesh(
    new THREE.PlaneGeometry(ww, wh),
    new THREE.MeshBasicMaterial({ map: rainTex, transparent: true, depthWrite: false }),
  );
  rain.position.z = 0.005;
  group.add(rain);

  const frameMat = new THREE.MeshStandardMaterial({ color: '#191829', roughness: 0.4, metalness: 0.3 });
  const bar = (bw, bh, x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.06), frameMat);
    m.position.set(x, y, 0.02);
    group.add(m);
  };
  const t = 0.05;
  bar(ww + t * 2, t, 0, wh / 2 + t / 2);
  bar(ww + t * 2, t, 0, -wh / 2 - t / 2);
  bar(t, wh, -ww / 2 - t / 2, 0);
  bar(t, wh, ww / 2 + t / 2, 0);
  bar(0.03, wh, 0, 0);
  bar(ww, 0.03, 0, 0.12);

  const sill = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.25, 0.04, 0.2), frameMat);
  sill.position.set(0, -wh / 2 - 0.07, 0.08);
  group.add(sill);

  // Curtains: wavy planes on both sides
  const curtainMat = new THREE.MeshStandardMaterial({
    color: '#2a1747',
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  for (const side of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(0.42, 1.75, 24, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, Math.sin(pos.getX(i) * 38) * 0.03);
    }
    geo.computeVertexNormals();
    const c = new THREE.Mesh(geo, curtainMat);
    c.position.set(side * (ww / 2 + 0.22), -0.12, 0.08);
    c.castShadow = true;
    group.add(c);
  }
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, ww + 1.0),
    new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.9, roughness: 0.3 }),
  );
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, wh / 2 + 0.2, 0.1);
  group.add(rod);

  return {
    group,
    update(dt) {
      rainTex.offset.y += dt * 0.9;
      rainTex.offset.x -= dt * 0.02;
    },
  };
}
