export const GRAVITY = 20;
export const JUMP_SPEED = 7.4;

export function createJumpState() {
  return { velocity: 0, grounded: true };
}

export function stepJump(position, state, requested, dt) {
  const step = Math.min(Math.max(dt, 0), 0.05);
  if (!step) return;
  if (requested && state.grounded) {
    state.velocity = JUMP_SPEED;
    state.grounded = false;
  }
  if (state.grounded) return;
  // Exact constant-gravity integration keeps the arc consistent across frame rates.
  position.y += state.velocity * step - 0.5 * GRAVITY * step * step;
  state.velocity -= GRAVITY * step;
  if (position.y <= 0) {
    position.y = 0;
    state.velocity = 0;
    state.grounded = true;
  }
}
