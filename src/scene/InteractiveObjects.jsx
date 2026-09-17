import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Flame, Sprout, Wind } from 'lucide-react';
import * as THREE from 'three';
import { lanternProgress, seededRandom } from '../lib/sanctuary';

function PlaceLabel({ position, name, icon: Icon, onClick, tone = '' }) {
  return <Html position={position} center zIndexRange={[15, 0]}><button className={`place-label ${tone}`} onClick={e => { e.stopPropagation(); onClick(); }}><span className="place-dot"><Icon size={13} strokeWidth={1.6} /></span><span>{name}</span><span className="place-arrow">↗</span></button></Html>;
}

function Dock({ onVisit }) {
  return <group position={[-3.65, 0.22, 4.45]}>
    <group onClick={e => { e.stopPropagation(); onVisit('release'); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
      {Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[i * 0.27 - 0.8, 0.12, 0]} castShadow receiveShadow><boxGeometry args={[0.25, 0.13, 1.45]} /><meshStandardMaterial color={i % 2 ? '#b9a77e' : '#ae9a71'} /></mesh>)}
      {[-0.83, 0.84].flatMap(x => [-0.7, 0.7].map(z => <mesh key={`${x}${z}`} position={[x, -0.08, z]}><cylinderGeometry args={[0.09, 0.1, 0.72, 6]} /><meshStandardMaterial color="#84734f" /></mesh>))}
      <group position={[-0.62, 0.4, -0.5]}><mesh><boxGeometry args={[0.28, 0.38, 0.28]} /><meshStandardMaterial color="#f6de9b" emissive="#edb967" emissiveIntensity={0.35} /></mesh><mesh position={[0, 0.21, 0]}><coneGeometry args={[0.24, 0.1, 4]} /><meshStandardMaterial color="#817753" /></mesh></group>
    </group>
    <PlaceLabel position={[-0.5, 1.4, 0]} name="Release a thought" icon={Wind} onClick={() => onVisit('release')} />
  </group>;
}

function Campfire({ count, onVisit, reducedMotion }) {
  const flames = useRef(), light = useRef(), sparks = useRef(), orbs = useRef();
  const warmth = Math.min(1, Math.log2(count + 1) / 7);
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    light.current.intensity = THREE.MathUtils.damp(light.current.intensity, 4 + warmth * 7 + (reducedMotion ? 0 : Math.sin(t * 5) * 0.3), 2, delta);
    flames.current.children.forEach((flame, i) => { flame.scale.y = (0.85 + warmth * 0.35) * (1 + (reducedMotion ? 0 : Math.sin(t * (3 + i) + i) * 0.13)); flame.rotation.y = t * 0.12 + i; });
    sparks.current.children.forEach((spark, i) => { const life = ((reducedMotion ? i / 14 : t * 0.22) + i / 14) % 1; spark.position.y = 0.4 + life * 1.7; spark.position.x = Math.sin(i * 18 + t * 0.2) * (0.2 + life * 0.45); spark.scale.setScalar((1 - life) * 0.04); spark.visible = i < 5 + Math.round(warmth * 9); });
    orbs.current.children.forEach((orb, i) => { orb.position.y = 0.45 + (reducedMotion ? 0 : Math.sin(t * 0.75 + i * 2) * 0.1); });
  });
  return <group position={[5, 0.12, 2.8]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[2.25, 32]} /><meshStandardMaterial color="#bec195" /></mesh>
    <group onClick={e => { e.stopPropagation(); onVisit('hearth'); }}>
      {Array.from({ length: 10 }, (_, i) => <mesh key={i} position={[Math.cos(i / 10 * Math.PI * 2) * 0.72, 0.13, Math.sin(i / 10 * Math.PI * 2) * 0.72]} scale={[0.32, 0.21, 0.26]} rotation={[0, i, 0]} castShadow><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color={i % 2 ? '#999984' : '#b0ac93'} flatShading /></mesh>)}
      {[0.6, -0.6].map(r => <mesh key={r} position={[0, 0.22, 0]} rotation={[Math.PI / 2, r, 0]} castShadow><cylinderGeometry args={[0.14, 0.17, 1.05, 6]} /><meshStandardMaterial color="#796046" /></mesh>)}
      <group ref={flames} position={[0, 0.28, 0]}>
        <mesh position={[0, 0.43, 0]}><coneGeometry args={[0.36, 1.03, 7]} /><meshBasicMaterial color="#f1b25d" transparent opacity={0.82} /></mesh>
        <mesh position={[0.1, 0.28, 0.02]}><coneGeometry args={[0.24, 0.8, 6]} /><meshBasicMaterial color="#ffdc91" /></mesh>
        <mesh position={[-0.12, 0.14, 0.13]}><coneGeometry args={[0.2, 0.48, 5]} /><meshBasicMaterial color="#fff0b5" /></mesh>
      </group>
      <pointLight ref={light} position={[0, 1, 0]} color="#ffb959" intensity={5} distance={7} decay={2} />
      <group ref={sparks}>{Array.from({ length: 14 }, (_, i) => <mesh key={i} position={[0, 0, Math.sin(i) * 0.25]}><sphereGeometry args={[1, 4, 4]} /><meshBasicMaterial color="#ffd397" /></mesh>)}</group>
      {[-1, 1].map(side => <group key={side} position={[side * 1.55, 0.26, 0.35]} rotation={[0, side * -0.35, Math.PI / 2]}><mesh castShadow><cylinderGeometry args={[0.25, 0.26, 1.35, 7]} /><meshStandardMaterial color="#94825a" flatShading /></mesh><mesh position={[0, 0.68, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.22, 7]} /><meshStandardMaterial color="#c9b78a" /></mesh></group>)}
    </group>
    <group ref={orbs}>{Array.from({ length: Math.min(6, Math.max(1, count)) }, (_, i) => <mesh key={i} position={[Math.cos(i * 2.4) * 1.6, 0.6, Math.sin(i * 2.4) * 1.6]}><sphereGeometry args={[0.09, 8, 8]} /><meshBasicMaterial color="#fff0bd" transparent opacity={0.8} /></mesh>)}</group>
    <PlaceLabel position={[0, 2.25, 0]} name="Shared hearth" icon={Flame} tone="warm" onClick={() => onVisit('hearth')} />
  </group>;
}

