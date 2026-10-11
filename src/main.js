import { createInput } from './input.js';
import { createTiles, movePlayer } from './movement.js';
import { createJumpState, stepJump } from './physics.js';
import { createTimeControls } from './time-controls.js';

const status = document.querySelector('#status');

async function start() {
  // Keep the dependency import inside this try/catch so a CDN failure is visible.
  const THREE = await import('three');
  const [{ createWorld }, { createCharacter }] = await Promise.all([
    import('./world.js'), import('./character.js'),
  ]);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 240);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute('aria-label', 'A blocky explorer on an island under a changing day and night sky');
  document.querySelector('#game').append(renderer.domElement);

  const tiles = createTiles();
  const world = createWorld(scene, tiles);
  const character = createCharacter(scene);
  const input = createInput();
  const offset = new THREE.Vector3(21, 14, 30);
  const target = new THREE.Vector3(0, 0.9, 0);
  const desired = new THREE.Vector3();
  const lookAt = target.clone();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const jump = createJumpState();
  const time = createTimeControls(reducedMotion);
  world.update(0, time.update(0), reducedMotion.matches);
  camera.position.copy(target).add(offset);
  camera.lookAt(target);

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    // Keep the character and ground in view on tall phone screens.
    camera.fov = camera.aspect < 0.8 ? 58 : 50;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener('resize', resize);
  resize();
  const clock = new THREE.Clock();
  let contextLost = false;
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    input.release();
    status.textContent = 'The graphics connection paused. Reload this page to return to your island.';
    status.hidden = false;
  });

  // Read-only diagnostics are opt-in for the browser regression check.
  if (new URLSearchParams(location.search).has('debug')) {
    Object.defineProperty(window, '__island', { value: Object.freeze({
      snapshot: () => ({
        player: character.root.position.toArray(),
        camera: camera.position.toArray(),
        target: lookAt.toArray(),
        cameraDirection: camera.getWorldDirection(new THREE.Vector3()).toArray(),
        tiles: tiles.size,
        drawCalls: renderer.info.render.calls,
        jump: { ...jump },
        time: time.snapshot(),
        lighting: world.snapshot(),
      }),
    }) });
  }
  renderer.setAnimationLoop(() => {
    if (contextLost) return;
    const elapsed = clock.getDelta();
    const dt = Math.min(elapsed, 0.05);
    const motion = movePlayer(character.root.position, input.read(), dt, tiles, offset);
    stepJump(character.root.position, jump, input.consumeJump(), dt);
    character.update(motion, dt, reducedMotion.matches);
    target.copy(character.root.position);
    target.y += 0.9;
    const blend = 1 - Math.exp(-7 * dt);
    camera.position.lerp(desired.copy(target).add(offset), blend);
    lookAt.lerp(target, blend);
    camera.lookAt(lookAt);
    world.update(dt, time.update(elapsed), reducedMotion.matches);
    renderer.render(scene, camera);
  });
  status.hidden = true;
}

start().catch(error => {
  console.error('Island startup failed:', error);
  status.textContent = 'The island couldn’t load. Check your internet connection and WebGL support, then reload to try again.';
  status.hidden = false;
});
