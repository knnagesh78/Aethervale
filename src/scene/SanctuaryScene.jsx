import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { constrainTarget, seededRandom } from '../lib/sanctuary';
import InteractiveObjects from './InteractiveObjects';

export const RIVER = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-8, 0.11, -6.7), new THREE.Vector3(-5.3, 0.11, -4.5),
  new THREE.Vector3(-0.1, 0.11, -3.1), new THREE.Vector3(1.3, 0.11, -0.7),
  new THREE.Vector3(-0.8, 0.11, 2.3), new THREE.Vector3(-2.6, 0.11, 5.3),
  new THREE.Vector3(-2.8, 0.11, 8.65),
]);
export const PLACES = { explore: [0, 0, 0], release: [-3.8, 0.4, 4.1], hearth: [5, 0.4, 2.8], garden: [5.8, 0.4, -3.1] };

function ribbon(curve, width, y = 0) {
  const positions = [], indices = [], uvs = [];
  const count = 90;
  for (let i = 0; i <= count; i++) {
    const p = curve.getPoint(i / count), t = curve.getTangent(i / count);
    const normal = new THREE.Vector3(-t.z, 0, t.x).normalize();
    for (const side of [-1, 1]) { positions.push(p.x + normal.x * width * side / 2, p.y + y, p.z + normal.z * width * side / 2); uvs.push((side + 1) / 2, i / count); }
    if (i < count) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function Island() {
  const geometry = useMemo(() => {
    const random = seededRandom(80), positions = [], colors = [];
    const segments = 52;
    const edge = Array.from({ length: segments }, () => 0.97 + random() * 0.06);
    const palette = ['#a2b58b', '#a5b88e', '#a8ba91', '#a4b68d', '#a1b38a', '#a7b88d'].map(c => new THREE.Color(c));
    const point = (ring, i) => { const a = i / segments * Math.PI * 2, r = ring === 1 ? edge[i % segments] : ring; return [Math.cos(a) * 12.8 * r, ring === 1 ? -0.06 : 0, Math.sin(a) * 9 * r]; };
    const triangle = (a, b, c) => { positions.push(...a, ...b, ...c); const color = palette[Math.floor(random() * palette.length)]; for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b); };
    for (let i = 0; i < segments; i++) {
      triangle([0, 0, 0], point(0.25, i + 1), point(0.25, i));
      for (const [inner, outer] of [[0.25, 0.5], [0.5, 0.75], [0.75, 1]]) {
        triangle(point(inner, i), point(inner, i + 1), point(outer, i));
        triangle(point(outer, i), point(inner, i + 1), point(outer, i + 1));
      }
    }
    const result = new THREE.BufferGeometry(); result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); result.computeVertexNormals(); return result;
  }, []);
  return <group>
    <mesh geometry={geometry} receiveShadow><meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, -1.6, 0]} scale={[1.42, 1, 1]} receiveShadow><cylinderGeometry args={[8.95, 7.9, 3.1, 15, 2]} /><meshStandardMaterial color="#827e65" flatShading roughness={1} /></mesh>
    <mesh position={[0.3, -4.05, 0]} scale={[1.4, 1, 1]}><cylinderGeometry args={[7.9, 3.5, 2.2, 15, 1]} /><meshStandardMaterial color="#777965" flatShading roughness={1} /></mesh>
    <mesh position={[0.4, -5.8, -0.3]} scale={[1.35, 1, 1]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[3.9, 2.7, 8]} /><meshStandardMaterial color="#7b806c" flatShading /></mesh>
    <mesh position={[0, -0.35, 0]} scale={[1.42, 1, 1]}><cylinderGeometry args={[9.06, 8.95, 0.6, 26]} /><meshStandardMaterial color="#899c69" flatShading /></mesh>
  </group>;
}

