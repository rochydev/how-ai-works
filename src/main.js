import './styles/main.css';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Engine } from './core/engine.js';
import { createRoom } from './scene/room.js';
import { createLeds } from './scene/leds.js';
import { createDesk } from './scene/desk.js';
import { createProps } from './scene/props.js';
import { createParticles } from './scene/particles.js';
import { createCharacter } from './scene/character.js';
import { SCREEN } from './scene/desk.js';

// Canvas textures need the web fonts ready before they are drawn
await Promise.race([
  Promise.all([
    document.fonts.load("italic 700 40px 'Space Grotesk'"),
    document.fonts.load("800 40px 'Space Grotesk'"),
    document.fonts.load("600 20px 'JetBrains Mono'"),
    document.fonts.load("400 20px 'JetBrains Mono'"),
  ]),
  new Promise((resolve) => setTimeout(resolve, 2500)),
]);

const engine = new Engine(document.getElementById('app'));
const { scene, camera } = engine;

const room = createRoom();
const leds = createLeds();
const desk = createDesk();
const props = createProps();
const particles = createParticles({ mugTop: desk.mugTop });
scene.add(room.group, leds.group, desk.group, props.group, particles.group);

const character = createCharacter({
  keyboard: desk.keyboard,
  mousePosition: desk.mousePosition,
  screenCenter: SCREEN.center,
});
scene.add(character.root);

for (const sys of [room, leds, desk, props, particles, character]) engine.onUpdate(sys.update);

// Temporary: echo real keystrokes onto the character
window.addEventListener('keydown', (e) => {
  if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace') {
    character.type(e.key === 'Enter' ? '\n' : e.key === 'Backspace' ? '\b' : e.key);
    leds.pulse(0.4);
  }
});

const controls = new OrbitControls(camera, engine.renderer.domElement);
controls.target.set(0, 1.0, -1.8);
camera.position.set(1.2, 1.5, -0.4);
controls.enableDamping = true;
engine.onUpdate(() => controls.update());

engine.start();
document.getElementById('loader').classList.add('hidden');
