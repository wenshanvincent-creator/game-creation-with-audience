import { advancePhase, getDayNightState, INITIAL_PHASE, TIME_PRESETS } from './day-night.js';

export function createTimeControls(reducedMotion) {
  let phase = INITIAL_PHASE;
  let cycling = !reducedMotion.matches;
  const toggle = document.querySelector('#cycle-toggle');
  const label = document.querySelector('#time-label');
  const clock = document.querySelector('#time-clock');
  const presets = [...document.querySelectorAll('[data-time]')];
  let activePreset = null;

  function paint() {
    toggle.setAttribute('aria-pressed', String(cycling));
    toggle.textContent = cycling ? 'Pause cycle' : 'Resume cycle';
    presets.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.time === activePreset)));
  }
  presets.forEach(button => button.addEventListener('click', event => {
    phase = TIME_PRESETS[button.dataset.time];
    activePreset = button.dataset.time;
    cycling = false;
    paint();
    if (event.detail > 0) button.blur();
  }));
  toggle.addEventListener('click', event => {
    cycling = !cycling;
    activePreset = null;
    paint();
    if (event.detail > 0) toggle.blur();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) { cycling = false; paint(); }
  });
  paint();
  return {
    update(dt) {
      if (cycling && !document.hidden) phase = advancePhase(phase, dt);
      const state = getDayNightState(phase);
      label.textContent = state.label;
      clock.textContent = state.time;
      document.body.dataset.night = String(state.daylight < 0.35);
      return state;
    },
    snapshot: () => ({ ...getDayNightState(phase), cycling }),
  };
}