function InstancedTrees({ reducedMotion }) {
  const trunks = useRef(), crowns = useRef(), tops = useRef();
  const trees = useMemo(() => {
    const random = seededRandom(43), result = [];
    // Leave open glades for all three places and keep the river unobstructed.
    for (let i = 0; i < 110; i++) {
      const x = (random() - 0.5) * 23, z = (random() - 0.5) * 15.5;
      if ((x / 11.5) ** 2 + (z / 7.8) ** 2 > 1 || (z > 0 && x > -5.3 && x < 8.5) || (x > 2.5 && z > -5.2)) continue;
      if (Array.from({ length: 30 }, (_, j) => RIVER.getPoint(j / 29)).some(p => Math.hypot(p.x - x, p.z - z) < 1.8)) continue;
      result.push({ x, z, scale: 0.8 + random() * 0.85, type: random(), color: ['#738c58', '#829e66', '#90aa74', '#a7b57d', '#68885e'][Math.floor(random() * 5)], phase: random() * 6 });
    }
    return result;
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    trees.forEach((t, i) => {
      dummy.position.set(t.x, t.scale * 0.9, t.z); dummy.scale.set(0.13 * t.scale, t.scale * 1.8, 0.13 * t.scale); dummy.rotation.set(0, t.phase, 0); dummy.updateMatrix(); trunks.current.setMatrixAt(i, dummy.matrix);
      crowns.current.setColorAt(i, new THREE.Color(t.color)); tops.current.setColorAt(i, new THREE.Color(t.color).multiplyScalar(1.07));
    });
    trunks.current.instanceMatrix.needsUpdate = true;
    crowns.current.instanceColor.needsUpdate = true; tops.current.instanceColor.needsUpdate = true;
  }, [trees, dummy]);
  useFrame(({ clock }) => {
    trees.forEach((t, i) => {
      const sway = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.48 + t.phase) * 0.025;
      dummy.position.set(t.x, 2.05 * t.scale, t.z); dummy.scale.set(t.scale * 1.2, t.scale * 1.35, t.scale * 1.12); dummy.rotation.set(sway, t.phase, sway * 0.7); dummy.updateMatrix(); crowns.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set(t.x + 0.1, 3.04 * t.scale, t.z); dummy.scale.set(t.scale * 0.84, t.scale * 1.1, t.scale * 0.82); dummy.updateMatrix(); tops.current.setMatrixAt(i, dummy.matrix);
    });
    crowns.current.instanceMatrix.needsUpdate = true; tops.current.instanceMatrix.needsUpdate = true;
  });
  return <group>
    <instancedMesh ref={trunks} args={[null, null, trees.length]} castShadow><cylinderGeometry args={[0.65, 1, 1, 5]} /><meshStandardMaterial color="#786e51" flatShading /></instancedMesh>
    <instancedMesh ref={crowns} args={[null, null, trees.length]} castShadow receiveShadow><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial roughness={1} flatShading /></instancedMesh>
    <instancedMesh ref={tops} args={[null, null, trees.length]} castShadow><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial roughness={1} flatShading /></instancedMesh>
  </group>;
}

