export function createInput() {
  const keys = new Set();
  const pointers = new Map();
  const controls = document.querySelector('#touch-controls');
  const toggle = document.querySelector('#touch-toggle');
  const hint = document.querySelector('#control-hint');
  const buttons = [...controls.querySelectorAll('button')];
  const allowed = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);

  function release() {
    keys.clear();
    pointers.clear();
    buttons.forEach(button => button.classList.remove('held'));
  }
  function showTouch(show) {
    release();
    controls.hidden = !show;
    toggle.setAttribute('aria-pressed', String(show));
    toggle.textContent = show ? 'Hide controls' : 'Touch controls';
    hint.textContent = show ? 'Hold the arrows to explore' : 'Move with WASD or arrow keys';
  }
  toggle.addEventListener('click', () => showTouch(controls.hidden));
  showTouch(matchMedia('(pointer: coarse)').matches);

  window.addEventListener('keydown', event => {
    if (!allowed.has(event.code) || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    keys.add(event.code);
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });

  for (const button of buttons) {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, button.dataset.direction);
      button.classList.add('held');
    });
    const stop = event => {
      pointers.delete(event.pointerId);
      if (![...pointers.values()].includes(button.dataset.direction)) button.classList.remove('held');
    };
    button.addEventListener('pointerup', stop);
    button.addEventListener('pointercancel', stop);
    button.addEventListener('lostpointercapture', stop);
  }

  return {
    read() {
      const touch = new Set(pointers.values());
      const held = (direction, ...codes) => touch.has(direction) || codes.some(code => keys.has(code));
      return {
        x: Number(held('right', 'KeyD', 'ArrowRight')) - Number(held('left', 'KeyA', 'ArrowLeft')),
        z: Number(held('forward', 'KeyW', 'ArrowUp')) - Number(held('backward', 'KeyS', 'ArrowDown')),
      };
    },
    release,
  };
}
