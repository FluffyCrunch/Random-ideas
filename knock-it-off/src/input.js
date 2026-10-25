// Keyboard and mouse. `down` is what's held right now, `pressed` is what was
// pressed since the last frame (so a quick tap is never missed).
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.wheel = 0;
    // Mouse-look, the way 3D games do it: the browser captures the mouse and every movement turns the camera.
    // Some embedded browsers don't allow capture, so `mouse` also tracks where the cursor is,
    // and the game steers the camera from that instead.
    this.locked = false;
    this.wantLock = false;                 // set by the game while a round is running
    this.look = { dx: 0, dy: 0 };          // mouse movement since the last frame
    this.lastX = 0;
    this.lastY = 0;
    this.mouse = { x: 0, y: 0, px: 0, py: 0, active: false };   // cursor position, -1..1 from the window's middle

    const block = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'];
    addEventListener('keydown', e => {
      if (block.includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', e => this.down.delete(e.code));
    addEventListener('blur', () => { this.down.clear(); this.mouse.active = false; });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.look.dx = this.look.dy = 0;
      this.onLockChange?.(this.locked);
    });

    // a click anywhere in the game tries to capture the mouse again if it isn't captured
    canvas.addEventListener('mousedown', () => { if (this.wantLock && !this.locked) this.lock(); });
    addEventListener('mousemove', e => {
      const m = this.mouse;
      m.px = e.clientX;
      m.py = e.clientY;
      m.x = (e.clientX / innerWidth) * 2 - 1;
      m.y = (e.clientY / innerHeight) * 2 - 1;
      m.active = true;
      // how far the mouse moved: this is what turns the camera, captured or not
      this.look.dx += e.movementX ?? (e.clientX - this.lastX);
      this.look.dy += e.movementY ?? (e.clientY - this.lastY);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    document.documentElement.addEventListener('mouseleave', () => { this.mouse.active = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.wheel += Math.sign(e.deltaY); }, { passive: false });
  }

  // Capture the mouse. Browsers only allow this from a click or key press.
  lock() {
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && p.catch) p.catch(() => {});
    } catch { /* not allowed here: the camera follows the cursor instead */ }
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
    this.look.dx = this.look.dy = 0;
    this.wheel = 0;
  }
}
