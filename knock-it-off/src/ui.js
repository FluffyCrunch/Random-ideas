import * as THREE from 'three';

const money = n => '$' + Math.round(n).toLocaleString('en-US');
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
const _v = new THREE.Vector3();

// Everything on screen that isn't the 3D scene: HUD, popups, overlays.
export class UI {
  constructor() {
    const $ = id => document.getElementById(id);
    this.el = {
      hud: $('hud'), score: $('score'), scoreBar: $('scoreBar'), goalText: $('goalText'), comboText: $('comboText'),
      timer: $('timer'), strikes: [...document.querySelectorAll('#strikes .paw')],
      suspBar: $('suspBar'), guiltBar: $('guiltBar'), callouts: $('callouts'), bubble: $('bubble'),
      arrow: $('ownerArrow'), hint: $('hint'), flash: $('flash'),
      start: $('start'), pause: $('pause'), end: $('end'),
      endTitle: $('endTitle'), endSub: $('endSub'), endStats: $('endStats'), endRating: $('endRating'),
      mute: $('muteBtn'),
    };
    this.last = {};
  }

  show(name) { this.el[name].hidden = false; }
  hide(name) { this.el[name].hidden = true; }

  // Only touch the DOM when a value actually changed
  set(key, el, prop, value) {
    if (this.last[key] === value) return;
    this.last[key] = value;
    el[prop] = value;
  }

  update(s) {
    const e = this.el;
    this.set('score', e.score, 'textContent', money(s.score));
    this.set('bar', e.scoreBar.style, 'width', Math.min(100, (s.score / s.goal) * 100).toFixed(1) + '%');
    this.set('goal', e.goalText, 'textContent', `Goal ${money(s.goal)}`);
    this.set('timer', e.timer, 'textContent', fmtTime(s.timeLeft));
    e.timer.parentElement.classList.toggle('low', s.timeLeft < 20);
    this.set('combo', e.comboText, 'textContent', s.comboCount >= 2 ? `COMBO x${s.mult.toFixed(2)}` : '');
    e.strikes.forEach((p, i) => p.classList.toggle('lost', i < s.strikes));
    this.set('susp', e.suspBar.style, 'width', (s.susp * 100).toFixed(0) + '%');
    this.set('guilt', e.guiltBar.style, 'width', (s.guilt * 100).toFixed(0) + '%');
    e.suspBar.parentElement.classList.toggle('hot', s.susp > 0.35);
  }

  // Big message in the middle of the screen
  callout(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'callout ' + cls;
    el.textContent = text;
    this.el.callouts.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  // Floating text pinned to a spot in the world
  worldPop(text, pos, camera, cls = '') {
    const p = this.project(pos, camera);
    if (p.behind) return;
    const el = document.createElement('div');
    el.className = 'pop ' + cls;
    el.textContent = text;
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    this.el.callouts.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  project(pos, camera) {
    _v.copy(pos).project(camera);
    return {
      x: (_v.x * 0.5 + 0.5) * innerWidth,
      y: (-_v.y * 0.5 + 0.5) * innerHeight,
      nx: _v.x, ny: _v.y, behind: _v.z > 1,
    };
  }

  // The owner's speech bubble, and an arrow pointing at them when they're off screen
  owner(speech, headPos, bodyPos, camera, state) {
    const e = this.el;
    const h = this.project(headPos, camera);
    const visible = !h.behind && Math.abs(h.nx) < 1 && Math.abs(h.ny) < 1;
    if (speech && visible) {
      e.bubble.hidden = false;
      this.set('bubbleText', e.bubble, 'textContent', speech.text);
      e.bubble.style.left = h.x + 'px';
      e.bubble.style.top = h.y - 14 + 'px';
      e.bubble.classList.toggle('alert', state === 'chase' || state === 'cooldown');
    } else e.bubble.hidden = true;

    if (visible) { e.arrow.hidden = true; return; }
    const b = this.project(bodyPos, camera);
    let dx = b.nx, dy = b.ny;
    if (b.behind) { dx = -dx; dy = -dy; if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) dy = -1; }
    const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
    const x = (dx / m * 0.88 * 0.5 + 0.5) * innerWidth;
    const y = (-dy / m * 0.84 * 0.5 + 0.5) * innerHeight;
    e.arrow.hidden = false;
    e.arrow.style.left = x + 'px';
    e.arrow.style.top = y + 'px';
    e.arrow.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(-dy, dx)}rad)`;
  }

  flash() {
    const f = this.el.flash;
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  }

  setMuted(m) { this.el.mute.classList.toggle('off', m); }

  showEnd({ title, sub, stats, rating, win }) {
    const e = this.el;
    e.end.classList.toggle('win', win);
    e.endTitle.textContent = title;
    e.endSub.textContent = sub;
    e.endRating.textContent = rating;
    e.endStats.innerHTML = stats.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    this.hide('hud');
    this.show('end');
  }
}

export { money };
