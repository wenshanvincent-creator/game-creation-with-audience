import * as THREE from 'three';

export function createCharacter(scene) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const materials = Object.fromEntries(Object.entries({ skin: '#f0c49a', shirt: '#328989', shorts: '#315266', shoes: '#fff2d3', cap: '#ee9254', eyes: '#2b414b', pack: '#e2bb70' }).map(([name, color]) => [name, new THREE.MeshStandardMaterial({ color, roughness: 1 })]));

  function box(parent, size, position, material) {
    const mesh = new THREE.Mesh(geometry, materials[material]);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  box(body, [0.7, 0.75, 0.43], [0, 1.1, 0], 'shirt');
  box(body, [0.63, 0.2, 0.43], [0, 0.66, 0], 'shorts');
  box(body, [0.66, 0.62, 0.61], [0, 1.8, 0], 'skin');
  box(body, [0.72, 0.19, 0.67], [0, 2.1, 0], 'cap');
  box(body, [0.65, 0.08, 0.23], [0, 2.03, 0.38], 'cap');
  box(body, [0.07, 0.09, 0.035], [-0.16, 1.84, 0.315], 'eyes');
  box(body, [0.07, 0.09, 0.035], [0.16, 1.84, 0.315], 'eyes');
  box(body, [0.46, 0.52, 0.18], [0, 1.15, -0.3], 'pack');
  const arms = [];
  const legs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.48, 1.39, 0);
    box(arm, [0.23, 0.29, 0.31], [0, -0.14, 0], 'shirt');
    box(arm, [0.21, 0.38, 0.25], [0, -0.44, 0], 'skin');
    body.add(arm);
    arms.push(arm);
    const leg = new THREE.Group();
    leg.position.set(side * 0.19, 0.61, 0);
    box(leg, [0.25, 0.43, 0.28], [0, -0.21, 0], 'shorts');
    box(leg, [0.29, 0.17, 0.4], [0, -0.52, 0.045], 'shoes');
    body.add(leg);
    legs.push(leg);
  }
  root.rotation.y = Math.atan2(21, 30);
  scene.add(root);
  let phase = 0;
  return {
    root,
    update(motion, dt, reducedMotion) {
      const walking = motion.distance > 0.00001;
      if (walking) {
        const angle = Math.atan2(motion.x, motion.z);
        const difference = Math.atan2(Math.sin(angle - root.rotation.y), Math.cos(angle - root.rotation.y));
        root.rotation.y += difference * (1 - Math.exp(-15 * dt));
        phase += motion.distance * 3.3;
      }
      const target = walking && !reducedMotion ? Math.sin(phase) * 0.55 : 0;
      const blend = 1 - Math.exp(-18 * dt);
      legs[0].rotation.x += (target - legs[0].rotation.x) * blend;
      legs[1].rotation.x += (-target - legs[1].rotation.x) * blend;
      arms[0].rotation.x = -legs[0].rotation.x * 0.75;
      arms[1].rotation.x = -legs[1].rotation.x * 0.75;
      body.position.y = walking && !reducedMotion ? Math.abs(Math.sin(phase)) * 0.04 : 0;
    },
  };
}