function Details({ reducedMotion }) {
  const grasses = useRef(), rocks = useRef();
  const grassMaterial = useRef();
  const data = useMemo(() => {
    const random = seededRandom(91);
    return Array.from({ length: 320 }, () => ({ x: (random() - 0.5) * 24, z: (random() - 0.5) * 16.5, size: 0.12 + random() * 0.3, angle: random() * Math.PI, color: ['#81975f', '#b8c68a', '#94ad74'][Math.floor(random() * 3)] })).filter(p => (p.x / 12) ** 2 + (p.z / 8.2) ** 2 < 1 && !Array.from({ length: 35 }, (_, j) => RIVER.getPoint(j / 34)).some(r => Math.hypot(r.x - p.x, r.z - p.z) < 1.3) && Math.hypot(p.x - 5, p.z - 2.8) > 2 && Math.hypot(p.x - 5.8, p.z + 3.1) > 2);
  }, []);
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    data.forEach((p, i) => {
      dummy.position.set(p.x, p.size * 0.45, p.z); dummy.rotation.set(0, p.angle, 0.17); dummy.scale.set(p.size * 0.45, p.size * 1.5, p.size * 0.45); dummy.updateMatrix(); grasses.current.setMatrixAt(i, dummy.matrix); grasses.current.setColorAt(i, new THREE.Color(p.color));
    }); grasses.current.instanceMatrix.needsUpdate = true;
    data.slice(0, 30).forEach((p, i) => { dummy.position.set(p.x, 0.13, p.z); dummy.scale.set(p.size * 1.7, p.size, p.size * 1.5); dummy.rotation.set(p.angle, p.angle, 0); dummy.updateMatrix(); rocks.current.setMatrixAt(i, dummy.matrix); }); rocks.current.instanceMatrix.needsUpdate = true;
  }, [data]);
  const wind = useMemo(() => ({ value: 0 }), []);
  useFrame(({ clock }) => { wind.value = reducedMotion ? 0 : clock.elapsedTime; });
  const compile = shader => { shader.uniforms.windTime = wind; shader.vertexShader = 'uniform float windTime;\n' + shader.vertexShader; shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.x += sin(windTime * 0.8 + float(gl_InstanceID)) * max(position.y, 0.0) * 0.14;'); };
  return <group>
    <instancedMesh ref={grasses} args={[null, null, data.length]}><coneGeometry args={[1, 1, 3]} /><meshStandardMaterial ref={grassMaterial} onBeforeCompile={compile} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={rocks} args={[null, null, 30]} castShadow><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#b2b09a" flatShading /></instancedMesh>
    <group position={[-2.2, 0.25, 0.5]} rotation={[0, -0.35, 0]}>
      {Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[i * 0.55, 0, 0]} rotation={[0, i * 0.28, 0]} receiveShadow><cylinderGeometry args={[0.35, 0.4, 0.14, 6]} /><meshStandardMaterial color="#c6c6a7" flatShading /></mesh>)}
    </group>
    <group position={[1.05, 0.42, -0.65]} rotation={[0, 0.25, 0]}>
      {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[(i - 5.5) * 0.28, Math.sin(i / 11 * Math.PI) * 0.2, 0]} castShadow receiveShadow><boxGeometry args={[0.25, 0.11, 1.35]} /><meshStandardMaterial color={i % 3 ? '#b09e74' : '#bba880'} /></mesh>)}
      {[-0.62, 0.62].map(z => <mesh key={z} position={[0, -0.12, z]}><boxGeometry args={[3.7, 0.2, 0.12]} /><meshStandardMaterial color="#84714f" /></mesh>)}
    </group>
  </group>;
}

function River({ reducedMotion }) {
  const bank = useMemo(() => ribbon(RIVER, 2.15, -0.05), []);
  const water = useMemo(() => ribbon(RIVER, 1.6, 0), []);
  const streaks = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    if (!streaks.current) return;
    for (let i = 0; i < 20; i++) {
      const t = ((reducedMotion ? 0 : clock.elapsedTime * 0.025) + i / 20) % 1;
      const p = RIVER.getPoint(t), tangent = RIVER.getTangent(t);
      dummy.position.set(p.x + Math.sin(i * 4.8) * 0.4, p.y + 0.014, p.z); dummy.rotation.y = Math.atan2(tangent.x, tangent.z); dummy.scale.set(1, 1, 0.8 + i % 3 * 0.4); dummy.updateMatrix(); streaks.current.setMatrixAt(i, dummy.matrix);
    }
    streaks.current.instanceMatrix.needsUpdate = true;
  });
  return <group>
    <mesh geometry={bank} receiveShadow><meshStandardMaterial color="#d0c8a2" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={water}><meshStandardMaterial color="#93c4c3" roughness={0.35} metalness={0.1} side={THREE.DoubleSide} /></mesh>
    <instancedMesh ref={streaks} args={[null, null, 20]}><boxGeometry args={[0.025, 0.012, 0.38]} /><meshBasicMaterial color="#e1f0d9" transparent opacity={0.55} /></instancedMesh>
    <group position={[-2.8, -2.05, 8.65]} rotation={[0, 0.12, 0]}>
      <mesh><boxGeometry args={[1.55, 4.3, 0.1]} /><meshStandardMaterial color="#a7d2d1" transparent opacity={0.74} /></mesh>
      {[-0.57, -0.2, 0.14, 0.55].map((x, i) => <mesh key={x} position={[x, i * -0.15, 0.08]}><boxGeometry args={[0.075, 4.6 - i * 0.3, 0.025]} /><meshBasicMaterial color="#e1e9d9" transparent opacity={0.45} /></mesh>)}
      <mesh position={[0, -2.4, 0]} scale={[1.7, 0.2, 0.8]}><icosahedronGeometry args={[1, 1]} /><meshBasicMaterial color="#d2dfd3" transparent opacity={0.4} /></mesh>
    </group>
  </group>;
}

