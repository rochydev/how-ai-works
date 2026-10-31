import './styles/main.css';
import { Engine } from './core/engine.js';
import { Director } from './core/director.js';
import { Experience } from './core/experience.js';
import { Audio } from './core/audio.js';
import { createRoom } from './scene/room.js';
import { createLeds } from './scene/leds.js';
import { createDesk, SCREEN } from './scene/desk.js';
import { createProps } from './scene/props.js';
import { createParticles } from './scene/particles.js';
import { createCharacter } from './scene/character.js';
import { createHolo } from './scene/holo.js';
import { ScreenOS } from './screen/ScreenOS.js';
import { Hud } from './ui/hud.js';
import { STAGES } from './ai/stages.js';
import { detectUiLang } from './i18n.js';

const loaderBar = document.querySelector('.loader-bar i');
const progress = (k) => (loaderBar.style.width = `${Math.round(k * 100)}%`);
progress(0.1);

// Canvas textures need the web fonts ready before they are drawn
await Promise.race([
  Promise.all([
    document.fonts.load("italic 400 40px 'Instrument Serif'"),
    document.fonts.load("400 40px 'Instrument Serif'"),
    document.fonts.load("700 40px 'IBM Plex Sans'"),
    document.fonts.load("600 40px 'IBM Plex Sans'"),
    document.fonts.load("400 20px 'IBM Plex Sans'"),
    document.fonts.load("700 20px 'IBM Plex Mono'"),
    document.fonts.load("600 20px 'IBM Plex Mono'"),
    document.fonts.load("400 20px 'IBM Plex Mono'"),
  ]),
  new Promise((resolve) => setTimeout(resolve, 2500)),
]);
progress(0.4);

const params = new URLSearchParams(location.search);
const engine = new Engine(document.getElementById('app'));
const { scene } = engine;

const room = createRoom();
const leds = createLeds();
const desk = createDesk();
const props = createProps();
const particles = createParticles({ mugTop: desk.mugTop });
const character = createCharacter({ keyboard: desk.keyboard, mousePosition: desk.mousePosition, screenCenter: SCREEN.center });
const holo = createHolo();
scene.add(room.group, leds.group, desk.group, props.group, particles.group, character.root, holo.group);
progress(0.75);

const director = new Director(engine);
director.orbitIntro = true;
const audio = new Audio();
const experience = new Experience({
  engine,
  director,
  character,
  leds,
  holo,
  audio,
  lang: detectUiLang(),
  screen: null,
});
experience.screen = new ScreenOS(desk.screenMesh, experience.state);
const hud = new Hud(document.getElementById('hud'), experience.state, experience);
experience.attachHud(hud);

// Browsers only allow audio after a gesture: the first click or key anywhere starts it
for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => audio.unlock(), { once: true });

for (const sys of [room, leds, desk, props, particles, character]) engine.onUpdate(sys.update);
engine.onUpdate((dt, t) => director.update(dt, t));
engine.onUpdate((dt, t) => experience.update(dt, t));

// ---- URL parameters (handy for demos, recordings and screenshots) ----------
//   ?lang=en  ?prompt=Hello  ?stage=attention  ?autoplay  ?paused  ?ui=0  ?temp=1.2  ?shot=room
if (params.has('temp')) experience.setTemperature(Number(params.get('temp')));
if (params.get('ui') === '0') document.getElementById('hud').style.display = 'none';
const startPrompt = params.get('prompt');
if (startPrompt || params.has('autoplay')) {
  experience.state.intro = false;
  director.orbitIntro = false;
  if (params.has('paused')) experience.state.playing = false;
  if (startPrompt) {
    experience.state.typed = startPrompt;
    experience.state.pipeline.setPrompt(startPrompt, experience.state.lang);
    const idx = STAGES.findIndex((s) => s.id === params.get('stage'));
    experience.goto(Math.max(1, idx), { force: true });
  } else {
    experience.goto(0, { force: true });
    setTimeout(() => experience.autoType(experience.state.S.suggestions[Number(params.get('autoplay')) || 0]), 900);
  }
  if (params.has('shot')) director.go(params.get('shot'), 0.01);
  director.progress = 1;
}

window.__haw = { experience, director, engine };

engine.start();
progress(1);
setTimeout(() => document.getElementById('loader').classList.add('hidden'), 250);
