import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Building, Floor, RouteResult, Room, Point } from '../../types';
import { polygonCentroid, polygonAreaInSquareMeters } from '../../utils/geometry';
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Sliders,
  Layers,
  ArrowUpRight,
  Box,
  Play,
  Pause,
  Eye,
} from 'lucide-react';

export type View3DMode = 'solid' | 'glass' | 'focus';

interface Isometric3DViewProps {
  building: Building;
  activeFloorId: string;
  routeResult: RouteResult | null;
  onSelectFloor: (floorId: string) => void;
  onNavigateTo2DEditor: (floorId: string) => void;
  onSetStartRoom?: (roomId: string) => void;
  onSetTargetRoom?: (roomId: string) => void;
  className?: string;
}

/**
 * Creates a crisp 3D Canvas Text Sprite in Three.js that always faces the camera
 * and renders text/badges directly on top of 3D objects.
 */
function createTextSprite(
  text: string,
  options: {
    bgColor?: string;
    textColor?: string;
    fontSize?: number;
    borderColor?: string;
    borderWidth?: number;
    scale?: number;
    depthTest?: boolean;
  } = {}
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const fontSize = options.fontSize || 22;
  ctx.font = `Bold ${fontSize}px sans-serif, monospace`;

  const textMetrics = ctx.measureText(text);
  const textWidth = textMetrics.width;
  const paddingX = 14;
  const paddingY = 8;
  canvas.width = Math.ceil(textWidth + paddingX * 2);
  canvas.height = Math.ceil(fontSize + paddingY * 2);

  // Redraw font context after canvas resize
  ctx.font = `Bold ${fontSize}px sans-serif, monospace`;

  const r = 6;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = options.bgColor || 'rgba(26, 60, 43, 0.92)';
  ctx.strokeStyle = options.borderColor || '#FFFFFF';
  ctx.lineWidth = options.borderWidth || 2;

  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();

  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = options.textColor || '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    depthTest: options.depthTest !== undefined ? options.depthTest : false,
    transparent: true,
  });

  const sprite = new THREE.Sprite(spriteMaterial);
  const scale = options.scale || 0.55;
  sprite.scale.set(canvas.width * scale, canvas.height * scale, 1);
  return sprite;
}

