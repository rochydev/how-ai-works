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
import { ScreenOS } from './screen/ScreenOS.js';
import { Pipeline } from './ai/pipeline.js';
import { STAGES } from './ai/stages.js';
import { STRINGS, detectUiLang } from './i18n.js';

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

// Temporary harness until the experience controller lands
const state = {
  lang: detectUiLang(),
  stage: 0,
  stageTime: 0,
  t: 0,
  typed: '',
  pipeline: new Pipeline(),
  temperature: 0.7,
  head: 0,
  focus: null,
  actions: {},
};
state.S = STRINGS[state.lang];
state.actions.setHead = (h) => (state.head = h);
state.actions.setFocus = (i) => (state.focus = i);
state.actions.goto = (i) => go(i);
const screen = new ScreenOS(desk.screenMesh, state);
engine.onUpdate((dt, t) => {
  state.t = t;
  state.stageTime += dt;
  if (STAGES[state.stage].id === 'attention' && state.pipeline.tokens.length) {
    state.focus = Math.floor(state.stageTime / 1.4) % state.pipeline.tokens.length;
  }
  if (STAGES[state.stage].id === 'generate' && !state.pipeline.done) {
    state.genAcc = (state.genAcc || 0) + dt;
    if (state.genAcc > 0.22) {
      state.genAcc = 0;
      state.pipeline.step(state.temperature);
    }
  }
  screen.update(dt);
});
function go(i) {
  state.stage = Math.max(0, Math.min(STAGES.length - 1, i));
  state.stageTime = 0;
  const id = STAGES[state.stage].id;
  if (id === 'sampling' && !state.pipeline.history.length) state.pipeline.step(state.temperature);
}
window.__state = state;
window.__go = go;
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') return go(state.stage + 1);
  if (e.key === 'ArrowLeft') return go(state.stage - 1);
  if (state.stage === 0) {
    if (e.key === 'Enter' && state.typed) {
      state.pipeline.setPrompt(state.typed, state.lang);
      go(1);
    } else if (e.key === 'Backspace') state.typed = state.typed.slice(0, -1);
    else if (e.key.length === 1) state.typed += e.key;
  }
  if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace') {
    character.type(e.key === 'Enter' ? '\n' : e.key === 'Backspace' ? '\b' : e.key);
    leds.pulse(0.4);
  }
});

const controls = new OrbitControls(camera, engine.renderer.domElement);
controls.target.set(0, 1.0, -1.8);
camera.position.set(0, 1.17, -1.7);
controls.target.set(0, 1.17, -2.26);
camera.fov = 50;
camera.updateProjectionMatrix();
controls.enableDamping = true;
engine.onUpdate(() => controls.update());

engine.start();
document.getElementById('loader').classList.add('hidden');
