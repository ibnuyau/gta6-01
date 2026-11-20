// Keyboard and mouse input: WASD, camera drag, click to shoot, and the
// one-shot keys (E, Q, F, G, M, H, Esc) handed to main.js as they land.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.camYaw = Math.PI;      // camera looks north by default
    this.camPitch = 0.3;
    this.dragging = false;
    this.lastX = 0; this.lastY = 0;
    this.clicked = false;
    this.onKey = null;          // (code) => void, for one-shot actions
    this.onClick = null;        // () => void

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (this.onKey) this.onKey(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    // never keep driving after the tab loses focus or hides
    window.addEventListener('blur', () => { this.keys = {}; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.keys = {};
    });

    canvas.addEventListener('mousedown', (e) => {
      this.dragging = true;
      this.lastX = e.clientX; this.lastY = e.clientY;
    });
    window.addEventListener('mouseup', (e) => {
      if (this.dragging && Math.hypot(e.clientX - this.lastX, e.clientY - this.lastY) < 5) {
        this.clicked = true;
        if (this.onClick) this.onClick();
      }
      this.dragging = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.camYaw -= dx * 0.005;
      this.camPitch = Math.max(0.08, Math.min(1.1, this.camPitch + dy * 0.004));
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
