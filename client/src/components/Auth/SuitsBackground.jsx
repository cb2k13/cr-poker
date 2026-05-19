import { useRef, Component } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── Extrude settings ──────────────────────────────────────────────────────────
const EXT = {
  depth: 0.15,
  bevelEnabled: true,
  bevelThickness: 0.04,
  bevelSize: 0.03,
  bevelSegments: 3,
};

// ── Shape builders ────────────────────────────────────────────────────────────
function mkDiamond() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.55);
  s.lineTo(0.38, 0);
  s.lineTo(0, -0.55);
  s.lineTo(-0.38, 0);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, EXT);
}

function mkHeart() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(0.5, -0.5, 0.75, 0, 0.5, 0.2);
  s.bezierCurveTo(0.4, 0.42, 0.1, 0.48, 0, 0.35);
  s.bezierCurveTo(-0.1, 0.48, -0.4, 0.42, -0.5, 0.2);
  s.bezierCurveTo(-0.75, 0, -0.5, -0.5, 0, -0.5);
  return new THREE.ExtrudeGeometry(s, EXT);
}

function mkSpade() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.52);
  s.bezierCurveTo(0.55, 0.52, 0.72, 0.05, 0.5, -0.18);
  s.bezierCurveTo(0.38, -0.3, 0.22, -0.26, 0.22, -0.3);
  s.lineTo(0.26, -0.52);
  s.lineTo(-0.26, -0.52);
  s.lineTo(-0.22, -0.3);
  s.bezierCurveTo(-0.22, -0.26, -0.38, -0.3, -0.5, -0.18);
  s.bezierCurveTo(-0.72, 0.05, -0.55, 0.52, 0, 0.52);
  return new THREE.ExtrudeGeometry(s, EXT);
}

function mkCircle(cx, cy, r) {
  const s = new THREE.Shape();
  s.absarc(cx, cy, r, 0, Math.PI * 2, false);
  return new THREE.ExtrudeGeometry(s, EXT);
}

function mkStem() {
  const s = new THREE.Shape();
  s.moveTo(-0.1, -0.28);
  s.lineTo(0.1, -0.28);
  s.lineTo(0.14, -0.52);
  s.lineTo(-0.14, -0.52);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, EXT);
}

// ── Pre-built geometries (created once at module level) ───────────────────────
const GEO = {
  diamond: mkDiamond(),
  heart:   mkHeart(),
  spade:   mkSpade(),
};

const CLUB_CIRCLES = [
  mkCircle(0,    0.22,  0.22),
  mkCircle(-0.2, -0.08, 0.22),
  mkCircle(0.2,  -0.08, 0.22),
];
const CLUB_STEM = mkStem();