export const Isometric3DView: React.FC<Isometric3DViewProps> = ({
  building,
  activeFloorId,
  routeResult,
  onSelectFloor,
  onNavigateTo2DEditor,
  onSetStartRoom,
  onSetTargetRoom,
  className = '',
}) => {
  // 3D View Settings State
  const [view3DMode, setView3DMode] = useState<View3DMode>('solid');
  const [isExploded, setIsExploded] = useState<boolean>(false);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(false);
  const [autoRotateSpeed, setAutoRotateSpeed] = useState<number>(0.6); // 0.1 to 4.0x
  const [floorSpacing, setFloorSpacing] = useState<number>(220); // vertical distance in Three.js units
  const [wallHeight, setWallHeight] = useState<number>(35); // 3D wall height in units
  const [showSlidersPanel, setShowSlidersPanel] = useState<boolean>(false);

  // Interactive 3D Room Hover & Selection State
  const [hoveredRoom, setHoveredRoom] = useState<{ room: Room; floor: Floor } | null>(null);
  const [selectedRoom3D, setSelectedRoom3D] = useState<{ room: Room; floor: Floor } | null>(null);

  // DOM Refs & Three.js Instance References
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Mesh map references for 3D animation & raycasting
  const roomMeshesRef = useRef<Map<string, { mesh: THREE.Mesh; room: Room; floor: Floor }>>(new Map());
  const floorGroupsRef = useRef<Map<string, THREE.Group>>(new Map());
  const routeGroupRef = useRef<THREE.Group | null>(null);

  // Sorted floors (bottom ground level 0 to top level N)
  const sortedFloors = useMemo(() => {
    return [...building.floors].sort((a, b) => {
      const elevA = a.elevationMeters ?? a.level ?? 0;
      const elevB = b.elevationMeters ?? b.level ?? 0;
      if (elevA !== elevB) return elevA - elevB;
      return (a.level ?? 0) - (b.level ?? 0);
    });
  }, [building]);

  // Center offset calculations so building is centered at (0, 0, 0)
  const buildingDimensions = useMemo(() => {
    let maxW = 800;
    let maxH = 600;
    building.floors.forEach((f) => {
      if (f.width > maxW) maxW = f.width;
      if (f.height > maxH) maxH = f.height;
    });
    return { width: maxW, height: maxH };
  }, [building]);

  // ── INITIALIZE THREE.JS CANVAS & SCENE ─────────────────────────────────────
  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    const width = mountEl.clientWidth || window.innerWidth;
    const height = mountEl.clientHeight || window.innerHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xefefea);
    scene.fog = new THREE.FogExp2(0xefefea, 0.0003);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 10, 15000);
    camera.position.set(900, 1100, 1200);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mountEl.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Orbit Controls (Gentle, smooth rotation speed)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.45; // Controlled, smooth dragging speed
    controls.zoomSpeed = 0.8;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go under ground plane
    controls.minDistance = 200;
    controls.maxDistance = 5000;
    controls.target.set(0, (sortedFloors.length * 200) / 2, 0);
    controls.update();
    controlsRef.current = controls;

    // 5. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(1200, 1800, 1000);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 500;
    dirLight.shadow.camera.far = 4000;
    const shadowD = 1200;
    dirLight.shadow.camera.left = -shadowD;
    dirLight.shadow.camera.right = shadowD;
    dirLight.shadow.camera.top = shadowD;
    dirLight.shadow.camera.bottom = -shadowD;
    scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1a3c2b, 0.4);
    scene.add(hemiLight);

    // 6. Ground Grid Base
    const gridHelper = new THREE.GridHelper(3000, 60, 0x1a3c2b, 0xd0d0c7);
    gridHelper.position.y = -10;
    scene.add(gridHelper);

    // Render loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle Resize
    const handleResize = () => {
      if (!mountEl || !renderer || !camera) return;
      const w = mountEl.clientWidth;
      const h = mountEl.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (renderer.domElement && mountEl.contains(renderer.domElement)) {
        mountEl.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // ── AUTO-ROTATE CAMERA LOOP (Configurable speed) ───────────────────────────
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = isAutoRotating;
      controlsRef.current.autoRotateSpeed = autoRotateSpeed;
    }
  }, [isAutoRotating, autoRotateSpeed]);

  // ── BUILD REAL 3D MESH SCENE & 3D TEXT LABELS ──────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear previous floor groups & room mesh maps
    floorGroupsRef.current.forEach((g) => scene.remove(g));
    floorGroupsRef.current.clear();
    roomMeshesRef.current.clear();

    const halfW = buildingDimensions.width / 2;
    const halfH = buildingDimensions.height / 2;

    sortedFloors.forEach((floor, index) => {
      const floorGroup = new THREE.Group();
      floorGroup.name = `floor-${floor.id}`;
      const targetElevation = index * (isExploded ? floorSpacing * 1.7 : floorSpacing);
      floorGroup.position.y = targetElevation;
      floorGroupsRef.current.set(floor.id, floorGroup);

      const isActive = floor.id === activeFloorId;
      const isTraversed = routeResult?.floorsTraversed.includes(floor.id);

      // Determine Opacity & Visibility based on 3D View Mode
      let floorOpacity = 0.95;
      let wallOpacity = 0.92;
      let isWireframe = false;

      if (view3DMode === 'glass') {
        floorOpacity = 0.4;
        wallOpacity = 0.45;
      } else if (view3DMode === 'focus') {
        if (!isActive) {
          floorOpacity = 0.18;
          wallOpacity = 0.18;
          isWireframe = true;
        }
      }

      // 1. FLOOR BASE SLAB (Real 3D Extruded Box)
      const slabThickness = 12;
      const slabGeo = new THREE.BoxGeometry(floor.width + 40, slabThickness, floor.height + 40);
      const slabMat = new THREE.MeshStandardMaterial({
        color: isActive ? 0xffffff : isTraversed ? 0xe6f4ea : 0xf7f7f5,
        roughness: 0.4,
        metalness: 0.1,
        transparent: true,
        opacity: floorOpacity,
        wireframe: isWireframe,
      });
      const slabMesh = new THREE.Mesh(slabGeo, slabMat);
      slabMesh.position.set(0, -slabThickness / 2, 0);
      slabMesh.receiveShadow = true;
      floorGroup.add(slabMesh);

      // Slab Edge Border Line
      const slabEdgeGeo = new THREE.EdgesGeometry(slabGeo);
      const slabEdgeMat = new THREE.LineBasicMaterial({
        color: isActive ? 0x047857 : 0x1a3c2b,
        linewidth: isActive ? 2 : 1,
        transparent: true,
        opacity: floorOpacity,
      });
      const slabEdgeLine = new THREE.LineSegments(slabEdgeGeo, slabEdgeMat);
      slabEdgeLine.position.copy(slabMesh.position);
      floorGroup.add(slabEdgeLine);

      // 3D FLOOR LEVEL BADGE SPRITE (Front corner of slab)
      const floorBadge = createTextSprite(`${floor.shortCode} • ${floor.name} (+${floor.elevationMeters.toFixed(1)}m)`, {
        bgColor: isActive ? '#047857' : 'rgba(26, 60, 43, 0.88)',
        textColor: '#FFFFFF',
        fontSize: 24,
        scale: 0.7,
      });
      floorBadge.position.set(-halfW + 100, wallHeight + 35, halfH + 30);
      floorGroup.add(floorBadge);

      // 2. ROOMS LAYER (True 3D Extruded Solids + 3D Text Label Sprites)
      floor.rooms.forEach((room) => {
        if (room.polygon.length < 3) return;

        const shape = new THREE.Shape();
        room.polygon.forEach((pt, idx) => {
          const x = pt.x - halfW;
          const z = pt.y - halfH;
          if (idx === 0) shape.moveTo(x, z);
          else shape.lineTo(x, z);
        });
        shape.closePath();

        const extrudeSettings = {
          depth: wallHeight,
          bevelEnabled: true,
          bevelThickness: 1,
          bevelSize: 1,
          bevelSegments: 2,
        };
        const roomGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        roomGeo.rotateX(Math.PI / 2); // Rotate so extrusion goes UP (+Y)

        let colorHex = 0x1a3c2b;
        if (room.category === 'classroom') colorHex = 0x0e7490;
        if (room.category === 'auditorium') colorHex = 0xd97706;
        if (room.category === 'office') colorHex = 0x475569;
        if (room.category === 'restroom') colorHex = 0x0284c7;
        if (room.category === 'cafeteria') colorHex = 0xf43f5e;
        if (room.category === 'entrance') colorHex = 0x047857;

        const roomMat = new THREE.MeshStandardMaterial({
          color: colorHex,
          roughness: 0.3,
          metalness: 0.1,
          transparent: true,
          opacity: wallOpacity * 0.75,
          wireframe: isWireframe,
        });

        const roomMesh = new THREE.Mesh(roomGeo, roomMat);
        roomMesh.castShadow = true;
        roomMesh.receiveShadow = true;
        floorGroup.add(roomMesh);

        // Store reference for raycasting & hover
        roomMeshesRef.current.set(room.id, { mesh: roomMesh, room, floor });

        // Room 3D Edges
        const roomEdgesGeo = new THREE.EdgesGeometry(roomGeo);
        const roomEdgesMat = new THREE.LineBasicMaterial({
          color: 0x1a3c2b,
          transparent: true,
          opacity: wallOpacity,
        });
        const roomEdgesLine = new THREE.LineSegments(roomEdgesGeo, roomEdgesMat);
        floorGroup.add(roomEdgesLine);

        // 3D ROOM CODE & NAME TEXT SPRITE (Floating directly above room roof)
        const centroid = polygonCentroid(room.polygon);
        const rx = centroid.x - halfW;
        const rz = centroid.y - halfH;

        const labelText = room.code ? `${room.code} ${room.name}` : room.name;
        const displayLabel = labelText.length > 22 ? `${labelText.slice(0, 20)}…` : labelText;

        const roomSprite = createTextSprite(displayLabel, {
          bgColor: isActive ? 'rgba(26, 60, 43, 0.92)' : 'rgba(30, 41, 59, 0.85)',
          textColor: '#F7F7F5',
          fontSize: 20,
          scale: 0.48,
        });
        roomSprite.position.set(rx, wallHeight + 22, rz);
        floorGroup.add(roomSprite);
      });

      // 3. WALLS LAYER (True 3D Wall Blocks)
      floor.walls.forEach((wall) => {
        const p1 = { x: wall.start.x - halfW, z: wall.start.y - halfH };
        const p2 = { x: wall.end.x - halfW, z: wall.end.y - halfH };
        const len = Math.hypot(p2.x - p1.x, p2.z - p1.z);
        if (len === 0) return;

        const angle = Math.atan2(p2.z - p1.z, p2.x - p1.x);
        const midX = (p1.x + p2.x) / 2;
        const midZ = (p1.z + p2.z) / 2;

        const wallGeo = new THREE.BoxGeometry(len, wallHeight + 4, wall.thickness * 1.5);
        const wallMat = new THREE.MeshStandardMaterial({
          color: 0x1a3c2b,
          roughness: 0.6,
          metalness: 0.2,
          transparent: true,
          opacity: wallOpacity,
          wireframe: isWireframe,
        });
        const wallMesh = new THREE.Mesh(wallGeo, wallMat);
        wallMesh.position.set(midX, (wallHeight + 4) / 2, midZ);
        wallMesh.rotation.y = -angle;
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        floorGroup.add(wallMesh);
      });

      // 4. DOORS LAYER & SPECIAL BEJÁRAT/VÉSZKIJÁRAT 3D MESHES & SPRITES
      floor.doors.forEach((door) => {
        const p1 = { x: door.start.x - halfW, z: door.start.y - halfH };
        const p2 = { x: door.end.x - halfW, z: door.end.y - halfH };
        const len = Math.hypot(p2.x - p1.x, p2.z - p1.z);
        const doorLength = len > 0 ? len : 32;

        const angle = Math.atan2(p2.z - p1.z, p2.x - p1.x);
        const doorMid = { x: (p1.x + p2.x) / 2, z: (p1.z + p2.z) / 2 };

        const isSpecial = door.type === 'entrance' || door.type === 'fire_exit' || door.type === 'accessible_entrance' || door.type === 'exit' || (door.name && door.name.length > 0);

        // 3D Door Mesh oriented and rotated along the exact wall vector
        const doorGeo = new THREE.BoxGeometry(doorLength, wallHeight, 8);
        const doorMat = new THREE.MeshStandardMaterial({
          color: isSpecial
            ? (door.type === 'fire_exit' ? 0xb91c1c : door.type === 'accessible_entrance' ? 0x0284c7 : 0x047857)
            : 0xffffff,
          roughness: 0.2,
          metalness: 0.1,
          transparent: true,
          opacity: wallOpacity,
        });
        const doorMesh = new THREE.Mesh(doorGeo, doorMat);
        doorMesh.position.set(doorMid.x, wallHeight / 2, doorMid.z);
        doorMesh.rotation.y = -angle; // Align door rotation perfectly to wall angle
        doorMesh.castShadow = true;
        doorMesh.receiveShadow = true;
        floorGroup.add(doorMesh);

        if (isSpecial) {
          const badgeText = door.name || (
            door.type === 'entrance' ? '🚪 FŐBEJÁRAT' :
            door.type === 'fire_exit' ? '🚨 VÉSZKIJÁRAT' :
            door.type === 'accessible_entrance' ? '♿ AKADÁLYMENTES' : '🚪 KIJÁRAT'
          );
          const doorSprite = createTextSprite(badgeText, {
            bgColor: door.type === 'fire_exit' ? '#B91C1C' : door.type === 'accessible_entrance' ? '#0284C7' : '#047857',
            textColor: '#FFFFFF',
            fontSize: 20,
            scale: 0.55,
          });
          doorSprite.position.set(doorMid.x, wallHeight + 35, doorMid.z);
          floorGroup.add(doorSprite);
        }
      });

      // 5. TRANSIT CONNECTORS (3D Vertical Shaft Columns + 3D Text Badges)
      floor.transitConnectors.forEach((t) => {
        const isElevator = t.type === 'elevator';
        const tx = t.position.x - halfW;
        const tz = t.position.y - halfH;

        const shaftGeo = new THREE.BoxGeometry(44, wallHeight + 20, 44);
        const shaftMat = new THREE.MeshStandardMaterial({
          color: isElevator ? 0x0e7490 : 0xb45309,
          roughness: 0.2,
          metalness: 0.4,
          transparent: true,
          opacity: 0.85,
        });
        const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
        shaftMesh.position.set(tx, (wallHeight + 20) / 2, tz);
        shaftMesh.castShadow = true;
        floorGroup.add(shaftMesh);

        const transitSprite = createTextSprite(isElevator ? '🛗 LIFT' : '🪜 LÉPCSŐ', {
          bgColor: isElevator ? '#0E7490' : '#B45309',
          textColor: '#FFFFFF',
          fontSize: 20,
          scale: 0.5,
        });
        transitSprite.position.set(tx, wallHeight + 38, tz);
        floorGroup.add(transitSprite);
      });

      scene.add(floorGroup);
    });
  }, [building, sortedFloors, activeFloorId, view3DMode, isExploded, floorSpacing, wallHeight, routeResult, buildingDimensions]);

  // ── RENDER 3D MULTI-FLOOR ROUTE TUBE ───────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (routeGroupRef.current) {
      scene.remove(routeGroupRef.current);
      routeGroupRef.current = null;
    }

    if (!routeResult || routeResult.pathNodes.length < 2) return;

    const routeGroup = new THREE.Group();
    routeGroup.name = 'route-3d-path';
    const halfW = buildingDimensions.width / 2;
    const halfH = buildingDimensions.height / 2;

    const points3D: THREE.Vector3[] = [];
    routeResult.pathNodes.forEach((node) => {
      const floorIdx = sortedFloors.findIndex((f) => f.id === node.floorId);
      const targetIndex = floorIdx >= 0 ? floorIdx : 0;
      const yElev = targetIndex * (isExploded ? floorSpacing * 1.7 : floorSpacing) + wallHeight + 16;
      const x = node.position.x - halfW;
      const z = node.position.y - halfH;
      points3D.push(new THREE.Vector3(x, yElev, z));
    });

    // 3D Tube Path Geometry
    try {
      const curve = new THREE.CatmullRomCurve3(points3D, false, 'catmullrom', 0.2);
      const tubeGeo = new THREE.TubeGeometry(curve, points3D.length * 8, 5, 10, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0x047857,
        emissive: 0x047857,
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.8,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      routeGroup.add(tubeMesh);

      // 3D Waypoint Nodes Spheres & End Text Badges
      points3D.forEach((pt, idx) => {
        const isStart = idx === 0;
        const isEnd = idx === points3D.length - 1;
        const nodeGeo = new THREE.SphereGeometry(isStart || isEnd ? 14 : 7, 16, 16);
        const nodeMat = new THREE.MeshStandardMaterial({
          color: isStart ? 0x047857 : isEnd ? 0xb91c1c : 0x0284c7,
          emissive: isStart ? 0x047857 : isEnd ? 0xb91c1c : 0x0284c7,
          emissiveIntensity: 0.9,
        });
        const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
        nodeMesh.position.copy(pt);
        routeGroup.add(nodeMesh);

        if (isStart) {
          const startSprite = createTextSprite('● INDULÁSI PONT', {
            bgColor: '#047857',
            textColor: '#FFFFFF',
            fontSize: 22,
            scale: 0.65,
          });
          startSprite.position.set(pt.x, pt.y + 35, pt.z);
          routeGroup.add(startSprite);
        }
        if (isEnd) {
          const endSprite = createTextSprite('★ CÉLÁLLOMÁS', {
            bgColor: '#B91C1C',
            textColor: '#FFFFFF',
            fontSize: 22,
            scale: 0.65,
          });
          endSprite.position.set(pt.x, pt.y + 35, pt.z);
          routeGroup.add(endSprite);
        }
      });

      scene.add(routeGroup);
      routeGroupRef.current = routeGroup;
    } catch {
      // Fallback if curve fails
    }
  }, [routeResult, sortedFloors, isExploded, floorSpacing, wallHeight, buildingDimensions]);

  // ── RAYCASTING (3D ROOM HOVER & CLICK DETECTOR) ───────────────────────────
  const handlePointerMoveContainer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const mountEl = mountRef.current;
    const camera = cameraRef.current;
    if (!mountEl || !camera) return;

    const rect = mountEl.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

    const meshes = Array.from(roomMeshesRef.current.values()).map((v) => v.mesh);
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as THREE.Mesh;
      for (const entry of roomMeshesRef.current.values()) {
        if (entry.mesh === hitMesh) {
          setHoveredRoom({ room: entry.room, floor: entry.floor });
          return;
        }
      }
    } else {
      setHoveredRoom(null);
    }
  }, []);

  const handleClickContainer = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (hoveredRoom) {
      setSelectedRoom3D(hoveredRoom);
    } else {
      setSelectedRoom3D(null);
    }
  }, [hoveredRoom]);

  // Camera presets
  const setCameraPreset = (preset: 'isometric' | 'front' | 'side' | 'top') => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const targetY = (sortedFloors.length * floorSpacing) / 2;
    controls.target.set(0, targetY, 0);

    if (preset === 'isometric') {
      camera.position.set(900, targetY + 900, 1100);
    } else if (preset === 'front') {
      camera.position.set(0, targetY + 300, 1600);
    } else if (preset === 'side') {
      camera.position.set(1600, targetY + 300, 0);
    } else if (preset === 'top') {
      camera.position.set(0, targetY + 1800, 10);
    }
    controls.update();
  };

  return (
    <div
      ref={mountRef}
      onPointerMove={handlePointerMoveContainer}
      onClick={handleClickContainer}
      className={`relative w-full h-full bg-[#EFEFEA] overflow-hidden select-none border border-[#1A3C2B] ${className}`}
      style={{ touchAction: 'none' }}
    >
      {/* 3D HUD Top Left Title */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 pointer-events-auto">
        <div className="bg-[#F7F7F5] border border-[#1A3C2B] px-3.5 py-2 flex items-center gap-3 shadow-xs">
          <div className="w-3 h-3 bg-[#1A3C2B] rotate-45" />
          <div className="flex flex-col font-mono text-[11px] leading-tight">
            <span className="font-bold tracking-wider text-[#1A3C2B] uppercase flex items-center gap-2">
              <span>{building.name}</span>
              <span className="px-1.5 py-0.2 bg-[#047857] text-white text-[9px] font-bold">WEBGL 3D TÉRBELI NÉZET</span>
            </span>
            <span className="text-[#1A3C2B]/70 text-[9px] mt-0.5">
              {building.floors.length} SZINT • FINOMÍTOTTAAN SIMA FORGATÁS (ROTATION SPEED: 0.45)
            </span>
          </div>
        </div>
      </div>

      {/* 3D Render Mode Quick Selector (Top Center) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-[#F7F7F5] border border-[#1A3C2B] p-1 font-mono text-xs shadow-xs pointer-events-auto">
        <button
          onClick={() => setView3DMode('solid')}
          className={`px-2.5 py-1 text-[10px] font-bold flex items-center gap-1.5 transition-colors ${
            view3DMode === 'solid'
              ? 'bg-[#1A3C2B] text-white'
              : 'bg-white text-[#1A3C2B] hover:bg-[#F0F5F2]'
          }`}
          title="Tömör 3D építészeti falak és szobavolumenek"
        >
          <Box className="w-3 h-3" />
          <span>ÉPÍTÉSZETI 3D</span>
        </button>
        <button
          onClick={() => setView3DMode('glass')}
          className={`px-2.5 py-1 text-[10px] font-bold flex items-center gap-1.5 transition-colors ${
            view3DMode === 'glass'
              ? 'bg-[#1A3C2B] text-white'
              : 'bg-white text-[#1A3C2B] hover:bg-[#F0F5F2]'
          }`}
          title="Átlátszó üveg modell a többszintes útvonalak áttekintéséhez"
        >
          <Eye className="w-3 h-3 text-cyan-600" />
          <span>ÜVEG / X-RAY</span>
        </button>
        <button
          onClick={() => setView3DMode('focus')}
          className={`px-2.5 py-1 text-[10px] font-bold flex items-center gap-1.5 transition-colors ${
            view3DMode === 'focus'
              ? 'bg-[#1A3C2B] text-white'
              : 'bg-white text-[#1A3C2B] hover:bg-[#F0F5F2]'
          }`}
          title="Csak az aktív szint kiemelése, többi szint elhalványítása"
        >
          <Layers className="w-3 h-3 text-emerald-600" />
          <span>FÓKUSZ SZINT</span>
        </button>
      </div>

      {/* 3D Floating Camera Controls (Right Top Bar) */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-[#F7F7F5] border border-[#1A3C2B] p-1.5 font-mono text-xs shadow-xs pointer-events-auto">
        <button
          onClick={() => setIsAutoRotating(!isAutoRotating)}
          className={`px-2.5 py-1 border transition-colors flex items-center gap-1 text-[11px] font-bold ${
            isAutoRotating
              ? 'bg-[#047857] text-white border-[#047857]'
              : 'bg-white text-[#1A3C2B] border-[#1A3C2B]/40 hover:bg-[#F0F5F2]'
          }`}
          title="Kamera automata 360°-os körbe-forgatása"
        >
          {isAutoRotating ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          <span>{isAutoRotating ? 'FORGATÁS STOP' : '360° KÖRBEN'}</span>
        </button>

        {/* Quick Speed Pills */}
        <div className="flex items-center border border-[#1A3C2B]/30 bg-white p-0.5 text-[10px]">
          {[0.2, 0.6, 1.5, 3.0].map((spd) => (
            <button
              key={spd}
              onClick={() => {
                setAutoRotateSpeed(spd);
                if (!isAutoRotating) setIsAutoRotating(true);
              }}
              className={`px-1.5 py-0.5 font-bold transition-colors ${
                autoRotateSpeed === spd
                  ? 'bg-[#1A3C2B] text-white'
                  : 'text-[#1A3C2B] hover:bg-[#F0F5F2]'
              }`}
              title={`Forgatási sebesség beállítása: ${spd}x`}
            >
              {spd}x
            </button>
          ))}
        </div>

        <button
          onClick={() => setIsExploded(!isExploded)}
          className={`px-2.5 py-1 border transition-colors flex items-center gap-1 text-[11px] font-bold ${
            isExploded
              ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
              : 'bg-white text-[#1A3C2B] border-[#1A3C2B]/40 hover:bg-[#F0F5F2]'
          }`}
          title="Szintek függőleges széthúzása"
        >
          <span>{isExploded ? 'KOMPAKT' : 'SZÉTHÚZÁS'}</span>
        </button>

        <button
          onClick={() => setShowSlidersPanel(!showSlidersPanel)}
          className={`p-1.5 border transition-colors ${
            showSlidersPanel
              ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
              : 'bg-white text-[#1A3C2B] border-[#1A3C2B]/40 hover:bg-[#F0F5F2]'
          }`}
          title="Vezérlőpult csúszkák"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Sliders Control Panel */}
      {showSlidersPanel && (
        <div className="absolute top-14 right-3 z-30 bg-[#F7F7F5] border-2 border-[#1A3C2B] p-3 shadow-xl w-64 flex flex-col gap-2.5 font-mono text-xs pointer-events-auto">
          <div className="flex items-center justify-between border-b border-[#1A3C2B]/20 pb-1">
            <span className="font-bold text-[10px] uppercase">3D FALMAGASSÁG & SEBESSÉG</span>
            <button onClick={() => setShowSlidersPanel(false)} className="text-[#1A3C2B]/60 hover:text-[#1A3C2B]">✕</button>
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-[9px] font-bold">
              <span>FORGATÁSI SEBESSÉG:</span>
              <span>{autoRotateSpeed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="4.0"
              step="0.1"
              value={autoRotateSpeed}
              onChange={(e) => setAutoRotateSpeed(parseFloat(e.target.value))}
              className="accent-[#1A3C2B]"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-[9px] font-bold">
              <span>3D FALMAGASSÁG:</span>
              <span>{wallHeight}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="70"
              value={wallHeight}
              onChange={(e) => setWallHeight(parseInt(e.target.value))}
              className="accent-[#1A3C2B]"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-[9px] font-bold">
              <span>SZINTEK KÖZTÁVOLSÁGA:</span>
              <span>{floorSpacing}px</span>
            </div>
            <input
              type="range"
              min="100"
              max="450"
              step="10"
              value={floorSpacing}
              onChange={(e) => setFloorSpacing(parseInt(e.target.value))}
              className="accent-[#1A3C2B]"
            />
          </div>
        </div>
      )}

      {/* Preset Camera Views (Bottom Left - Hidden on very small screens) */}
      <div className="absolute bottom-3 left-3 z-20 hidden md:flex items-center gap-1 bg-[#F7F7F5] border border-[#1A3C2B] p-1 font-mono text-[9px] shadow-xs pointer-events-auto">
        <span className="font-bold text-[#1A3C2B] px-1">KAMERA:</span>
        <button
          onClick={() => setCameraPreset('isometric')}
          className="px-2 py-1 bg-white border border-[#1A3C2B]/30 hover:bg-[#1A3C2B] hover:text-white transition-colors font-bold"
        >
          IZOMETRIKUS
        </button>
        <button
          onClick={() => setCameraPreset('front')}
          className="px-2 py-1 bg-white border border-[#1A3C2B]/30 hover:bg-[#1A3C2B] hover:text-white transition-colors font-bold"
        >
          ELŐL
        </button>
        <button
          onClick={() => setCameraPreset('side')}
          className="px-2 py-1 bg-white border border-[#1A3C2B]/30 hover:bg-[#1A3C2B] hover:text-white transition-colors font-bold"
        >
          OLDALT
        </button>
        <button
          onClick={() => setCameraPreset('top')}
          className="px-2 py-1 bg-white border border-[#1A3C2B]/30 hover:bg-[#1A3C2B] hover:text-white transition-colors font-bold"
        >
          FELÜL
        </button>
      </div>

      {/* Floor Stack Selector (Bottom Right) */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1 bg-[#F7F7F5] border border-[#1A3C2B] p-1.5 max-w-[170px] sm:max-w-xs font-mono text-xs shadow-xs pointer-events-auto">
        <span className="text-[8px] uppercase font-bold text-[#1A3C2B]/70 border-b border-[#1A3C2B]/20 pb-0.5">
          SZINTEK & 2D UGRÁS
        </span>
        <div className="flex flex-col gap-1 mt-0.5 max-h-32 sm:max-h-40 overflow-y-auto">
          {[...sortedFloors].reverse().map((floor) => {
            const isActive = floor.id === activeFloorId;
            const isTraversed = routeResult?.floorsTraversed.includes(floor.id);
            return (
              <div
                key={floor.id}
                className={`flex items-center justify-between p-1 border transition-all ${
                  isActive
                    ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                    : isTraversed
                    ? 'bg-emerald-50 border-emerald-600 text-[#1A3C2B]'
                    : 'bg-white text-[#1A3C2B] border-[#D0D0C7] hover:border-[#1A3C2B]'
                }`}
              >
                <button
                  onClick={() => onSelectFloor(floor.id)}
                  className="flex items-center gap-1 text-left flex-1 min-w-0"
                >
                  <span className="font-bold text-[9px] px-1 bg-[#1A3C2B]/20">{floor.shortCode}</span>
                  <span className="truncate text-[10px] font-sans font-medium">{floor.name}</span>
                </button>

                <button
                  onClick={() => onNavigateTo2DEditor(floor.id)}
                  className={`p-1 border text-[9px] ml-1 transition-colors ${
                    isActive
                      ? 'border-white text-white hover:bg-white hover:text-[#1A3C2B]'
                      : 'border-[#1A3C2B] text-[#1A3C2B] hover:bg-[#1A3C2B] hover:text-white'
                  }`}
                  title="Megnyitás a 2D CAD szerkesztőben"
                >
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating 3D Room Inspection Popover */}
      {(hoveredRoom || selectedRoom3D) && (() => {
        const target = selectedRoom3D || hoveredRoom;
        if (!target) return null;
        const area = polygonAreaInSquareMeters(target.room.polygon);
        return (
          <div className="absolute top-14 left-3 right-3 sm:right-auto sm:max-w-xs z-30 bg-white border-2 border-[#1A3C2B] p-3 shadow-2xl font-mono text-xs flex flex-col gap-1.5 animate-in fade-in zoom-in-95 pointer-events-auto">
            <div className="flex items-center justify-between border-b border-[#1A3C2B]/20 pb-1">
              <span className="font-bold text-[#1A3C2B] text-xs">{target.room.name}</span>
              <button
                onClick={() => { setSelectedRoom3D(null); setHoveredRoom(null); }}
                className="text-[#1A3C2B]/60 hover:text-[#1A3C2B] text-xs px-1"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center justify-between text-[10px] text-[#1A3C2B]/70">
              <span>KÓD: <b>{target.room.code}</b></span>
              <span>SZINT: <b>{target.floor.shortCode}</b></span>
            </div>
            <div className="text-[10px] text-[#1A3C2B]">
              TERÜLET: <b>{area.toFixed(1)} m²</b> • KAPACITÁS: <b>{target.room.capacity ? `${target.room.capacity} FŐ` : '—'}</b>
            </div>

            {/* Quick Navigation Action Buttons */}
            <div className="flex items-center gap-1.5 pt-1.5 border-t border-[#1A3C2B]/20 mt-1">
              {onSetStartRoom && (
                <button
                  onClick={() => {
                    onSetStartRoom(target.room.id);
                    setSelectedRoom3D(null);
                  }}
                  className="flex-1 py-1.5 bg-[#047857] text-white hover:bg-[#036448] text-[9.5px] font-bold text-center"
                >
                  ● INDULÁS
                </button>
              )}
              {onSetTargetRoom && (
                <button
                  onClick={() => {
                    onSetTargetRoom(target.room.id);
                    setSelectedRoom3D(null);
                  }}
                  className="flex-1 py-1.5 bg-[#B91C1C] text-white hover:bg-[#991B1B] text-[9.5px] font-bold text-center"
                >
                  ★ CÉLÁLLOMÁS
                </button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
