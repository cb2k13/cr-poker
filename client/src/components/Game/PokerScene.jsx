import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { createCardTexture } from '../../utils/poker';

// ─── Table ───────────────────────────────────────────────────────────────────
function PokerTable() {
  return (
    <group>
      {/* Felt surface — CylinderGeometry is already horizontal (axis=Y), no rotation needed */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <cylinderGeometry args={[4.2, 4.2, 0.12, 128]} />
        <meshStandardMaterial color="#1a6b3c" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Felt inner pattern ring — RingGeometry is in XY plane so needs -PI/2 to lie flat */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
        <ringGeometry args={[3.5, 3.9, 128]} />
        <meshStandardMaterial color="#155a31" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Rail (wood) — TorusGeometry is in XY plane so needs -PI/2 to lie flat */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
        <torusGeometry args={[4.2, 0.45, 16, 128]} />
        <meshStandardMaterial color="#5c3317" roughness={0.6} metalness={0.1} />
      </mesh>

      {/* Leg — cylinder already vertical, no rotation needed */}
      <mesh position={[0, -1.4, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.55, 2.7, 32]} />
        <meshStandardMaterial color="#3e2209" roughness={0.7} />
      </mesh>

      {/* Floor reflection */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.8, 0]}>
        <planeGeometry args={[30, 30]} />
        <MeshReflectorMaterial
          blur={[400, 100]}
          resolution={512}
          mixBlur={1}
          mixStrength={40}
          roughness={1}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#050510"
          metalness={0.5}
        />
      </mesh>
    </group>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────
function Card({ card, position, rotation = [0, 0, 0], faceDown = false, animate = false }) {
  const groupRef = useRef();
  const hoverRef = useRef(false);

  const materials = useMemo(() => {
    const sideMat = new THREE.MeshStandardMaterial({ color: '#e8e8e8', roughness: 0.4 });
    const frontCanvas = createCardTexture(card, faceDown);
    const backCanvas = createCardTexture(card, true);
    const frontTex = new THREE.CanvasTexture(frontCanvas);
    const backTex = new THREE.CanvasTexture(backCanvas);
    frontTex.minFilter = THREE.LinearFilter;
    backTex.minFilter = THREE.LinearFilter;
    return [
      sideMat, sideMat,           // +X / -X
      sideMat, sideMat,           // +Y / -Y
      new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.25 }), // +Z face
      new THREE.MeshStandardMaterial({ map: backTex,  roughness: 0.25 }), // -Z back
    ];
  }, [card?.rank, card?.suit, faceDown]);

  useFrame(() => {
    if (!groupRef.current || !animate) return;
    const target = hoverRef.current ? 0.18 : 0;
    groupRef.current.position.y += (target - groupRef.current.position.y) * 0.12;
  });

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      onPointerEnter={() => (hoverRef.current = true)}
      onPointerLeave={() => (hoverRef.current = false)}
    >
      <mesh material={materials} castShadow receiveShadow>
        <boxGeometry args={[0.72, 1.01, 0.005]} />
      </mesh>
    </group>
  );
}

// ─── Card Group ──────────────────────────────────────────────────────────────
function CardRow({ cards, basePosition, faceDown = false, spacing = 0.82, yRot = 0, isPlayer = false }) {
  const count = cards.length;
  return (
    <>
      {cards.map((card, i) => {
        const xOff = (i - (count - 1) / 2) * spacing;
        return (
          <Card
            key={`${card.suit}${card.rank}-${i}`}
            card={card}
            faceDown={faceDown}
            animate={isPlayer}
            position={[basePosition[0] + xOff, basePosition[1], basePosition[2]]}
            rotation={[-Math.PI / 2, 0, yRot]}
          />
        );
      })}
    </>
  );
}

// ─── Chips ───────────────────────────────────────────────────────────────────
function ChipStack({ position, value, color = '#1565c0' }) {
  const count = Math.min(Math.ceil(value / 100), 10);
  const chips = Array.from({ length: count });
  return (
    <group position={position}>
      {chips.map((_, i) => (
        <mesh key={i} position={[0, i * 0.065, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.055, 32]} />
          <meshStandardMaterial color={color} roughness={0.3} metalness={0.4} />
        </mesh>
      ))}
      {chips.map((_, i) => (
        <mesh key={`stripe-${i}`} position={[0, i * 0.065, 0]}>
          <cylinderGeometry args={[0.21, 0.21, 0.01, 32]} />
          <meshStandardMaterial color="white" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Lights ──────────────────────────────────────────────────────────────────
function Lights() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 7, 0]} intensity={2.5} castShadow shadow-mapSize={1024} color="#fff8e7" />
      <pointLight position={[-4, 3, 4]} intensity={0.6} color="#4fc3f7" />
      <pointLight position={[4, 3, -4]} intensity={0.6} color="#ce93d8" />
      <spotLight
        position={[0, 9, 0]}
        angle={0.5}
        penumbra={0.6}
        intensity={1.5}
        castShadow
        color="#fff8e7"
      />
    </>
  );
}

// ─── Main scene component ────────────────────────────────────────────────────
function Scene({ gameState }) {
  const { playerHand, aiHand, community, showAICards, playerChips, aiChips } = gameState;

  return (
    <>
      <Lights />
      <PokerTable />

      {/* AI hand — top of table, face down unless showdown */}
      {aiHand.length > 0 && (
        <CardRow
          cards={aiHand}
          basePosition={[0, 0.09, -2.2]}
          faceDown={!showAICards}
          yRot={Math.PI}
        />
      )}

      {/* Community cards */}
      {community.length > 0 && (
        <CardRow
          cards={community}
          basePosition={[0, 0.09, 0]}
          faceDown={false}
        />
      )}

      {/* Player hand — bottom of table, face up */}
      {playerHand.length > 0 && (
        <CardRow
          cards={playerHand}
          basePosition={[0, 0.09, 2.4]}
          faceDown={false}
          isPlayer
        />
      )}

      {/* Chip stacks */}
      <ChipStack position={[-3.2, 0.1, -2]} value={aiChips} color="#c62828" />
      <ChipStack position={[-3.2, 0.1, 2]} value={playerChips} color="#1565c0" />

      <Environment preset="city" />
    </>
  );
}

// ─── Exported canvas wrapper ─────────────────────────────────────────────────
export default function PokerScene({ gameState }) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 7.5, 5.5], fov: 55 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: 'transparent' }}
    >
      <Suspense fallback={null}>
        <Scene gameState={gameState} />
        <OrbitControls
          enablePan={false}
          minPolarAngle={0.3}
          maxPolarAngle={1.35}
          minDistance={5}
          maxDistance={14}
          target={[0, 0, 0]}
        />
      </Suspense>
    </Canvas>
  );
}