// ── Suit instances scattered in 3D space ──────────────────────────────────────
const SUITS = [
  // hearts — red
  { type: 'heart',   position: [-7,   3,   -4], rotation: [0.3, 0.5, 0.1],   scale: 1.0, color: '#e74c3c', speed: 0.28, offset: 0    },
  { type: 'heart',   position: [5.5, -2,  -2.5],rotation: [0.1,-0.3, 0.5],   scale: 1.4, color: '#ff6b6b', speed: 0.20, offset: 1.1  },
  { type: 'heart',   position: [2,    5.5, -6],  rotation: [0.5, 0.2,-0.3],   scale: 1.8, color: '#c0392b', speed: 0.15, offset: 2.3  },
  { type: 'heart',   position: [-3,  -5,  -3],   rotation: [-0.2,0.7, 0.3],   scale: 0.8, color: '#e74c3c', speed: 0.35, offset: 3.7  },
  { type: 'heart',   position: [8.5,  1,  -5],   rotation: [0.6,-0.4, 0.2],   scale: 1.5, color: '#ff6b6b', speed: 0.22, offset: 4.5  },
  // diamonds — red
  { type: 'diamond', position: [6,    4.5, -3],   rotation: [0,   0.3, 0.5],   scale: 1.2, color: '#e74c3c', speed: 0.38, offset: 0.7  },
  { type: 'diamond', position: [-5,  -3,  -5],    rotation: [0.4, 0,   0.3],   scale: 1.6, color: '#ff8f8f', speed: 0.20, offset: 1.8  },
  { type: 'diamond', position: [0,    6,  -4],    rotation: [0.2, 0.5, 0],     scale: 1.3, color: '#c0392b', speed: 0.28, offset: 2.9  },
  { type: 'diamond', position: [-8.5, 2,  -2],    rotation: [-0.3,0.2, 0.6],   scale: 0.8, color: '#e74c3c', speed: 0.42, offset: 3.1  },
  { type: 'diamond', position: [4,   -5.5,-6],    rotation: [0.5,-0.2, 0.1],   scale: 1.7, color: '#ff6b6b', speed: 0.18, offset: 5.2  },
  // spades — blue / gold
  { type: 'spade',   position: [-6,   2,  -3],    rotation: [0.2, 0.8,-0.1],   scale: 1.3, color: '#4a90e2', speed: 0.26, offset: 0.4  },
  { type: 'spade',   position: [7,   -3,  -4],    rotation: [-0.3,0.2, 0.4],   scale: 1.5, color: '#a0c4ff', speed: 0.22, offset: 1.5  },
  { type: 'spade',   position: [1,    6.5,-5],    rotation: [0.6, 0.1, 0.3],   scale: 1.1, color: '#d4af37', speed: 0.30, offset: 3.2  },
  { type: 'spade',   position: [-2,  -4,  -2],    rotation: [0.1,-0.5, 0.2],   scale: 1.4, color: '#4a90e2', speed: 0.36, offset: 4.8  },
  { type: 'spade',   position: [9,    3,  -6],    rotation: [-0.2,0.4, 0.6],   scale: 1.6, color: '#a0c4ff', speed: 0.19, offset: 5.7  },
  // clubs — gold / blue
  { type: 'club',    position: [-4,   4.5,-4],    rotation: [0.4, 0.3,-0.2],   scale: 1.2, color: '#d4af37', speed: 0.24, offset: 0.9  },
  { type: 'club',    position: [3.5, -4,  -3],    rotation: [0.1, 0.6, 0.3],   scale: 1.4, color: '#4a90e2', speed: 0.29, offset: 2.0  },
  { type: 'club',    position: [-9,  -2,  -5],    rotation: [-0.3,0.1, 0.5],   scale: 1.7, color: '#d4af37', speed: 0.17, offset: 3.5  },
  { type: 'club',    position: [5.5,  5,  -2],    rotation: [0.5,-0.3, 0.1],   scale: 0.9, color: '#a0c4ff', speed: 0.40, offset: 4.1  },
  { type: 'club',    position: [-1,  -6,  -6],    rotation: [0.2, 0.4,-0.4],   scale: 1.5, color: '#d4af37', speed: 0.21, offset: 6.0  },
];

// ── Animated suit mesh ────────────────────────────────────────────────────────
function FloatingSuit({ type, position, rotation, scale, color, speed, offset }) {
  const ref = useRef();
  const [px, initY, pz] = position;
  const [irx, iry, irz] = rotation;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.y = initY + Math.sin(t * speed * 0.45 + offset) * 0.7;
    ref.current.rotation.x = irx + Math.sin(t * speed * 0.6 + offset) * 0.3;
    ref.current.rotation.y = iry + t * speed;
    ref.current.rotation.z = irz + Math.sin(t * speed * 0.4 + offset) * 0.15;
  });

  const matProps = { color, metalness: 0.35, roughness: 0.45, transparent: true, opacity: 0.72 };

  if (type === 'club') {
    return (
      <group ref={ref} position={[px, initY, pz]} rotation={rotation} scale={scale}>
        {CLUB_CIRCLES.map((geo, i) => (
          <mesh key={i} geometry={geo}>
            <meshStandardMaterial {...matProps} />
          </mesh>
        ))}
        <mesh geometry={CLUB_STEM}>
          <meshStandardMaterial {...matProps} />
        </mesh>
      </group>
    );
  }

  return (
    <mesh
      ref={ref}
      position={[px, initY, pz]}
      rotation={rotation}
      scale={scale}
      geometry={GEO[type]}
    >
      <meshStandardMaterial {...matProps} />
    </mesh>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 8, 6]} intensity={2.5} color="#ffffff" />
      <pointLight position={[-8, -4, 2]} intensity={1.2} color="#d4af37" />
      {SUITS.map((props, i) => (
        <FloatingSuit key={i} {...props} />
      ))}
    </>
  );
}

// ── Error boundary — silently hides if WebGL unavailable ──────────────────────
class SafeBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function SuitsBackground() {
  return (
    <SafeBoundary>
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}>
        <Canvas
          camera={{ position: [0, 0, 12], fov: 60 }}
          gl={{ antialias: true, alpha: true }}
          style={{ width: '100%', height: '100%' }}
        >
          <Scene />
        </Canvas>
      </div>
    </SafeBoundary>
  );
}
