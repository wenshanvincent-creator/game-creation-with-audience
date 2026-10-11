export function createInput() {
  const keys = new Set();
  const pointers = new Map();
  let jumpRequested = false;
  const controls = document.querySelector('#touch-controls');
  const toggle = document.querySelector('#touch-toggle');
  const hint = document.querySelector('#control-hint');
  const buttons = [...controls.querySelectorAll('button')];
  const allowed = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space']);

  function release() {
    keys.clear();
    const captured = [...pointers.keys()];
    pointers.clear();
    jumpRequested = false;
    buttons.forEach(button => {
      button.classList.remove('held');
      for (const id of captured) {
        if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
      }
    });
  }
  function showTouch(show) {
    release();
    controls.hidden = !show;
    toggle.setAttribute('aria-pressed', String(show));
    toggle.textContent = show ? 'Hide controls' : 'Touch controls';
    hint.textContent = show ? 'Hold arrows · tap Jump' : 'WASD / arrows · Space to jump';
  }
  toggle.addEventListener('click', event => {
    showTouch(controls.hidden);
    if (event.detail > 0) toggle.blur();
  });
  showTouch(matchMedia('(pointer: coarse)').matches);

  window.addEventListener('keydown', event => {
    if (!allowed.has(event.code) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.matches('input, textarea, select') || (event.code === 'Space' && event.target.matches('button'))) return;
    event.preventDefault();
    if (event.code === 'Space' && !event.repeat && !keys.has('Space')) jumpRequested = true;
    keys.add(event.code);
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', release);
  window.addEventListener('pagehide', release);
  // A resized or rotated screen moves the controls away from held fingers.
  window.addEventListener('resize', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });

  for (const button of buttons) {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, button.dataset.direction);
      if (button.dataset.direction === 'jump') jumpRequested = true;
      button.classList.add('held');
    });
    const stop = event => {
      pointers.delete(event.pointerId);
      if (![...pointers.values()].includes(button.dataset.direction)) button.classList.remove('held');
    };
    button.addEventListener('pointerup', stop);
    button.addEventListener('pointercancel', stop);
    button.addEventListener('lostpointercapture', stop);
    // Keyboard activation of the accessible Jump button has no pointerdown.
    if (button.dataset.direction === 'jump') button.addEventListener('click', event => {
      if (event.detail === 0) jumpRequested = true;
    });
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
    consumeJump() {
      const requested = jumpRequested;
      jumpRequested = false;
      return requested;
    },
  };
}
