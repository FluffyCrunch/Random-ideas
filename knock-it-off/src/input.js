// Keyboard and mouse. `down` is what's held right now, `pressed` is what was
// pressed since the last frame (so a quick tap is never missed).
export class Input {
  constructor(canvas) {
    this.down = new Set();
    this.pressed = new Set();
    this.wheel = 0;
    // where the cursor is, -1..1 from the middle of the window (and in pixels, for drawing the aim marker)
    this.mouse = { x: 0, y: 0, px: 0, py: 0, active: false };

    const block = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'];
    addEventListener('keydown', e => {
      if (block.includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', e => this.down.delete(e.code));
    addEventListener('blur', () => { this.down.clear(); this.mouse.active = false; });

    // No dragging and no pointer lock: the camera simply turns toward wherever the cursor is
    addEventListener('mousemove', e => {
      const m = this.mouse;
      m.px = e.clientX;
      m.py = e.clientY;
      m.x = (e.clientX / innerWidth) * 2 - 1;
      m.y = (e.clientY / innerHeight) * 2 - 1;
      m.active = true;
    });
    document.documentElement.addEventListener('mouseleave', () => { this.mouse.active = false; });
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
    this.wheel = 0;
  }
}
