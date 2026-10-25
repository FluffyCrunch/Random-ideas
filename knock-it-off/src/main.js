import './style.css';
import { Game } from './game.js';

const game = new Game(document.getElementById('scene'));
// a handle for poking at the game from the browser console, while developing only
if (import.meta.env.DEV) window.game = game;
game.start();