function Atmosphere({ lighting, reducedMotion }) {
  const { scene } = useThree();
  const sun = useRef(), ambient = useRef(), fireflies = useRef();
  const day = useMemo(() => new THREE.Color('#dce5d7'), []);
  const dusk = useMemo(() => new THREE.Color('#b9c4c0'), []);
  const night = useMemo(() => new THREE.Color('#718893'), []);
  const current = useMemo(() => day.clone(), [day]);
  const motes = useMemo(() => { const random = seededRandom(23); return Array.from({ length: 32 }, () => [(random() - 0.5) * 26, 0.7 + random() * 4, (random() - 0.5) * 17]); }, []);
  useFrame(({ clock }, delta) => {
    const phase = lighting === 'auto' ? (1 - Math.cos(clock.elapsedTime / 720 * Math.PI * 2)) / 2 : lighting === 'dusk' ? 0.48 : lighting === 'night' ? 1 : 0;
    const target = phase < 0.5 ? day.clone().lerp(dusk, phase * 2) : dusk.clone().lerp(night, (phase - 0.5) * 2);
    current.lerp(target, 1 - Math.exp(-delta * 0.5)); scene.background = current; scene.fog.color.copy(current);
    sun.current.intensity = THREE.MathUtils.damp(sun.current.intensity, 2.5 - phase * 1.6, 0.5, delta);
    ambient.current.intensity = THREE.MathUtils.damp(ambient.current.intensity, 1.6 - phase * 0.6, 0.5, delta);
    if (!reducedMotion) fireflies.current.children.forEach((m, i) => { m.position.x = motes[i][0] + Math.sin(clock.elapsedTime * 0.18 + i) * 0.8; m.position.y = motes[i][1] + Math.sin(clock.elapsedTime * 0.5 + i) * 0.25; });
  });
  return <>
    <fog attach="fog" args={['#dce5d7', 45, 115]} />
    <hemisphereLight ref={ambient} args={['#fff4e1', '#bdc3ac', 1.6]} />
    <directionalLight ref={sun} position={[-15, 25, 12]} intensity={2.5} color="#fff2d2" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18} shadow-normalBias={0.06} shadow-bias={-0.0002} />
    <group ref={fireflies}>{motes.map((p, i) => <mesh key={i} position={p}><sphereGeometry args={[i % 3 ? 0.025 : 0.04, 4, 4]} /><meshBasicMaterial color="#fbf0bc" transparent opacity={0.65} /></mesh>)}</group>
    <group position={[0, -4, -34]}>
      {[[-35, 8, 10], [-21, 6, 14], [-5, 5, 12], [13, 8, 16], [33, 7, 12]].map(([x, y, scale], i) => <mesh key={i} position={[x, y, -i % 2 * 8]} scale={[1.6, 0.65, 0.8]}><coneGeometry args={[scale, scale * 1.35, 5]} /><meshBasicMaterial color={i % 2 ? '#c5d2c5' : '#bccdbe'} transparent opacity={0.55} /></mesh>)}
    </group>
  </>;
}

