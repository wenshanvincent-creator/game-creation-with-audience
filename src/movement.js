export const TILE_SIZE = 2;
export const WALK_SPEED = 4.4;
export const PLAYER_RADIUS = 0.32;

export function createTiles() {
  const tiles = new Set();
  for (let x = -8; x <= 8; x++) {
    for (let z = -6; z <= 6; z++) {
      if (Math.abs(x) + Math.abs(z) <= 11) tiles.add(`${x},${z}`);
    }
  }
  return tiles;
}

export function canStand(tiles, x, z) {
  // Check the footprint, so the character's feet stay on the stepped shoreline.
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const tx = Math.floor((x + Math.cos(angle) * PLAYER_RADIUS + 1) / TILE_SIZE);
    const tz = Math.floor((z + Math.sin(angle) * PLAYER_RADIUS + 1) / TILE_SIZE);
    if (!tiles.has(`${tx},${tz}`)) return false;
  }
  return true;
}

export function movePlayer(position, input, dt, tiles, cameraOffset) {
  const magnitude = Math.hypot(input.x, input.z);
  if (!magnitude) return { x: 0, z: 0, distance: 0 };
  const length = Math.hypot(cameraOffset.x, cameraOffset.z);
  const right = { x: cameraOffset.z / length, z: -cameraOffset.x / length };
  const forward = { x: -cameraOffset.x / length, z: -cameraOffset.z / length };
  const step = WALK_SPEED * Math.min(Math.max(dt, 0), 0.05) / Math.max(magnitude, 1);
  const dx = (right.x * input.x + forward.x * input.z) * step;
  const dz = (right.z * input.x + forward.z * input.z) * step;
  const oldX = position.x;
  const oldZ = position.z;
  // Sliding along the edge feels natural without walking into the sea.
  if (canStand(tiles, position.x + dx, position.z)) position.x += dx;
  if (canStand(tiles, position.x, position.z + dz)) position.z += dz;
  const x = position.x - oldX;
  const z = position.z - oldZ;
  return { x, z, distance: Math.hypot(x, z) };
}
