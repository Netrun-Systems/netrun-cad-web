import { useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  PerspectiveCamera,
  Html,
} from '@react-three/drei';
import * as THREE from 'three';
import { Loader2 } from 'lucide-react';

export interface Detection3D {
  id: string;
  feature_type: string;
  confidence: number;
  coordinates: { x: number; y: number; z: number };
  metadata?: Record<string, unknown>;
}

export interface ModelViewer3DProps {
  detections: Detection3D[];
  selectedDetectionId: string | null;
  onDetectionSelect: (id: string) => void;
}

/** Color palette keyed by feature_type prefix */
const typeColors: Record<string, string> = {
  electrical: '#f59e0b', // amber
  plumbing: '#3b82f6',   // blue
  hvac: '#06b6d4',       // cyan
  structural: '#6b7280', // gray
  fixture: '#10b981',    // green
};

function colorForType(featureType: string): string {
  const key = Object.keys(typeColors).find((k) =>
    featureType.toLowerCase().startsWith(k),
  );
  return key ? typeColors[key] : '#9ca3af';
}

/* ------------------------------------------------------------------ */
/*  DetectionMarker                                                    */
/* ------------------------------------------------------------------ */

interface DetectionMarkerProps {
  detection: Detection3D;
  isSelected: boolean;
  onClick: () => void;
}

function DetectionMarker({ detection, isSelected, onClick }: DetectionMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const color = colorForType(detection.feature_type);
  const scale = isSelected ? 1.5 : hovered ? 1.2 : 1;

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y =
        detection.coordinates.y + Math.sin(state.clock.elapsedTime * 2) * 0.02;
    }
  });

  return (
    <group
      position={[
        detection.coordinates.x,
        detection.coordinates.y,
        detection.coordinates.z,
      ]}
    >
      {/* Main sphere */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
        scale={scale}
      >
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.5 : hovered ? 0.3 : 0.1}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.12, 0.15, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Tooltip on hover / select */}
      {(hovered || isSelected) && (
        <Html
          position={[0, 0.2, 0]}
          center
          distanceFactor={10}
          style={{ pointerEvents: 'none' }}
        >
          <div className="bg-gray-900/90 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
            <div className="font-medium">{detection.feature_type}</div>
            <div className="text-gray-300 text-[10px]">
              {(detection.confidence * 100).toFixed(0)}% confidence
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Scene                                                              */
/* ------------------------------------------------------------------ */

interface SceneProps {
  detections: Detection3D[];
  selectedDetectionId: string | null;
  onDetectionSelect: (id: string) => void;
}

function Scene({ detections, selectedDetectionId, onDetectionSelect }: SceneProps) {
  const bounds = detections.reduce(
    (acc, d) => ({
      minX: Math.min(acc.minX, d.coordinates.x),
      maxX: Math.max(acc.maxX, d.coordinates.x),
      minY: Math.min(acc.minY, d.coordinates.y),
      maxY: Math.max(acc.maxY, d.coordinates.y),
      minZ: Math.min(acc.minZ, d.coordinates.z),
      maxZ: Math.max(acc.maxZ, d.coordinates.z),
    }),
    { minX: 0, maxX: 5, minY: 0, maxY: 3, minZ: 0, maxZ: 5 },
  );

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[centerX + 5, 4, centerZ + 5]}
      />
      <OrbitControls
        target={[centerX, 1, centerZ]}
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={20}
      />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <directionalLight position={[-10, 10, -5]} intensity={0.5} />

      {/* Grid helper */}
      <Grid
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#6b7280"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#374151"
        fadeDistance={25}
        fadeStrength={1}
        followCamera={false}
        position={[centerX, 0, centerZ]}
      />

      {/* Click-to-deselect floor (invisible) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[centerX, -0.01, centerZ]}
        visible={false}
      >
        <planeGeometry args={[50, 50]} />
        <meshBasicMaterial />
      </mesh>

      {/* Detection markers */}
      {detections.map((detection) => (
        <DetectionMarker
          key={detection.id}
          detection={detection}
          isSelected={selectedDetectionId === detection.id}
          onClick={() => onDetectionSelect(detection.id)}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading fallback                                                   */
/* ------------------------------------------------------------------ */

function LoadingFallback() {
  return (
    <Html center>
      <div className="flex items-center gap-2 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading 3D viewer...</span>
      </div>
    </Html>
  );
}

/* ------------------------------------------------------------------ */
/*  ModelViewer3D (default export)                                     */
/* ------------------------------------------------------------------ */

export default function ModelViewer3D({
  detections,
  selectedDetectionId,
  onDetectionSelect,
}: ModelViewer3DProps) {
  return (
    <div className="w-full h-full min-h-[400px] rounded-lg overflow-hidden">
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#111827' }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <Scene
            detections={detections}
            selectedDetectionId={selectedDetectionId}
            onDetectionSelect={onDetectionSelect}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