function CameraRig({ view, reducedMotion }) {
  const controls = useRef(), camera = useRef();
  const { size, gl } = useThree();
  const transition = useRef(true);
  const keys = useRef(new Set());
  const target = useMemo(() => new THREE.Vector3(), []);
  const mobile = size.width <= 600;
  const baseZoom = Math.min(size.width / (mobile ? 27 : 35), size.height / 27);
  useLayoutEffect(() => {
    camera.current.setViewOffset(size.width, size.height, mobile ? 0 : -size.width * 0.1, -size.height * (mobile ? 0.14 : 0.04), size.width, size.height);
  }, [size.width, size.height, mobile]);
  useEffect(() => { transition.current = true; }, [view, size.width, size.height]);
  useEffect(() => {
    const down = event => { if (!['INPUT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName) && !document.querySelector('dialog[open]') && ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) { keys.current.add(event.key); transition.current = false; event.preventDefault(); } };
    const up = event => keys.current.delete(event.key);
    const clear = () => keys.current.clear();
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); };
  }, []);
  useFrame((_, delta) => {
    if (!controls.current || !camera.current) return;
    const c = controls.current;
    if (transition.current) {
      const place = PLACES[view] || PLACES.explore;
      target.set(place[0], view === 'explore' ? 0.1 : place[1], place[2]);
      const old = c.target.clone(); c.target.lerp(target, reducedMotion ? 1 : 1 - Math.exp(-delta * 2.3)); camera.current.position.add(c.target.clone().sub(old));
      const zoom = baseZoom * (view === 'explore' ? 1 : 1.62);
      camera.current.zoom = THREE.MathUtils.damp(camera.current.zoom, zoom, 2.3, delta); camera.current.updateProjectionMatrix();
      if (c.target.distanceTo(target) < 0.02 && Math.abs(camera.current.zoom - zoom) < 0.02) transition.current = false;
    }
    if (keys.current.size) {
      const old = c.target.clone(), k = keys.current;
      const dx = (k.has('d') || k.has('ArrowRight') ? 1 : 0) - (k.has('a') || k.has('ArrowLeft') ? 1 : 0);
      const dz = (k.has('s') || k.has('ArrowDown') ? 1 : 0) - (k.has('w') || k.has('ArrowUp') ? 1 : 0);
      const [x, z] = constrainTarget(c.target.x + dx * delta * 3, c.target.z + dz * delta * 3);
      c.target.set(x, c.target.y, z); camera.current.position.add(c.target.clone().sub(old));
    }
    c.update();
  });
  return <>
    <OrthographicCamera ref={camera} makeDefault position={[25, 24, 34]} zoom={baseZoom} near={0.1} far={180} />
    <OrbitControls ref={controls} args={[undefined, gl.domElement]} enablePan={false} enableDamping dampingFactor={0.055} rotateSpeed={0.35} zoomSpeed={0.55} minZoom={baseZoom * 0.75} maxZoom={baseZoom * 2.4} minPolarAngle={0.55} maxPolarAngle={1.16} minAzimuthAngle={-0.8} maxAzimuthAngle={1.3} onStart={() => { transition.current = false; }} />
  </>;
}

export default function SanctuaryScene({ view, lighting, reducedMotion, presence, flowers, resting, onVisit, onReady }) {
  useEffect(() => { onReady(); }, [onReady]);
  return <>
    <CameraRig view={view} reducedMotion={reducedMotion} />
    <Atmosphere lighting={lighting} reducedMotion={reducedMotion} />
    <group position={[0, 0, 0]}>
      <Island />
      <River reducedMotion={reducedMotion} />
      <InstancedTrees reducedMotion={reducedMotion} />
      <Details reducedMotion={reducedMotion} />
      <InteractiveObjects river={RIVER} presence={presence} flowers={flowers} resting={resting} onVisit={onVisit} reducedMotion={reducedMotion} />
    </group>
  </>;
}
