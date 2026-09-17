'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  RotateCw,
  Eye,
  Sparkles,
  Maximize2,
  RefreshCw,
  Layers,
  Palette,
  Info,
} from 'lucide-react';

export interface Shoe3DViewerProps {
  initialColor?: string;
  modelName?: string;
  className?: string;
  allowColorChange?: boolean;
}

const COLORWAYS = [
  { name: 'Obsidian Volt', primary: '#18181b', secondary: '#22c55e', sole: '#f4f4f5', accent: '#4ade80' },
  { name: 'Royal Velocity', primary: '#1d4ed8', secondary: '#93c5fd', sole: '#ffffff', accent: '#60a5fa' },
  { name: 'Crimson Carbon', primary: '#dc2626', secondary: '#18181b', sole: '#ffffff', accent: '#ef4444' },
  { name: 'Triple White', primary: '#f8fafc', secondary: '#e2e8f0', sole: '#ffffff', accent: '#cbd5e1' },
  { name: 'Sunset Bronze', primary: '#c2410c', secondary: '#fbbf24', sole: '#18181b', accent: '#f97316' },
];

export default function Shoe3DViewer({
  initialColor = '#18181b',
  modelName = 'StepStyle Pro V1',
  className = '',
  allowColorChange = true,
}: Shoe3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeColorway, setActiveColorway] = useState(COLORWAYS[0]);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isWireframe, setIsWireframe] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  // References to keep Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const shoeGroupRef = useRef<THREE.Group | null>(null);
  const materialsRef = useRef<{
    upper: THREE.MeshStandardMaterial;
    accent: THREE.MeshStandardMaterial;
    sole: THREE.MeshStandardMaterial;
    laces: THREE.MeshStandardMaterial;
    cushion: THREE.MeshPhysicalMaterial;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 420;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(3.2, 1.6, 3.8);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Lighting setup (Studio Showcase)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.bias = -0.001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xa5b4fc, 1.1);
    fillLight.position.set(-5, 3, -4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffedd5, 1.5);
    rimLight.position.set(0, -3, -5);
    scene.add(rimLight);

    // 4. Ground Shadow Plate
    const shadowGeo = new THREE.PlaneGeometry(8, 8);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.22 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.85;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Subtle Ground Glow
    const glowGeo = new THREE.CircleGeometry(2.2, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.08,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.rotation.x = -Math.PI / 2;
    glowMesh.position.y = -0.84;
    scene.add(glowMesh);

    // 5. Build Procedural 3D Athletic Sneaker
    const shoeGroup = new THREE.Group();
    shoeGroupRef.current = shoeGroup;

    // Materials
    const upperMat = new THREE.MeshStandardMaterial({
      color: activeColorway.primary,
      roughness: 0.45,
      metalness: 0.15,
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: activeColorway.accent,
      roughness: 0.3,
      metalness: 0.35,
    });

    const soleMat = new THREE.MeshStandardMaterial({
      color: activeColorway.sole,
      roughness: 0.6,
      metalness: 0.05,
    });

    const lacesMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
    });

    const cushionMat = new THREE.MeshPhysicalMaterial({
      color: activeColorway.secondary,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
      transmission: 0.6,
      thickness: 0.5,
    });

    materialsRef.current = {
      upper: upperMat,
      accent: accentMat,
      sole: soleMat,
      laces: lacesMat,
      cushion: cushionMat,
    };

    // --- SNEAKER SOLE & TREADS ---
    // Outsole base
    const soleShape = new THREE.Shape();
    soleShape.moveTo(-1.3, -0.4);
    soleShape.quadraticCurveTo(-0.4, -0.48, 1.4, -0.32);
    soleShape.quadraticCurveTo(1.65, 0.1, 1.4, 0.42);
    soleShape.quadraticCurveTo(-0.2, 0.48, -1.3, 0.35);
    soleShape.quadraticCurveTo(-1.5, -0.05, -1.3, -0.4);

    const extrudeSettings = {
      depth: 0.3,
      bevelEnabled: true,
      bevelSegments: 6,
      steps: 2,
      bevelSize: 0.08,
      bevelThickness: 0.08,
    };

    const soleGeo = new THREE.ExtrudeGeometry(soleShape, extrudeSettings);
    soleGeo.rotateX(Math.PI / 2);
    const soleMesh = new THREE.Mesh(soleGeo, soleMat);
    soleMesh.position.set(0, -0.65, 0);
    soleMesh.castShadow = true;
    soleMesh.receiveShadow = true;
    shoeGroup.add(soleMesh);

    // Cushion Capsule Window (Air-Unit)
    const airCushionGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.9, 16);
    airCushionGeo.rotateZ(Math.PI / 2);
    const airCushionMesh = new THREE.Mesh(airCushionGeo, cushionMat);
    airCushionMesh.position.set(-0.6, -0.52, 0);
    airCushionMesh.castShadow = true;
    shoeGroup.add(airCushionMesh);

    // --- SNEAKER UPPER BODY ---
    // Main upper mesh
    const upperGeo = new THREE.ConeGeometry(0.7, 2.2, 32);
    upperGeo.rotateZ(Math.PI / 2.3);
    upperGeo.scale(1.1, 0.75, 0.85);
    const upperMesh = new THREE.Mesh(upperGeo, upperMat);
    upperMesh.position.set(0.15, -0.05, 0);
    upperMesh.castShadow = true;
    shoeGroup.add(upperMesh);

    // Toe Cap curve
    const toeGeo = new THREE.SphereGeometry(0.55, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    toeGeo.scale(1.3, 0.65, 0.95);
    const toeMesh = new THREE.Mesh(toeGeo, accentMat);
    toeMesh.position.set(0.95, -0.28, 0);
    toeMesh.castShadow = true;
    shoeGroup.add(toeMesh);

    // Heel Counter & Collar
    const heelGeo = new THREE.CylinderGeometry(0.48, 0.55, 0.85, 24);
    const heelMesh = new THREE.Mesh(heelGeo, upperMat);
    heelMesh.position.set(-0.85, 0.02, 0);
    heelMesh.castShadow = true;
    shoeGroup.add(heelMesh);

    // Collar Padded Rim
    const collarGeo = new THREE.TorusGeometry(0.38, 0.09, 16, 32);
    collarGeo.rotateX(Math.PI / 2);
    const collarMesh = new THREE.Mesh(collarGeo, accentMat);
    collarMesh.position.set(-0.82, 0.44, 0);
    collarMesh.castShadow = true;
    shoeGroup.add(collarMesh);

    // Tongue
    const tongueGeo = new THREE.BoxGeometry(0.35, 0.95, 0.06);
    tongueGeo.rotateZ(Math.PI / 5.5);
    const tongueMesh = new THREE.Mesh(tongueGeo, accentMat);
    tongueMesh.position.set(-0.35, 0.28, 0);
    tongueMesh.castShadow = true;
    shoeGroup.add(tongueMesh);

    // Dynamic Lateral Swoosh / Accent Wings (Both Sides)
    const createSwoosh = (zOffset: number, flip: boolean) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.6, -0.15, zOffset),
        new THREE.Vector3(-0.1, -0.3, zOffset * 1.05),
        new THREE.Vector3(0.5, 0.05, zOffset * 0.9),
        new THREE.Vector3(0.9, -0.1, zOffset * 0.7),
      ]);
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.05, 8, false);
      const swooshMesh = new THREE.Mesh(tubeGeo, accentMat);
      swooshMesh.castShadow = true;
      return swooshMesh;
    };
    shoeGroup.add(createSwoosh(0.42, false));
    shoeGroup.add(createSwoosh(-0.42, true));

    // Laces (Crossbars)
    for (let i = 0; i < 4; i++) {
      const laceGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.46, 12);
      laceGeo.rotateX(Math.PI / 2);
      laceGeo.rotateZ(0.15);
      const laceMesh = new THREE.Mesh(laceGeo, lacesMat);
      laceMesh.position.set(-0.4 + i * 0.28, 0.08 + i * 0.08, 0);
      laceMesh.castShadow = true;
      shoeGroup.add(laceMesh);
    }

    // Centering and tilt
    shoeGroup.position.set(0, 0, 0);
    shoeGroup.rotation.y = Math.PI / 5;
    scene.add(shoeGroup);

    // 6. Interactive Drag / Orbit Controls
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetRotationY = shoeGroup.rotation.y;
    let targetRotationX = shoeGroup.rotation.x;
    let clock = new THREE.Clock();

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      setIsInteracting(true);
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      prevMouseX = clientX;
      prevMouseY = clientY;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - prevMouseX;
      const deltaY = clientY - prevMouseY;

      targetRotationY += deltaX * 0.009;
      targetRotationX = Math.max(-0.4, Math.min(0.6, targetRotationX + deltaY * 0.006));

      prevMouseX = clientX;
      prevMouseY = clientY;
    };

    const onPointerUp = () => {
      isDragging = false;
      setTimeout(() => setIsInteracting(false), 2000);
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    domElement.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // 7. Responsive Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width: newWidth, height: newHeight } = entry.contentRect;
        if (newWidth > 0 && newHeight > 0) {
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
        }
      }
    });
    resizeObserver.observe(container);

    // 8. Render Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      if (shoeGroup) {
        // Auto rotate when enabled and not dragging
        if (autoRotate && !isDragging) {
          targetRotationY += 0.008;
        }

        // Damped rotation interpolation
        shoeGroup.rotation.y += (targetRotationY - shoeGroup.rotation.y) * 0.08;
        shoeGroup.rotation.x += (targetRotationX - shoeGroup.rotation.x) * 0.08;

        // Elegant floating / bobbing effect
        shoeGroup.position.y = Math.sin(elapsedTime * 2) * 0.08;
        glowMesh.scale.setScalar(1 + Math.sin(elapsedTime * 2) * 0.06);
      }

      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      domElement.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      domElement.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);

      if (container.contains(domElement)) {
        container.removeChild(domElement);
      }
      renderer.dispose();
    };
  }, [autoRotate]);

  // Update materials when colorway or wireframe mode changes
  useEffect(() => {
    if (!materialsRef.current) return;
    const mats = materialsRef.current;

    mats.upper.color.set(activeColorway.primary);
    mats.upper.wireframe = isWireframe;

    mats.accent.color.set(activeColorway.accent);
    mats.accent.wireframe = isWireframe;

    mats.sole.color.set(activeColorway.sole);
    mats.sole.wireframe = isWireframe;

    mats.cushion.color.set(activeColorway.secondary);
    mats.cushion.wireframe = isWireframe;
  }, [activeColorway, isWireframe]);

  const resetView = () => {
    if (shoeGroupRef.current) {
      shoeGroupRef.current.rotation.set(0, Math.PI / 5, 0);
    }
  };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-slate-800 shadow-xl select-none ${className}`}
    >
      {/* 3D Canvas Viewport */}
      <div
        ref={containerRef}
        className="w-full h-[360px] sm:h-[420px] md:h-[480px] cursor-grab active:cursor-grabbing flex items-center justify-center"
      />

      {/* Top Header Badge */}
      <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/60 shadow-md">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span className="text-xs font-bold text-white tracking-wide">
            3D Studio Preview
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
            WebGL
          </span>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Wireframe toggle */}
          <button
            type="button"
            onClick={() => setIsWireframe(!isWireframe)}
            title={isWireframe ? 'Standard Shader' : 'Wireframe Geometry'}
            className={`p-2 rounded-xl border text-xs font-medium transition-all ${
              isWireframe
                ? 'bg-indigo-600 text-white border-indigo-400'
                : 'bg-slate-900/80 text-gray-300 border-slate-700/60 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          {/* Auto Rotate toggle */}
          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            title={autoRotate ? 'Pause Rotation' : 'Auto Rotate'}
            className={`p-2 rounded-xl border text-xs font-medium transition-all ${
              autoRotate
                ? 'bg-emerald-600 text-white border-emerald-400'
                : 'bg-slate-900/80 text-gray-300 border-slate-700/60 hover:text-white'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* Reset View */}
          <button
            type="button"
            onClick={resetView}
            title="Reset Perspective"
            className="p-2 rounded-xl bg-slate-900/80 text-gray-300 border border-slate-700/60 hover:text-white transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Drag Hint */}
      <div className="absolute bottom-16 sm:bottom-18 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[11px] text-gray-300 flex items-center gap-1.5 shadow-sm">
          <Eye className="w-3 h-3 text-indigo-400" />
          <span>Drag 360° to inspect details</span>
        </div>
      </div>

      {/* Bottom Colorway & Customizer Bar */}
      {allowColorChange && (
        <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <Palette className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-200 hidden sm:inline">
              Colorways:
            </span>
          </div>

          <div className="flex items-center gap-2">
            {COLORWAYS.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setActiveColorway(c)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  activeColorway.name === c.name
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'bg-slate-800/80 text-gray-300 hover:bg-slate-700'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full border border-white/30 shrink-0 shadow-xs"
                  style={{ backgroundColor: c.accent }}
                />
                <span className="text-[11px] whitespace-nowrap">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
