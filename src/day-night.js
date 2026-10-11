export const CYCLE_SECONDS = 90;
export const INITIAL_PHASE = 0.62;
export const TIME_PRESETS = Object.freeze({ day: 0.48, sunset: 0.74, night: 0.98 });

function smoothstep(low, high, value) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

export function wrapPhase(phase) {
  return ((phase % 1) + 1) % 1;
}

export function advancePhase(phase, dt) {
  return wrapPhase(phase + Math.min(Math.max(dt, 0), 1) / CYCLE_SECONDS);
}

export function getDayNightState(phase) {
  phase = wrapPhase(phase);
  const angle = (phase - 0.25) * Math.PI * 2;
  const elevation = Math.sin(angle);
  const daylight = smoothstep(-0.12, 0.3, elevation);
  const twilight = (1 - smoothstep(0.02, 0.28, Math.abs(elevation))) * 0.9;
  const stars = (1 - daylight) * (1 - twilight);
  const label = daylight < 0.08 ? 'Night' : elevation < 0.35 ? (phase < 0.5 ? 'Dawn' : 'Sunset') : (phase < 0.5 ? 'Morning' : 'Afternoon');
  const minutes = Math.floor(phase * 24 * 60);
  return {
    phase, angle, elevation, daylight, twilight, stars, label,
    time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
    sun: { x: Math.cos(angle), y: elevation },
    moon: { x: -Math.cos(angle), y: -elevation },
    sunIntensity: 3.1 * daylight,
    moonIntensity: 1.05 * (1 - daylight),
    ambientIntensity: 1.1 + 1.5 * daylight,
  };
}
