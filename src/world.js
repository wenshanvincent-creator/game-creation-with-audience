import * as THREE from 'three';
import { TILE_SIZE } from './movement.js';

export function createWorld(scene, tiles) {
  scene.background = new THREE.Color('#b9e5ee');
  scene.fog = new THREE.Fog('#c5e5e6', 45, 135);
  const skyUniforms = {
    topColor: { value: new THREE.Color('#80c5df') },
    horizonColor: { value: new THREE.Color('#d7eee6') },
  };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(180, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: skyUniforms,
      vertexShader: 'varying vec3 vPosition; void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        varying vec3 vPosition;
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        void main() {
          float h = smoothstep(-5.0, 65.0, vPosition.y);
          gl_FragColor = vec4(mix(horizonColor, topColor, h), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  scene.add(sky);
  const ambient = new THREE.HemisphereLight('#fff6db', '#709798', 2.6);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight('#fff0c4', 3.1);
  sun.position.set(-18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -29, right: 29, top: 29, bottom: -29, near: 1, far: 180 });
  sun.shadow.normalBias = 0.04;
  sun.shadow.bias = -0.0001;
  scene.add(sun);
  const moonlight = new THREE.DirectionalLight('#b8ceff', 1.05);
  scene.add(moonlight);

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
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(3.1, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffe0a0', toneMapped: false, fog: false }));
  const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(4.5, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffc57b', transparent: true, opacity: 0.15, depthWrite: false, toneMapped: false, fog: false }));
  const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(2.7, 12, 8), new THREE.MeshBasicMaterial({ color: '#e2ebff', toneMapped: false, fog: false }));
  scene.add(sunDisc, sunGlow, moonDisc);

  const starPositions = [];
  const starCount = 280;
  for (let i = 0; i < starCount; i++) {
    const across = Math.sin(i * 13.713) * 110;
    const height = 5 + (Math.sin(i * 7.919) * 0.5 + 0.5) * 75;
    starPositions.push(-65 + across * 0.819, height, -93 - across * 0.573);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: '#e4edff', size: 0.5, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  const palette = Object.fromEntries(Object.entries({
    top: ['#101a39', '#80c5df', '#bc7a9a'],
    horizon: ['#263d60', '#d7eee6', '#f6b982'],
    water: ['#20334c', '#74c7c9', '#b9898f'],
    ambient: ['#9faedc', '#fff6db', '#ffd4b0'],
    ground: ['#344976', '#709798', '#917876'],
    cloud: ['#3b4e70', '#fff8e9', '#f4c4b0'],
  }).map(([name, colors]) => [name, colors.map(color => new THREE.Color(color))]));
  function tint(destination, name, state) {
    const [night, day, dusk] = palette[name];
    destination.copy(night).lerp(day, state.daylight).lerp(dusk, state.twilight);
  }
  function celestialPosition(mesh, orbit) {
    mesh.position.set(-48.7 + orbit.x * 45 * 0.819, orbit.y * 19, -69.6 - orbit.x * 45 * 0.573);
  }
  return {
    update(dt, state, reducedMotion) {
      tint(skyUniforms.topColor.value, 'top', state);
      tint(skyUniforms.horizonColor.value, 'horizon', state);
      scene.fog.color.copy(skyUniforms.horizonColor.value);
      scene.background.copy(skyUniforms.topColor.value);
      tint(water.material.color, 'water', state);
      tint(ambient.color, 'ambient', state);
      tint(ambient.groundColor, 'ground', state);
      tint(cloudMaterial.color, 'cloud', state);
      ambient.intensity = state.ambientIntensity;
      sun.intensity = state.sunIntensity;
      moonlight.intensity = state.moonIntensity;
      sun.position.set(-48.7 + state.sun.x * 36.9, Math.max(state.elevation * 40, 3), -69.6 - state.sun.x * 25.8);
      moonlight.position.set(-48.7 + state.moon.x * 36.9, Math.max(-state.elevation * 40, 3), -69.6 - state.moon.x * 25.8);
      celestialPosition(sunDisc, state.sun);
      sunGlow.position.copy(sunDisc.position);
      celestialPosition(moonDisc, state.moon);
      sunDisc.visible = sunGlow.visible = state.elevation > -0.08;
      moonDisc.visible = state.elevation < 0.08;
      starMaterial.opacity = state.stars;
      stars.visible = state.stars > 0.001;
      if (!reducedMotion) clouds.forEach(cloud => {
        cloud.position.x += dt * 0.13;
        if (cloud.position.x > 85) cloud.position.x = -85;
      });
    },
    snapshot: () => ({
      sunIntensity: sun.intensity, moonIntensity: moonlight.intensity,
      ambientIntensity: ambient.intensity, starsOpacity: starMaterial.opacity,
      starCount, skyTop: skyUniforms.topColor.value.getHexString(),
      sunPosition: sunDisc.position.toArray(), moonPosition: moonDisc.position.toArray(),
      sunVisible: sunDisc.visible, moonVisible: moonDisc.visible,
    }),
  };
}
