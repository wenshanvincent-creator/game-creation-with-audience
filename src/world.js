import * as THREE from 'three';
import { TILE_SIZE } from './movement.js';

export function createWorld(scene, tiles) {
  scene.background = new THREE.Color('#b9e5ee');
  scene.fog = new THREE.Fog('#c5e5e6', 45, 135);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(180, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vPosition; void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vPosition; void main() { float h = smoothstep(-25.0, 100.0, vPosition.y); gl_FragColor = vec4(mix(vec3(0.87, 0.94, 0.89), vec3(0.48, 0.77, 0.88), h), 1.0); }',
    }),
  );
  scene.add(sky);
  scene.add(new THREE.HemisphereLight('#fff6db', '#709798', 2.6));
  const sun = new THREE.DirectionalLight('#fff0c4', 3.1);
  sun.position.set(-18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -29, right: 29, top: 29, bottom: -29, near: 1, far: 85 });
  sun.shadow.normalBias = 0.04;
  sun.shadow.bias = -0.0001;
  scene.add(sun);

  const earth = new THREE.InstancedMesh(
    new THREE.BoxGeometry(TILE_SIZE + 0.002, 1.9, TILE_SIZE + 0.002),
    new THREE.MeshStandardMaterial({ color: '#aa805a', roughness: 1 }),
    tiles.size,
  );
  const surface = new THREE.InstancedMesh(
    new THREE.BoxGeometry(TILE_SIZE, 0.25, TILE_SIZE),
    new THREE.MeshStandardMaterial({ roughness: 1 }),
    tiles.size,
  );
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  let index = 0;
  for (const tile of tiles) {
    const [x, z] = tile.split(',').map(Number);
    const shore = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !tiles.has(`${x + dx},${z + dz}`));
    const variation = (Math.sin(x * 127.1 + z * 311.7) * 43758.5453) % 1;
    matrix.makeTranslation(x * TILE_SIZE, -1.2, z * TILE_SIZE);
    earth.setMatrixAt(index, matrix);
    matrix.makeTranslation(x * TILE_SIZE, -0.125, z * TILE_SIZE);
    surface.setMatrixAt(index, matrix);
    color.set(shore ? '#edd6a1' : '#92bb6b').offsetHSL(0, 0, variation * 0.025);
    surface.setColorAt(index, color);
    index++;
  }
  earth.castShadow = true;
  earth.receiveShadow = true;
  surface.receiveShadow = true;
  scene.add(earth, surface);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(380, 380),
    new THREE.MeshStandardMaterial({ color: '#74c7c9', roughness: 0.65, metalness: 0.05 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -1.35;
  water.receiveShadow = true;
  scene.add(water);

  // Sparse pale squares suggest ripples without textures or downloaded assets.
  const ripples = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 0.07),
    new THREE.MeshBasicMaterial({ color: '#d4f2e7', transparent: true, opacity: 0.32, depthWrite: false }),
    100,
  );
  const dummy = new THREE.Object3D();
  let count = 0;
  for (let i = 0; count < 100; i++) {
    const x = Math.sin(i * 5.317) * 58;
    const z = Math.cos(i * 2.713) * 58;
    if (Math.abs(x) < 19 && Math.abs(z) < 15) continue;
    dummy.position.set(x, -1.33, z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(1 + (i % 4), 1, 1);
    dummy.updateMatrix();
    ripples.setMatrixAt(count++, dummy.matrix);
  }
  scene.add(ripples);

  const cloudMaterial = new THREE.MeshBasicMaterial({ color: '#fff8e9', transparent: true, opacity: 0.8 });
  const cloudGeometry = new THREE.BoxGeometry(1, 1, 1);
  const clouds = [];
  for (const [x, y, z, scale] of [[-32, 23, -40, 1.2], [24, 27, -48, 1.5], [48, 24, -16, 0.85]]) {
    const cloud = new THREE.Group();
    for (const [cx, cy, width, height] of [[0, 0, 8, 1.6], [-2, 1, 3.5, 2], [1, 1.6, 3, 2.5]]) {
      const block = new THREE.Mesh(cloudGeometry, cloudMaterial);
      block.position.set(cx, cy, 0);
      block.scale.set(width, height, 3);
      cloud.add(block);
    }
    cloud.position.set(x, y, z);
    cloud.scale.setScalar(scale);
    scene.add(cloud);
    clouds.push(cloud);
  }
  return { update(dt) { clouds.forEach(cloud => { cloud.position.x += dt * 0.13; if (cloud.position.x > 85) cloud.position.x = -85; }); } };
}
