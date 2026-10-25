// Keyboard and mouse. `down` is what's held right now, `pressed` is what was
// pressed since the last frame (so a quick tap is never missed).
export class Input {
  constructor(canvas) {
    this.down = new Set();
    this.pressed = new Set();
    this.orbit = { dx: 0, dy: 0 };
    this.wheel = 0;
    this.dragging = false;

    const block = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'];
    addEventListener('keydown', e => {
      if (block.includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', e => this.down.delete(e.code));
    addEventListener('blur', () => { this.down.clear(); this.dragging = false; });

    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) this.pressed.add('Mouse0');
      if (e.button === 2) this.dragging = true;
    });
    addEventListener('mouseup', e => { if (e.button === 2) this.dragging = false; });
    addEventListener('mousemove', e => {
      if (this.dragging) { this.orbit.dx += e.movementX; this.orbit.dy += e.movementY; }
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.wheel += Math.sign(e.deltaY); }, { passive: false });
  }

  isDown(...codes) { return codes.some(c => this.down.has(c)); }

  // True once if the key was pressed since the last frame
  take(code) {
    const had = this.pressed.has(code);
    this.pressed.delete(code);
    return had;
  }

  endFrame() {
    this.pressed.clear();
    this.orbit.dx = this.orbit.dy = 0;
    this.wheel = 0;
  }
}
