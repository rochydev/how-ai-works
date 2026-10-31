import './styles/main.css';
import { Engine } from './core/engine.js';

const engine = new Engine(document.getElementById('app'));

engine.start();
document.getElementById('loader').classList.add('hidden');
