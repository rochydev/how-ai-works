import * as THREE from 'three';
import { ROOM } from './room.js';

const MOODS = {
  idle: { a: '#b26bff', b: '#25f4ee', speed: 0.18, gain: 2.4 },
  typing: { a: '#ff4fd8', b: '#b26bff', speed: 0.45, gain: 2.8 },
  thinking: { a: '#25f4ee', b: '#5b6bff', speed: 1.1, gain: 3.2 },
  answer: { a: '#ffb547', b: '#ff4fd8', speed: 0.35, gain: 2.8 },
};

const stripVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const stripFragment = /* glsl */ `
  uniform float uTime;
  uniform float uLength;
  uniform float uOffset;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uGain;
  uniform float uPulse;
  varying vec2 vUv;
  void main() {
    float x = vUv.x * uLength + uOffset;
    float wave = 0.5 + 0.5 * sin(x * 1.6 - uTime * 2.0);
    vec3 col = mix(uColorA, uColorB, wave);
    // little "chasing" highlight along the strip
    float chase = smoothstep(0.92, 1.0, sin(x * 0.8 - uTime * 3.0));
    col += chase * 0.6;
    gl_FragColor = vec4(col * (uGain + uPulse), 1.0);
  }
`;

/**
 * RGB LED strips (ceiling cove, desk, bed) with real point lights that
 * follow the strip colours so the walls get washed in neon.
 */
export function createLeds() {
  const group = new THREE.Group();
  group.name = 'leds';
  const uniforms = {
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color(MOODS.idle.a) },
    uColorB: { value: new THREE.Color(MOODS.idle.b) },
    uGain: { value: MOODS.idle.gain },
    uPulse: { value: 0 },
  };
  const materials = [];

  const strip = (length, pos, rotY, offset = 0) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uLength: { value: length }, uOffset: { value: offset } },
      vertexShader: stripVertex,
      fragmentShader: stripFragment,
      toneMapped: false,
    });
    materials.push(mat);
    const m = new THREE.Mesh(new THREE.BoxGeometry(length, 0.018, 0.018), mat);
    m.position.copy(pos);
    m.rotation.y = rotY;
    group.add(m);
    return m;
  };

  const { w, h, d } = ROOM;
  const y = h - 0.05;
  // Ceiling cove — offsets chain the gradient around the room
  strip(w - 0.1, new THREE.Vector3(0, y, -d / 2 + 0.04), 0, 0);
  strip(d - 0.1, new THREE.Vector3(w / 2 - 0.04, y, 0), -Math.PI / 2, w);
  strip(w - 0.1, new THREE.Vector3(0, y, d / 2 - 0.04), Math.PI, w + d);
  strip(d - 0.1, new THREE.Vector3(-w / 2 + 0.04, y, 0), Math.PI / 2, 2 * w + d);
  // Behind the desk, washing the back wall
  strip(1.9, new THREE.Vector3(0, 0.72, -d / 2 + 0.05), 0, 3);
  // Under the bed
  strip(1.9, new THREE.Vector3(w / 2 - 1.02, 0.06, 0.9), Math.PI / 2, 6);

  // Real lights that pick up the strip colours
  const lights = [
    { l: new THREE.PointLight('#b26bff', 5, 4.5, 1.6), p: [-1.9, 2.55, -2.1], k: 0 },
    { l: new THREE.PointLight('#25f4ee', 5, 4.5, 1.6), p: [1.9, 2.55, -2.1], k: 1 },
    { l: new THREE.PointLight('#ff4fd8', 4, 2.6, 1.6), p: [0, 0.95, -2.35], k: 0.5 },
    { l: new THREE.PointLight('#25f4ee', 3, 3.2, 1.6), p: [2.5, 0.35, 0.9], k: 0.8 },
    { l: new THREE.PointLight('#b26bff', 3, 4.0, 1.6), p: [-1.2, 2.55, 1.8], k: 0.3 },
  ];
  for (const { l, p } of lights) {
    l.position.set(...p);
    group.add(l);
  }

  let mood = MOODS.idle;
  const target = { a: new THREE.Color(mood.a), b: new THREE.Color(mood.b) };
  const tmp = new THREE.Color();
  let pulse = 0;
  let phase = 0;

  return {
    group,
    setMood(name) {
      mood = MOODS[name] || MOODS.idle;
      target.a.set(mood.a);
      target.b.set(mood.b);
    },
    pulse(amount = 1.2) {
      pulse = Math.min(pulse + amount, 2.5);
    },
    update(dt) {
      phase += dt * mood.speed * 4;
      const k = 1 - Math.exp(-dt * 2.5);
      uniforms.uColorA.value.lerp(target.a, k);
      uniforms.uColorB.value.lerp(target.b, k);
      uniforms.uGain.value += (mood.gain - uniforms.uGain.value) * k;
      pulse *= Math.exp(-dt * 6);
      for (const m of materials) {
        m.uniforms.uTime.value = phase;
        m.uniforms.uPulse.value = pulse;
      }
      for (const { l, k: mix } of lights) {
        const wave = 0.5 + 0.5 * Math.sin(phase * 0.5 + mix * 6.28);
        tmp.copy(uniforms.uColorA.value).lerp(uniforms.uColorB.value, wave);
        l.color.copy(tmp);
        l.intensity = (l.userData.base ??= l.intensity) * (0.85 + pulse * 0.25);
      }
    },
  };
}
