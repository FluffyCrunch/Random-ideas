// Keyboard and mouse. `down` is what's held right now, `pressed` is what was
// pressed since the last frame (so a quick tap is never missed).
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.orbit = { dx: 0, dy: 0 };
    this.wheel = 0;
    this.dragging = false;     // right-button drag, kept as a fallback when the mouse can't be captured
    this.locked = false;       // pointer lock: the mouse is captured and just moving it turns the camera
    this.wantLock = false;     // set by the game while a round is running

    const block = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'];
    addEventListener('keydown', e => {
      if (block.includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', e => this.down.delete(e.code));
    addEventListener('blur', () => { this.down.clear(); this.dragging = false; });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.onLockChange?.(this.locked);
    });

    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) {
        // the click that captures the mouse shouldn't also swat
        if (this.wantLock && !this.locked) this.lock();
        else this.pressed.add('Mouse0');
      }
      if (e.button === 2) this.dragging = true;
    });
    addEventListener('mouseup', e => { if (e.button === 2) this.dragging = false; });
    addEventListener('mousemove', e => {
      if (this.locked || this.dragging) { this.orbit.dx += e.movementX; this.orbit.dy += e.movementY; }
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.wheel += Math.sign(e.deltaY); }, { passive: false });
  }

  // Capture the mouse. Browsers only allow this from a click or key press.
  lock() {
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && p.catch) p.catch(() => {});
    } catch { /* no pointer lock here: right-drag and the arrow keys still work */ }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
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