function Flower({ position, color, grown, reducedMotion, index }) {
  const ref = useRef();
  useFrame(({ clock }, delta) => {
    const s = THREE.MathUtils.damp(ref.current.scale.x, grown ? 1 : 0.045, 0.7, delta); ref.current.scale.setScalar(s);
    ref.current.rotation.z = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.5 + index) * 0.06;
  });
  return <group ref={ref} position={position} scale={0.045} visible={grown}>
    <mesh position={[0, 0.32, 0]}><cylinderGeometry args={[0.023, 0.028, 0.65, 4]} /><meshStandardMaterial color="#698753" /></mesh>
    <mesh position={[0.1, 0.28, 0]} scale={[0.2, 0.045, 0.1]} rotation={[0, 0, 0.6]}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#84a16b" /></mesh>
    <group position={[0, 0.68, 0]}>{Array.from({ length: 5 }, (_, i) => <mesh key={i} position={[Math.cos(i * Math.PI * 0.4) * 0.115, 0, Math.sin(i * Math.PI * 0.4) * 0.115]} scale={[0.12, 0.07, 0.12]}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color={color} /></mesh>)}<mesh position={[0, 0.04, 0]}><sphereGeometry args={[0.075, 6, 4]} /><meshStandardMaterial color="#e9cb75" /></mesh></group>
  </group>;
}

function Garden({ flowers, resting, onVisit, reducedMotion }) {
  const patches = useMemo(() => { const random = seededRandom(13); return Array.from({ length: 12 }, (_, i) => ({ position: [(i % 4 - 1.5) * 0.58 + random() * 0.12, 0.12, (Math.floor(i / 4) - 1) * 0.65], color: ['#f0cfb7', '#e5dfad', '#dbbed3', '#f3e7be'][i % 4] })); }, []);
  return <group position={[5.8, 0.14, -3.1]}>
    <group onClick={e => { e.stopPropagation(); onVisit('garden'); }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1.35, 1, 1]}><circleGeometry args={[1.58, 12]} /><meshStandardMaterial color="#93976a" /></mesh>
      <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2.9, 2.1]} /><meshStandardMaterial color="#96916d" /></mesh>
      {[-1.15, 1.15].map(z => <mesh key={z} position={[0, 0.09, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.085, 0.085, 3.05, 5]} /><meshStandardMaterial color="#bcb58d" /></mesh>)}
      {patches.map((p, i) => <Flower key={i} {...p} index={i} grown={i < flowers} reducedMotion={reducedMotion} />)}
      {patches.map((p, i) => <mesh key={i} position={[p.position[0], 0.14, p.position[2]]} rotation={[0, i, -0.2]} scale={[0.055, 0.15, 0.055]}><coneGeometry args={[1, 1, 4]} /><meshStandardMaterial color="#aec084" /></mesh>)}
    </group>
    <PlaceLabel position={[0, 1.65, 0]} name={resting ? 'A little room to grow' : 'Slow garden'} icon={Sprout} onClick={() => onVisit('garden')} />
  </group>;
}

