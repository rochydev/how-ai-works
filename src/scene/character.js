import * as THREE from 'three';

/**
 * Procedural seated character + gaming chair.
 * Arms and legs are driven by an analytic two-bone IK so the hands can
 * land on the exact key being typed.
 */

const UP = new THREE.Vector3(0, 1, 0);

/** A cylinder that can be stretched between two points every frame. */
function bone(radiusTop, radiusBottom, material) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, 1, 14, 1);
  geo.translate(0, 0.5, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  const dir = new THREE.Vector3();
  mesh.span = (a, b) => {
    dir.subVectors(b, a);
    const len = dir.length();
    mesh.position.copy(a);
    mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
    mesh.scale.set(1, len, 1);
  };
  return mesh;
}

function joint(r, material) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), material);
  m.castShadow = true;
  return m;
}

/** Two-bone IK: returns the elbow/knee position. */
function solveIK(root, target, a, b, pole, out) {
  const toT = new THREE.Vector3().subVectors(target, root);
  const d = Math.min(toT.length(), a + b - 1e-3);
  const dir = toT.normalize();
  const cosA = THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  const n = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  return out.copy(root).addScaledVector(dir, a * cosA).addScaledVector(n, a * sinA);
}

export function createCharacter({ keyboard, mousePosition, screenCenter }) {
  const root = new THREE.Group();
  root.name = 'character';
  root.position.set(0, 0, -1.38);

  const mats = {
    hoodie: new THREE.MeshStandardMaterial({ color: '#2a2342', roughness: 0.85 }),
    hoodieDark: new THREE.MeshStandardMaterial({ color: '#1e1931', roughness: 0.9 }),
    skin: new THREE.MeshStandardMaterial({ color: '#d9a88c', roughness: 0.6 }),
    hair: new THREE.MeshStandardMaterial({ color: '#17111a', roughness: 0.7 }),
    pants: new THREE.MeshStandardMaterial({ color: '#1b2236', roughness: 0.8 }),
    shoe: new THREE.MeshStandardMaterial({ color: '#e7e5f0', roughness: 0.5 }),
    black: new THREE.MeshStandardMaterial({ color: '#0d0d12', roughness: 0.35, metalness: 0.4 }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.5, 1.5), toneMapped: false }),
    accent: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.25, 1.3), toneMapped: false }),
  };

  // ---- Chair -------------------------------------------------------------
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.09, 0.5), mats.black);
  seat.position.set(0, 0.44, 0.02);
  chair.add(seat);
  const backrest = new THREE.Group();
  const backPad = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.72, 0.09), mats.black);
  backPad.position.y = 0.36;
  backrest.add(backPad);
  for (const sx of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.66, 0.002), mats.accent);
    stripe.position.set(sx * 0.17, 0.36, 0.046);
    backrest.add(stripe);
  }
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.06), mats.hoodieDark);
  pillow.position.set(0, 0.64, -0.06);
  backrest.add(pillow);
  backrest.position.set(0, 0.48, 0.25);
  backrest.rotation.x = 0.12;
  chair.add(backrest);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.28), mats.black);
    arm.position.set(sx * 0.29, 0.66, -0.02);
    chair.add(arm);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.04), mats.black);
    post.position.set(sx * 0.29, 0.55, 0.05);
    chair.add(post);
  }
  const gas = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.32, 12), mats.black);
  gas.position.y = 0.24;
  chair.add(gas);
  for (let i = 0; i < 5; i++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.3), mats.black);
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 5) * Math.PI * 2;
    leg.position.set(0, 0.07, 0.15);
    pivot.add(leg);
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), mats.black);
    wheel.position.set(0, 0.03, 0.29);
    pivot.add(wheel);
    chair.add(pivot);
  }
  chair.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  root.add(chair);

  // ---- Body ------------------------------------------------------------
  const body = new THREE.Group();
  root.add(body);

  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), mats.pants);
  pelvis.scale.set(1.15, 0.6, 1);
  pelvis.position.set(0, 0.56, 0.03);
  pelvis.castShadow = true;
  body.add(pelvis);

  const spine = new THREE.Group(); // pivots at the hips, leans the upper body
  spine.position.set(0, 0.56, 0.03);
  body.add(spine);
  const torsoGeo = new THREE.CapsuleGeometry(0.15, 0.26, 8, 16);
  const torso = new THREE.Mesh(torsoGeo, mats.hoodie);
  torso.scale.set(1.2, 1, 0.8);
  torso.position.y = 0.22;
  torso.castShadow = true;
  spine.add(torso);
  const hood = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.04, 10, 20), mats.hoodieDark);
  hood.position.set(0, 0.44, 0.06);
  hood.rotation.x = Math.PI / 2 + 0.5;
  hood.castShadow = true;
  spine.add(hood);
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.02), mats.hoodieDark);
  pocket.position.set(0, 0.12, -0.12);
  spine.add(pocket);

  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 0.47, 0);
  spine.add(neckPivot);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 12), mats.skin);
  neck.position.y = 0.03;
  neckPivot.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.15;
  neckPivot.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 18), mats.skin);
  skull.scale.set(0.92, 1.05, 1);
  skull.castShadow = true;
  head.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.108, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), mats.hair);
  hair.scale.set(0.95, 1.05, 1.05);
  hair.position.set(0, 0.012, 0.012);
  hair.rotation.x = 0.35;
  head.add(hair);
  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), mats.hair);
  fringe.scale.set(1.5, 0.5, 0.8);
  fringe.position.set(0.02, 0.07, -0.07);
  head.add(fringe);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.035, 8), mats.skin);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, -0.01, -0.1);
  head.add(nose);
  // glasses — pick up the screen glow
  const lensMat = new THREE.MeshStandardMaterial({ color: '#9fb7ff', metalness: 1, roughness: 0.05, transparent: true, opacity: 0.55 });
  for (const sx of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 18), lensMat);
    lens.position.set(sx * 0.037, 0.012, -0.098);
    lens.rotation.y = Math.PI;
    head.add(lens);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.003, 6, 18), mats.black);
    rim.position.copy(lens.position);
    head.add(rim);
  }
  // headphones
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.012, 8, 24, Math.PI), mats.black);
  band.position.y = 0.01;
  band.rotation.y = 0;
  head.add(band);
  for (const sx of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 20), mats.black);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(sx * 0.105, -0.005, 0.005);
    head.add(cup);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.005, 8, 24), mats.led);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(sx * 0.124, -0.005, 0.005);
    head.add(ring);
  }

  // ---- Arms --------------------------------------------------------------
  const UPPER = 0.29;
  const FORE = 0.27;
  const arms = [-1, 1].map((side) => {
    const upper = bone(0.048, 0.04, mats.hoodie);
    const fore = bone(0.04, 0.034, mats.hoodie);
    const shoulder = joint(0.056, mats.hoodie);
    const elbow = joint(0.042, mats.hoodie);
    const cuff = joint(0.036, mats.hoodieDark);
    const hand = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.04, 6, 10), mats.skin);
    palm.rotation.x = Math.PI / 2;
    palm.scale.set(1.15, 1, 0.55);
    palm.position.z = -0.035;
    palm.castShadow = true;
    hand.add(palm);
    const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.035), mats.skin);
    fingers.position.set(0, -0.006, -0.075);
    fingers.rotation.x = 0.35;
    hand.add(fingers);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.025, 4, 6), mats.skin);
    thumb.rotation.set(Math.PI / 2, 0, -side * 0.6);
    thumb.position.set(-side * 0.025, -0.002, -0.05);
    hand.add(thumb);
    body.add(upper, fore, shoulder, elbow, cuff, hand);
    return {
      side,
      upper,
      fore,
      shoulder,
      elbow,
      cuff,
      hand,
      target: new THREE.Vector3(),
      goal: new THREE.Vector3(),
      press: 0,
      lastKey: 0,
    };
  });

  // ---- Legs --------------------------------------------------------------
  const legs = [-1, 1].map((side) => {
    const thigh = bone(0.07, 0.058, mats.pants);
    const shin = bone(0.055, 0.045, mats.pants);
    const knee = joint(0.058, mats.pants);
    const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.1, 6, 10), mats.shoe);
    shoe.rotation.x = Math.PI / 2;
    shoe.scale.set(1, 1, 0.6);
    shoe.castShadow = true;
    body.add(thigh, shin, knee, shoe);
    return { side, thigh, shin, knee, shoe };
  });

  // ---- State ---------------------------------------------------------------
  const state = {
    pose: 'idle', // idle | type | read
    typingEnergy: 0,
    lean: 0.22,
    lookAt: new THREE.Vector3().copy(screenCenter),
    nod: 0,
  };
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const shoulderW = new THREE.Vector3();
  const elbowP = new THREE.Vector3();
  const pole = new THREE.Vector3();
  const homeKeys = { [-1]: 'f', [1]: 'j' };

  root.updateMatrixWorld(true);

  function restTarget(arm, out) {
    if (state.pose === 'read' && arm.side === 1) {
      return root.worldToLocal(out.copy(mousePosition).add(new THREE.Vector3(0, 0.035, 0.035)));
    }
    keyboard.keyWorldPosition(homeKeys[arm.side], out);
    out.y += 0.015;
    return root.worldToLocal(out);
  }

  const api = {
    root,
    /** Animate a key stroke: picks the hand by keyboard half. */
    type(ch) {
      keyboard.keyWorldPosition(ch, tmp);
      const local = root.worldToLocal(tmp.clone());
      const arm = local.x < 0.005 ? arms[0] : arms[1];
      arm.goal.copy(local);
      arm.press = 1;
      arm.lastKey = performance.now();
      keyboard.press(ch);
      state.typingEnergy = 1;
      if (state.pose !== 'type') state.pose = 'type';
    },
    setPose(pose) {
      state.pose = pose;
    },
    nod() {
      state.nod = 1;
    },
    headWorldPosition(target = new THREE.Vector3()) {
      return head.getWorldPosition(target);
    },
  };

  arms.forEach((arm) => {
    restTarget(arm, arm.goal);
    arm.target.copy(arm.goal);
  });

  api.update = (dt, t) => {
    state.typingEnergy = Math.max(0, state.typingEnergy - dt * 0.8);
    if (state.pose === 'type' && state.typingEnergy <= 0) state.pose = 'idle';

    // Upper body lean + breathing
    const leanGoal = state.pose === 'read' ? 0.05 : state.pose === 'type' ? 0.3 : 0.2;
    state.lean += (leanGoal - state.lean) * (1 - Math.exp(-dt * 2));
    const breathe = Math.sin(t * 1.6) * 0.012;
    spine.rotation.x = -state.lean + breathe * 0.5;
    spine.rotation.y = Math.sin(t * 0.3) * 0.02;
    torso.scale.x = 1.2 + breathe;

    // Head looks at screen; when reading, eyes scan left → right
    const scan = state.pose === 'read' ? Math.sin(t * 1.4) * 0.18 : Math.sin(t * 0.5) * 0.04;
    state.nod = Math.max(0, state.nod - dt * 1.5);
    tmp.copy(screenCenter);
    tmp.x += scan;
    root.updateMatrixWorld(true);
    neckPivot.updateWorldMatrix(true, false);
    const neckW = neckPivot.getWorldPosition(tmp2);
    const yaw = Math.atan2(-(tmp.x - neckW.x), -(tmp.z - neckW.z));
    const pitch = Math.atan2(tmp.y - neckW.y - 0.12, Math.hypot(tmp.x - neckW.x, tmp.z - neckW.z));
    neckPivot.rotation.y += (yaw - neckPivot.rotation.y) * (1 - Math.exp(-dt * 4));
    const nodOffset = Math.sin(state.nod * Math.PI * 3) * 0.12 * state.nod;
    neckPivot.rotation.x = state.lean * 0.9 + pitch * 0.7 + nodOffset + (state.pose === 'type' ? -0.08 : 0);

    // Arms
    spine.updateWorldMatrix(true, true);
    arms.forEach((arm) => {
      const idleFor = (performance.now() - arm.lastKey) / 1000;
      if (idleFor > 0.35) restTarget(arm, arm.goal);
      arm.press = Math.max(0, arm.press - dt * 9);
      const k = 1 - Math.exp(-dt * (state.pose === 'type' ? 28 : 6));
      arm.target.lerp(arm.goal, k);

      // hand hover + key press dip
      tmp.copy(arm.target);
      tmp.y += 0.03 - Math.sin(arm.press * Math.PI) * 0.025;
      if (state.pose === 'idle') tmp.y += Math.sin(t * 2 + arm.side) * 0.003;

      // shoulders follow the spine
      shoulderW.set(arm.side * 0.19, 0.4, 0.0);
      spine.localToWorld(shoulderW);
      root.worldToLocal(shoulderW);

      pole.set(arm.side * 0.9, -0.6, 0.5).normalize();
      solveIK(shoulderW, tmp, UPPER, FORE, pole, elbowP);
      arm.upper.span(shoulderW, elbowP);
      arm.fore.span(elbowP, tmp);
      arm.shoulder.position.copy(shoulderW);
      arm.elbow.position.copy(elbowP);
      arm.cuff.position.copy(tmp);

      // hand orientation: continue the forearm, flattened toward the desk
      arm.hand.position.copy(tmp);
      tmp2.subVectors(tmp, elbowP);
      tmp2.y *= 0.2;
      arm.hand.rotation.set(-0.15, Math.atan2(-tmp2.x, -tmp2.z), 0);
    });

    // Legs — fixed feet, knees solved for a natural bend
    legs.forEach((leg) => {
      const hip = tmp.set(leg.side * 0.09, 0.56, 0.02);
      const foot = tmp2.set(leg.side * 0.13, 0.08, -0.46 + Math.sin(t * 0.4 + leg.side) * 0.01);
      pole.set(leg.side * 0.15, 1, -0.6).normalize();
      solveIK(hip, foot, 0.44, 0.48, pole, elbowP);
      leg.thigh.span(hip, elbowP);
      leg.shin.span(elbowP, foot);
      leg.knee.position.copy(elbowP);
      leg.shoe.position.set(foot.x, 0.045, foot.z - 0.05);
    });
  };

  return api;
}
