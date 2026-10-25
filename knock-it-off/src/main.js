import './style.css';
import { Game } from './game.js';

const game = new Game(document.getElementById('scene'));
window.game = game;   // handy for poking at the game from the browser console
game.start();
