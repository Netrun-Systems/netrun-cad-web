import { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  PerspectiveCamera,
  Html,
} from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Loader2 } from 'lucide-react';
import type { PointCloudData } from '../../engine/pointcloud-loader';

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
  pointCloudData?: PointCloudData;
  meshUrl?: string; // URL to OBJ or GLB file
  showPointCloud?: boolean;
  pointSize?: number; // default 0.01
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
/*  PointCloudRenderer                                                 */
/* ------------------------------------------------------------------ */

function PointCloudRenderer({
  data,
  pointSize = 0.01,
}: {
  data: PointCloudData;
  pointSize?: number;
}) {
  const ref = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    if (data.colors) {
      geo.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
    }
    geo.computeBoundingSphere();
    return geo;
  }, [data]);

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={pointSize}
        vertexColors={!!data.colors}
        color={data.colors ? undefined : '#88ccff'}
        sizeAttenuation
        transparent
        opacity={0.85}
      />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/*  MeshRenderer — loads OBJ or GLB from a URL                        */
/* ------------------------------------------------------------------ */

function OBJMeshRenderer({ url }: { url: string }) {
  const obj = useLoader(OBJLoader, url);

  const cloned = useMemo(() => {
    const group = obj.clone();
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({
          color: '#8899aa',
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide,
          roughness: 0.7,
          metalness: 0.1,
        });
      }
    });
    return group;
  }, [obj]);

  return <primitive object={cloned} />;
}

function GLBMeshRenderer({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url);

  const cloned = useMemo(() => {
    const scene = gltf.scene.clone();
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({
          color: '#8899aa',
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide,
          roughness: 0.7,
          metalness: 0.1,
        });
      }
    });
    return scene;
  }, [gltf]);

  return <primitive object={cloned} />;
}

function MeshRenderer({ url }: { url: string }) {
  const ext = url.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'glb' || ext === 'gltf') {
    return <GLBMeshRenderer url={url} />;
  }
  // Default to OBJ
  return <OBJMeshRenderer url={url} />;
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
/*  ViewportControls — toggle overlays at bottom of 3D viewport        */
/* ------------------------------------------------------------------ */

interface ViewportControlsProps {
  showPoints: boolean;
  setShowPoints: (v: boolean) => void;
  showMesh: boolean;
  setShowMesh: (v: boolean) => void;
  showDetections: boolean;
  setShowDetections: (v: boolean) => void;
  pointSize: number;
  setPointSize: (v: number) => void;
  hasPointCloud: boolean;
  hasMesh: boolean;
}

function ViewportControls({
  showPoints,
  setShowPoints,
  showMesh,
  setShowMesh,
  showDetections,
  setShowDetections,
  pointSize,
  setPointSize,
  hasPointCloud,
  hasMesh,
}: ViewportControlsProps) {
  return (
    <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 bg-gray-900/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs pointer-events-auto">
      {/* Points toggle */}
      <label className={`flex items-center gap-1.5 cursor-pointer select-none ${!hasPointCloud ? 'opacity-40 pointer-events-none' : ''}`}>
        <input
          type="checkbox"
          checked={showPoints}
          onChange={(e) => setShowPoints(e.target.checked)}
          className="accent-cyan-400 w-3 h-3"
        />
        <span className="text-gray-300">Points</span>
      </label>

      {/* Mesh toggle */}
      <label className={`flex items-center gap-1.5 cursor-pointer select-none ${!hasMesh ? 'opacity-40 pointer-events-none' : ''}`}>
        <input
          type="checkbox"
          checked={showMesh}
          onChange={(e) => setShowMesh(e.target.checked)}
          className="accent-cyan-400 w-3 h-3"
        />
        <span className="text-gray-300">Mesh</span>
      </label>

      {/* Detections toggle */}
      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showDetections}
          onChange={(e) => setShowDetections(e.target.checked)}
          className="accent-cyan-400 w-3 h-3"
        />
        <span className="text-gray-300">Detections</span>
      </label>

      {/* Divider */}
      {hasPointCloud && <div className="w-px h-4 bg-gray-600" />}

      {/* Point size slider */}
      {hasPointCloud && (
        <label className="flex items-center gap-1.5 select-none">
          <span className="text-gray-400">Size</span>
          <input
            type="range"
            min={0.005}
            max={0.05}
            step={0.001}
            value={pointSize}
            onChange={(e) => setPointSize(parseFloat(e.target.value))}
            className="w-20 h-1 accent-cyan-400"
          />
          <span className="text-gray-500 w-8 text-right tabular-nums">
            {pointSize.toFixed(3)}
          </span>
        </label>
      )}

      {/* Point count badge */}
      {hasPointCloud && showPoints && (
        <>
          <div className="w-px h-4 bg-gray-600" />
          <span className="text-gray-500 tabular-nums">
            {hasPointCloud ? 'pts loaded' : ''}
          </span>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scene                                                              */
/* ------------------------------------------------------------------ */

interface SceneProps {
  detections: Detection3D[];
  selectedDetectionId: string | null;
  onDetectionSelect: (id: string) => void;
  pointCloudData?: PointCloudData;
  meshUrl?: string;
  showPoints: boolean;
  showMesh: boolean;
  showDetections: boolean;
  pointSize: number;
}

function Scene({
  detections,
  selectedDetectionId,
  onDetectionSelect,
  pointCloudData,
  meshUrl,
  showPoints,
  showMesh,
  showDetections,
  pointSize,
}: SceneProps) {
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
        maxDistance={50}
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

      {/* Point cloud */}
      {showPoints && pointCloudData && pointCloudData.count > 0 && (
        <PointCloudRenderer data={pointCloudData} pointSize={pointSize} />
      )}

      {/* Mesh model */}
      {showMesh && meshUrl && (
        <Suspense fallback={null}>
          <MeshRenderer url={meshUrl} />
        </Suspense>
      )}

      {/* Detection markers */}
      {showDetections &&
        detections.map((detection) => (
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
  pointCloudData,
  meshUrl,
  showPointCloud: showPointCloudProp,
  pointSize: pointSizeProp = 0.01,
}: ModelViewer3DProps) {
  const [showPoints, setShowPoints] = useState(showPointCloudProp ?? true);
  const [showMesh, setShowMesh] = useState(true);
  const [showDetections, setShowDetections] = useState(true);
  const [pointSize, setPointSize] = useState(pointSizeProp);

  const hasPointCloud = !!(pointCloudData && pointCloudData.count > 0);
  const hasMesh = !!meshUrl;

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden">
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
            pointCloudData={pointCloudData}
            meshUrl={meshUrl}
            showPoints={showPoints}
            showMesh={showMesh}
            showDetections={showDetections}
            pointSize={pointSize}
          />
        </Suspense>
      </Canvas>

      {/* Viewport toggle controls */}
      <ViewportControls
        showPoints={showPoints}
        setShowPoints={setShowPoints}
        showMesh={showMesh}
        setShowMesh={setShowMesh}
        showDetections={showDetections}
        setShowDetections={setShowDetections}
        pointSize={pointSize}
        setPointSize={setPointSize}
        hasPointCloud={hasPointCloud}
        hasMesh={hasMesh}
      />
    </div>
  );
}