function LanternRiver({ lanterns, river, onSupport, clockOffset, reducedMotion }) {
  const bodies = useRef(), bases = useRef(), roofs = useRef(), hint = useRef();
  const [hovered, setHovered] = useState(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    // Fixed bounds encompass the complete downstream path as instances move.
    for (const mesh of [bodies.current, bases.current, roofs.current]) mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(-2.5, 0.5, 6.5), 4);
  }, []);
  useFrame(({ clock }) => {
    const meshes = [bodies.current, bases.current, roofs.current];
    meshes.forEach(mesh => { mesh.count = lanterns.length; });
    lanterns.forEach((lantern, i) => {
      const progress = lanternProgress(lantern.createdAt, Date.now() + clockOffset.current);
      const point = river.getPoint(0.735 + progress * 0.255);
      const y = point.y + 0.32 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 1.5 + lantern.hue) * 0.03);
      dummy.position.set(point.x, y, point.z); dummy.rotation.set(0, reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.17 + lantern.hue) * 0.25, 0); dummy.scale.setScalar(hovered === lantern.id ? 1.13 : 1); dummy.updateMatrix(); bodies.current.setMatrixAt(i, dummy.matrix);
      dummy.position.y = y - 0.26; dummy.updateMatrix(); bases.current.setMatrixAt(i, dummy.matrix);
      dummy.position.y = y + 0.26; dummy.rotation.y += Math.PI / 4; dummy.updateMatrix(); roofs.current.setMatrixAt(i, dummy.matrix);
      if (hovered === lantern.id && hint.current) hint.current.position.set(point.x, y + 0.9, point.z);
    });
    meshes.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
  });
  const handlers = {
    onClick: e => { e.stopPropagation(); const l = lanterns[e.instanceId]; if (l) onSupport(l.id); },
    onPointerOver: e => { e.stopPropagation(); setHovered(lanterns[e.instanceId]?.id); document.body.style.cursor = 'pointer'; },
    onPointerOut: () => { setHovered(null); document.body.style.cursor = ''; },
  };
  return <>
    <instancedMesh ref={bodies} args={[null, null, 256]} {...handlers}><boxGeometry args={[0.35, 0.48, 0.35]} /><meshStandardMaterial color="#f7de9f" emissive="#fac467" emissiveIntensity={0.7} /></instancedMesh>
    <instancedMesh ref={bases} args={[null, null, 256]} {...handlers}><boxGeometry args={[0.42, 0.045, 0.42]} /><meshStandardMaterial color="#a8996b" /></instancedMesh>
    <instancedMesh ref={roofs} args={[null, null, 256]} {...handlers}><coneGeometry args={[0.26, 0.12, 4]} /><meshStandardMaterial color="#edcea0" /></instancedMesh>
    {hovered && lanterns.some(l => l.id === hovered) && <group ref={hint}><Html center style={{ pointerEvents: 'none' }}><span className="lantern-hint">Send a little kindness</span></Html></group>}
  </>;
}

function Ripple({ ripple, lantern, river, clockOffset }) {
  const ref = useRef(), particles = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const age = (Date.now() - ripple.localAt) / 1000;
    const t = lanternProgress(lantern.createdAt, Date.now() + clockOffset.current);
    const p = river.getPoint(Math.max(0.02, 0.735 + t * 0.255 - age * 0.04));
    ref.current.position.set(p.x, 0.15, p.z);
    ref.current.children.forEach((ring, i) => { ring.scale.setScalar(0.3 + (age * 0.9 + i * 0.25) % 1.5); ring.material.opacity = Math.max(0, 0.65 - age * 0.16); });
    particles.current.position.copy(ref.current.position);
    for (let i = 0; i < 10; i++) { const angle = i * Math.PI / 5; dummy.position.set(Math.cos(angle) * age * 0.32, Math.sin(Math.min(age, 3) / 3 * Math.PI) * 0.7 + i % 3 * 0.06, Math.sin(angle) * age * 0.32); dummy.scale.setScalar(Math.max(0, 1 - age / 3)); dummy.updateMatrix(); particles.current.setMatrixAt(i, dummy.matrix); }
    particles.current.instanceMatrix.needsUpdate = true;
    particles.current.material.opacity = Math.max(0, 0.8 - age * 0.3);
  });
  return <><group ref={ref}>{[0, 1, 2].map(i => <mesh key={i} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.8, 0.83, 24]} /><meshBasicMaterial color="#fff1c2" transparent opacity={0.65} side={THREE.DoubleSide} /></mesh>)}</group><instancedMesh ref={particles} args={[null, null, 10]}><sphereGeometry args={[0.045, 4, 4]} /><meshBasicMaterial color="#fff1c2" transparent /></instancedMesh></>;
}

export default function InteractiveObjects({ river, presence, flowers, resting, onVisit, reducedMotion }) {
  return <>
    <Dock onVisit={onVisit} />
    <Campfire count={presence.count} onVisit={onVisit} reducedMotion={reducedMotion} />
    <Garden flowers={flowers} resting={resting} onVisit={onVisit} reducedMotion={reducedMotion} />
    <LanternRiver lanterns={presence.lanterns} river={river} onSupport={presence.support} clockOffset={presence.clockOffset} reducedMotion={reducedMotion} />
    {presence.ripples.map(r => { const l = presence.lanterns.find(l => l.id === r.id); return l ? <Ripple key={`${r.id}-${r.at}`} ripple={r} lantern={l} river={river} clockOffset={presence.clockOffset} /> : null; })}
  </>;
}
