"use client";

import { dataImageUrl } from "@/lib/dataImageUrl";
import { useAppSocket } from "@/providers/AppSocketProvider";
import axiosInstance from "@/utils/axiosInstance";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { SandboxMapEditor } from "./SandboxMapEditor";
import { MONSTER_NAMES } from "./monsterList";

/** Must match API `sandboxRooms.config.json` defaultRoomId. */
const DEFAULT_ROOM_ID = "office-south";
const SANDBOX_LAST_ROOM_LS = "sandboxLastRoomId";

function readStoredSandboxRoomId(): string {
  if (typeof window === "undefined") return DEFAULT_ROOM_ID;
  try {
    const s = localStorage.getItem(SANDBOX_LAST_ROOM_LS);
    if (s && s.trim().length > 0) return s.trim();
  } catch {
    /* private mode */
  }
  return DEFAULT_ROOM_ID;
}
const AVATAR_RADIUS = 0.3;
const MOVE_SPEED = 4;
const EMIT_MS = 55;

type SandboxPlayer = {
  userId: string;
  email: string;
  x: number;
  z: number;
  previewKey: string | null;
};

type RoomBounds = { halfW: number; halfD: number };

type TileType = "rock" | "tree" | "water" | "grass" | "flower" | "sand" | "water-bridge" | "water-bridge-0" | "sand-water-1" | "sand-water-2" | "sand-water-3" | "sand-water-4" | "sand-water-a" | "sand-water-b" | "sand-water-c" | "sand-water-d" | "water-bridge-1" | "water-bridge-2" | "water-bridge-3" | "water-bridge-4" | "water-bridge-a" | "water-bridge-b" | "water-bridge-c" | "water-bridge-d" | "grass-water-1" | "grass-water-2" | "grass-water-3" | "grass-water-4" | "grass-water-5" | "grass-water-6" | "grass-water-a" | "grass-water-b" | "grass-tall-water-1" | "grass-tall-water-2" | "grass-corner" | "rock-water" | "sand-castle" | "sand-tree" | "house" | "chair";

type DeskScene = {
  type: "tile";
  tileType: TileType;
  x: number;
  z: number;
  width: number;
  depth: number;
  solid: boolean;
};

type StairScene = {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  interactRadius: number;
  targetRoomId: string;
  direction?: "up" | "down";
  skin?: string;
};

type RoomScene = {
  objects: DeskScene[];
  stairs: StairScene[];
};

type MonsterState = {
  id: string;
  roomId: string;
  x: number;
  z: number;
  name: string;
};

type HallOfFameRow = {
  userId: string;
  email: string;
  eggs: number;
  unique: number;
};

const MONSTER_TOTAL = 151;

type Aabb = { minX: number; maxX: number; minZ: number; maxZ: number };

function deskToWorldAabb(d: DeskScene): Aabb {
  const hw = d.width / 2;
  const hd = d.depth / 2;
  return { minX: d.x - hw, maxX: d.x + hw, minZ: d.z - hd, maxZ: d.z + hd };
}

function closestPointOnAabb(
  px: number,
  pz: number,
  b: Aabb,
): { x: number; z: number } {
  return {
    x: Math.max(b.minX, Math.min(b.maxX, px)),
    z: Math.max(b.minZ, Math.min(b.maxZ, pz)),
  };
}

function resolveCircleAgainstAabbs(
  px: number,
  pz: number,
  r: number,
  aabbs: Aabb[],
): { x: number; z: number } {
  let x = px;
  let z = pz;
  for (let iter = 0; iter < 10; iter++) {
    let moved = false;
    for (const b of aabbs) {
      const q = closestPointOnAabb(x, z, b);
      let dx = x - q.x;
      let dz = z - q.z;
      let d = Math.hypot(dx, dz);
      if (d < r) {
        if (d < 1e-5) {
          dx = r + 0.03;
          dz = 0;
          d = r + 0.03;
        }
        x = q.x + (dx / d) * (r + 0.025);
        z = q.z + (dz / d) * (r + 0.025);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x, z };
}

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 360) / 360;
}

function makeFallbackTexture(userId: string, email: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const hue = hashHue(userId);
  ctx.fillStyle = `hsl(${hue * 360}, 55%, 42%)`;
  ctx.beginPath();
  ctx.arc(64, 64, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 52px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const letter = (email.trim()[0] || "?").toUpperCase();
  ctx.fillText(letter, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}


const WALL_HEIGHT = 2.4;

function resizeFloor(
  floor: THREE.Mesh,
  bounds: RoomBounds,
  walls: [THREE.Mesh, THREE.Mesh, THREE.Mesh, THREE.Mesh],
) {
  const hw = bounds.halfW * 2;
  const hd = bounds.halfD * 2;
  floor.geometry.dispose();
  floor.geometry = new THREE.PlaneGeometry(hw, hd);
  const mat = floor.material as THREE.MeshBasicMaterial;
  if (mat.map) {
    // 1 tile = 1 world unit, so repeat = room size in units
    mat.map.repeat.set(hw, hd);
    mat.map.needsUpdate = true;
  }

  // Mur Nord (+Z)
  walls[0].geometry.dispose();
  walls[0].geometry = new THREE.PlaneGeometry(hw, WALL_HEIGHT);
  walls[0].position.set(0, WALL_HEIGHT / 2, bounds.halfD);
  walls[0].rotation.y = Math.PI;
  // Mur Sud (-Z)
  walls[1].geometry.dispose();
  walls[1].geometry = new THREE.PlaneGeometry(hw, WALL_HEIGHT);
  walls[1].position.set(0, WALL_HEIGHT / 2, -bounds.halfD);
  walls[1].rotation.y = 0;
  // Mur Est (+X)
  walls[2].geometry.dispose();
  walls[2].geometry = new THREE.PlaneGeometry(hd, WALL_HEIGHT);
  walls[2].position.set(bounds.halfW, WALL_HEIGHT / 2, 0);
  walls[2].rotation.y = -Math.PI / 2;
  // Mur Ouest (-X)
  walls[3].geometry.dispose();
  walls[3].geometry = new THREE.PlaneGeometry(hd, WALL_HEIGHT);
  walls[3].position.set(-bounds.halfW, WALL_HEIGHT / 2, 0);
  walls[3].rotation.y = Math.PI / 2;
}

function disposeObject3D(o: THREE.Object3D) {
  o.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const x of mats) {
        if (x.map) x.map.dispose();
        x.dispose();
      }
    }
  });
}

export default function SandboxCanvas() {
  const { socket } = useAppSocket();
  const pathname = usePathname();
  const [myScore, setMyScore] = useState(0);
  const [myCatches, setMyCatches] = useState<Record<string, number>>({});
  const [hallOfFame, setHallOfFame] = useState<HallOfFameRow[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMap, setEditingMap] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const meRef = useRef<{ id: string; email: string; previewKey: string | null }>({
    id: "",
    email: "",
    previewKey: null,
  });
  const playersRef = useRef<SandboxPlayer[]>([]);
  const roomIdRef = useRef(readStoredSandboxRoomId());
  const boundsRef = useRef<RoomBounds>({ halfW: 10, halfD: 4 });
  const requestStateRef = useRef<(() => void) | null>(null);

  /** After navigation + socket `page-navigation`, ask server to resume last room. */
  useEffect(() => {
    if (!socket || pathname !== "/sandbox") return;
    const t = window.setTimeout(() => {
      if (socket.connected) socket.emit("sandbox:request-state");
    }, 0);
    return () => window.clearTimeout(t);
  }, [pathname, socket]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
        if (!token) return;
        const res = await axiosInstance.get<{
          id?: string;
          email?: string;
          rank?: string;
          profileImage?: { previewStorageKey?: string } | null;
        }>("/user/me", {
          headers: { Authorization: token, "Content-Type": "application/json" },
        });
        if (cancelled) return;
        meRef.current = {
          id: typeof res.data.id === "string" ? res.data.id : "",
          email: typeof res.data.email === "string" ? res.data.email : "",
          previewKey: res.data.profileImage?.previewStorageKey ?? null,
        };
        setIsAdmin(res.data.rank === "admin");
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !socket) return;

    let disposed = false;

    const onPlayers = (payload: {
      roomId?: string;
      players?: SandboxPlayer[];
    }) => {
      if (payload.roomId && payload.roomId !== roomIdRef.current) return;
      playersRef.current = Array.isArray(payload?.players) ? payload.players : [];
    };
    let monsterState: MonsterState | null = null;
    let renderedMonsterId: string | null = undefined as unknown as string | null;
    let monsterTime = 0;

    const onEggScores = (payload: { myScore?: number; myCatches?: Record<string, number>; hallOfFame?: HallOfFameRow[] }) => {
      setMyScore(typeof payload?.myScore === "number" ? payload.myScore : 0);
      setMyCatches(payload?.myCatches && typeof payload.myCatches === "object" ? payload.myCatches : {});
      setHallOfFame(Array.isArray(payload?.hallOfFame) ? payload.hallOfFame : []);
    };

    const onMonsterState = (payload: { monster?: MonsterState | null }) => {
      const prev = monsterState;
      monsterState = payload?.monster ?? null;
      if (prev && !monsterState && monsterMeshes[0]) {
        const m = monsterMeshes[0];
        furniture.remove(m);
        monsterMeshes.length = 0;
        renderedMonsterId = null;
        scene.remove(m);
        disposeStairMesh(m);
      } else {
        syncMonsterMesh();
      }
    };

    const requestSandboxState = () => {
      if (!socket.connected) return;
      socket.emit("sandbox:request-state");
    };
    requestStateRef.current = requestSandboxState;

    socket.on("sandbox:players", onPlayers);
    socket.on("sandbox:eggs:score", onEggScores);
    socket.on("sandbox:monster-state", onMonsterState);
    socket.on("connect", requestSandboxState);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);

    const textureLoader = new THREE.TextureLoader();
    const disposableTextures: THREE.Texture[] = [];

    const b0 = boundsRef.current;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(b0.halfW * 2, b0.halfD * 2),
      new THREE.MeshBasicMaterial(),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d4, roughness: 0.85, metalness: 0, side: THREE.FrontSide });
    const wallGeoPlaceholder = new THREE.PlaneGeometry(1, 1);
    const walls: [THREE.Mesh, THREE.Mesh, THREE.Mesh, THREE.Mesh] = [
      new THREE.Mesh(wallGeoPlaceholder.clone(), wallMat),
      new THREE.Mesh(wallGeoPlaceholder.clone(), wallMat),
      new THREE.Mesh(wallGeoPlaceholder.clone(), wallMat),
      new THREE.Mesh(wallGeoPlaceholder.clone(), wallMat),
    ];
    wallGeoPlaceholder.dispose();
    for (const w of walls) scene.add(w);
    resizeFloor(floor,b0, walls);

    const furniture = new THREE.Group();
    scene.add(furniture);

    const localPos = { x: 0, z: 0 };
    let deskAabbs: Aabb[] = [];
    const stairMeshes: THREE.Mesh[] = [];
    let stairsList: StairScene[] = [];
    const grassTex = textureLoader.load("/tiles/grass.png", (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(b0.halfW * 2, b0.halfD * 2);
      t.needsUpdate = true;
      (floor.material as THREE.MeshBasicMaterial).map = t;
      (floor.material as THREE.MeshBasicMaterial).needsUpdate = true;
    });
    disposableTextures.push(grassTex);
    const monsterMeshes: THREE.Mesh[] = [];

    function disposeStairMesh(m: THREE.Mesh) {
      m.geometry.dispose();
      const mat = m.material as THREE.MeshBasicMaterial;
      if (mat.map) { mat.map.dispose(); mat.map = null; }
      mat.dispose();
    }

    function clearFurniture() {
      for (const m of monsterMeshes) {
        furniture.remove(m);
        disposeStairMesh(m);
      }
      monsterMeshes.length = 0;
      for (const m of stairMeshes) {
        furniture.remove(m);
        disposeStairMesh(m);
      }
      stairMeshes.length = 0;
      stairsList = [];
      deskAabbs = [];
      while (furniture.children.length > 0) {
        const c = furniture.children[0]!;
        furniture.remove(c);
        disposeObject3D(c);
      }
    }

    function buildRoomScene(roomScene: RoomScene) {
      clearFurniture();
      for (const d of roomScene.objects) {
        if (d.type !== "tile") continue;
        if (d.solid) deskAabbs.push(deskToWorldAabb(d));
        const geo = new THREE.PlaneGeometry(d.width, d.depth);
        const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(d.x, 0.01, d.z);
        mesh.renderOrder = 0;
        furniture.add(mesh);
        textureLoader.load(`/tiles/${d.tileType}.png`, (tex) => {
          if (disposed) { tex.dispose(); return; }
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          disposableTextures.push(tex);
          mat.map = tex;
          mat.needsUpdate = true;
        });
      }
      for (const st of roomScene.stairs) {
        stairsList.push(st);
        // Block lateral (X) movement only — two thin walls on left/right sides
        const wallThick = 0.05;
        const halfD = 0.5;
        deskAabbs.push({ minX: st.x - 0.5 - wallThick, maxX: st.x - 0.5, minZ: st.z - halfD, maxZ: st.z + halfD });
        deskAabbs.push({ minX: st.x + 0.5, maxX: st.x + 0.5 + wallThick, minZ: st.z - halfD, maxZ: st.z + halfD });
        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(st.x, 0.022, st.z);
        mesh.userData.stairId = st.id;
        mesh.renderOrder = 1;
        furniture.add(mesh);
        stairMeshes.push(mesh);
        const stairSkin = st.skin ?? "stair";
        textureLoader.load(`/tiles/${stairSkin}.png`, (tex) => {
          if (disposed) { tex.dispose(); return; }
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          disposableTextures.push(tex);
          mat.map = tex;
          mat.needsUpdate = true;
        });
      }
    }

    function syncMonsterMesh() {
      const newId = (monsterState && monsterState.roomId === roomIdRef.current) ? monsterState.id : null;
      if (newId === renderedMonsterId) return;
      renderedMonsterId = newId;

      for (const m of monsterMeshes) {
        furniture.remove(m);
        disposeStairMesh(m);
      }
      monsterMeshes.length = 0;
      if (!monsterState || monsterState.roomId !== roomIdRef.current) return;

      const geo = new THREE.PlaneGeometry(1.2, 1.2);
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(monsterState.x, 0.035, monsterState.z);
      mesh.userData.monsterId = monsterState.id;
      mesh.renderOrder = 2;
      furniture.add(mesh);
      monsterMeshes.push(mesh);

      textureLoader.load(`/monsters/${encodeURIComponent(monsterState.name)}.png`, (tex) => {
        if (disposed) { tex.dispose(); return; }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        disposableTextures.push(tex);
        mat.map = tex;
        mat.needsUpdate = true;
      });
    }

    const onRoomJoined = (payload: {
      roomId: string;
      x: number;
      z: number;
      bounds: RoomBounds;
      scene?: RoomScene;
    }) => {
      if (disposed) return;
      roomIdRef.current = payload.roomId;
      try {
        localStorage.setItem(SANDBOX_LAST_ROOM_LS, payload.roomId);
      } catch {
        /* ignore */
      }
      boundsRef.current = payload.bounds;
      localPos.x = payload.x;
      localPos.z = payload.z;
      resizeFloor(floor,payload.bounds, walls);
      if (payload.scene) {
        buildRoomScene(payload.scene);
      }
      syncMonsterMesh();
    };

    socket.on("sandbox:room-joined", onRoomJoined);

    const onMapReload = (payload: {
      roomId: string;
      bounds: RoomBounds;
      scene: RoomScene;
    }) => {
      if (disposed) return;
      if (payload.roomId !== roomIdRef.current) return;
      boundsRef.current = payload.bounds;
      resizeFloor(floor,payload.bounds, walls);
      buildRoomScene(payload.scene);
      resize();
      syncMonsterMesh();
    };
    socket.on("sandbox:map-reload", onMapReload);

    const onTeleportTo = (payload: { x: number; z: number }) => {
      if (disposed) return;
      localPos.x = payload.x;
      localPos.z = payload.z;
    };
    socket.on("sandbox:teleport-to", onTeleportTo);

    requestSandboxState();

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 0.25);
    sun.position.set(8, 32, 6);
    scene.add(sun);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 200);
    camera.position.set(0, 55, 0);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const clock = new THREE.Clock();
    const keys = new Set<string>();
    const playerMeshes = new Map<string, THREE.Group>();


    const resize = () => {
      const w = el.clientWidth;
      const h = Math.max(el.clientHeight, 1);
      const aspect = w / h;
      const b = boundsRef.current;
      const padding = 0.8;
      const roomWidth = b.halfW * 2 + padding * 2;
      const roomHeight = b.halfD * 2 + padding * 2;
      // Fit both dimensions in frame: keep full 20m width visible even on narrow layouts.
      const viewH = Math.max(roomHeight, roomWidth / Math.max(aspect, 0.01));
      const viewW = viewH * aspect;
      camera.left = -viewW / 2;
      camera.right = viewW / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const onKeyDown = (e: KeyboardEvent) => {
      keys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    function disposeGroup(g: THREE.Group) {
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
    }

    function ensurePlayerMesh(p: SandboxPlayer) {
      let g = playerMeshes.get(p.userId);
      if (g) return g;

      g = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(AVATAR_RADIUS * 0.9, AVATAR_RADIUS * 1.06, 40),
        new THREE.MeshBasicMaterial({
          color: 0x475569,
          depthWrite: false,
          transparent: true,
          opacity: 0.9,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      ring.renderOrder = 3;
      g.add(ring);

      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(AVATAR_RADIUS, 40),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.032;
      disc.renderOrder = 3;
      g.add(disc);

      const mat = disc.material as THREE.MeshBasicMaterial;
      const key = p.previewKey;
      if (key) {
        textureLoader.load(
          dataImageUrl(key),
          (tex) => {
            if (disposed) {
              tex.dispose();
              return;
            }
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.needsUpdate = true;
            disposableTextures.push(tex);
            mat.map = tex;
            mat.needsUpdate = true;
          },
          undefined,
          () => {
            if (disposed) return;
            const fb = makeFallbackTexture(p.userId, p.email);
            disposableTextures.push(fb);
            mat.map = fb;
            mat.needsUpdate = true;
          },
        );
      } else {
        const fb = makeFallbackTexture(p.userId, p.email);
        disposableTextures.push(fb);
        mat.map = fb;
        mat.needsUpdate = true;
      }

      // Pokéball attachée au joueur local (uniquement)
      if (p.userId === meRef.current.id) {
        const pbGeo = new THREE.PlaneGeometry(0.28, 0.28);
        const pbMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
        const pbMesh = new THREE.Mesh(pbGeo, pbMat);
        pbMesh.rotation.x = -Math.PI / 2;
        pbMesh.position.set(AVATAR_RADIUS + 0.03, 0.034, 0);
        pbMesh.renderOrder = 4;
        pbMesh.name = "pokeball";
        g.add(pbMesh);
        textureLoader.load("/tiles/pokeball.png", (tex) => {
          if (disposed) { tex.dispose(); return; }
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          disposableTextures.push(tex);
          pbMat.map = tex;
          pbMat.needsUpdate = true;
        });
      }

      scene.add(g);
      playerMeshes.set(p.userId, g);
      return g;
    }

    function syncPlayerMeshes(list: SandboxPlayer[]) {
      const seen = new Set<string>();
      for (const p of list) {
        seen.add(p.userId);
        ensurePlayerMesh(p);
      }
      for (const id of [...playerMeshes.keys()]) {
        if (!seen.has(id)) {
          const g = playerMeshes.get(id)!;
          scene.remove(g);
          disposeGroup(g);
          playerMeshes.delete(id);
        }
      }
    }

    let raf = 0;
    let lastEmit = 0;
    // -1 = gauche, +1 = droite, 0 = dernier connu (défaut droite)
    let pokeballDir = 1;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.1);
      const bounds = boundsRef.current;
      const hw = bounds.halfW;
      const hd = bounds.halfD;

      let dx = 0;
      let dz = 0;
      if (keys.has("KeyW") || keys.has("ArrowUp")) dz -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) dz += 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
      if (dx !== 0) pokeballDir = dx > 0 ? 1 : -1;
      const len = Math.hypot(dx, dz);
      if (len > 0) {
        dx /= len;
        dz /= len;
        localPos.x += dx * MOVE_SPEED * dt;
        localPos.z += dz * MOVE_SPEED * dt;
        const r = AVATAR_RADIUS;
        localPos.x = Math.min(hw - r, Math.max(-hw + r, localPos.x));
        localPos.z = Math.min(hd - r, Math.max(-hd + r, localPos.z));
        const resolved = resolveCircleAgainstAabbs(
          localPos.x,
          localPos.z,
          r,
          deskAabbs,
        );
        localPos.x = Math.min(hw - r, Math.max(-hw + r, resolved.x));
        localPos.z = Math.min(hd - r, Math.max(-hd + r, resolved.z));

        // Stair trigger: player is near a stair and pressed against its wall
        if (socket.connected) {
          for (const st of stairsList) {
            const skin = st.skin ?? "stair-to-top";
            const dist = Math.hypot(localPos.x - st.x, localPos.z - st.z);
            if (dist > st.interactRadius + 0.1) continue;
            // stair-to-top: north wall (z = -halfD), player pushed against it
            if (skin === "stair-to-top" && localPos.z <= -hd + r + 0.05) {
              socket.emit("sandbox:use-stair", { stairId: st.id });
              break;
            }
            // stair-to-bottom: south wall (z = +halfD), player pushed against it
            if (skin === "stair-to-bottom" && localPos.z >= hd - r - 0.05) {
              socket.emit("sandbox:use-stair", { stairId: st.id });
              break;
            }
          }
        }
      }

      const list = playersRef.current;
      const meId = meRef.current.id;
      const displayList: SandboxPlayer[] =
        meId && !list.some((p) => p.userId === meId)
          ? [
              ...list,
              {
                userId: meId,
                email: meRef.current.email,
                x: localPos.x,
                z: localPos.z,
                previewKey: meRef.current.previewKey,
              },
            ]
          : list;
      syncPlayerMeshes(displayList);

      const now = performance.now();
      if (socket.connected && meId && now - lastEmit >= EMIT_MS) {
        lastEmit = now;
        socket.emit("sandbox:position", {
          roomId: roomIdRef.current,
          x: localPos.x,
          z: localPos.z,
          previewKey: meRef.current.previewKey ?? undefined,
        });
        if (monsterState && monsterState.roomId === roomIdRef.current) {
          const dist = Math.hypot(localPos.x - monsterState.x, localPos.z - monsterState.z);
          if (dist <= 1.1) socket.emit("sandbox:collect-monster");
        }
      }

      const othersPos = new Map<string, { x: number; z: number }>();
      for (const p of displayList) {
        if (!meId || p.userId !== meId) {
          othersPos.set(p.userId, { x: p.x, z: p.z });
        }
      }


      for (const [uid, g] of playerMeshes) {
        if (meId && uid === meId) {
          g.position.set(localPos.x, 0, localPos.z);
          // Mise à jour position pokéball selon direction
          const pb = g.getObjectByName("pokeball");
          if (pb) pb.position.x = pokeballDir * (AVATAR_RADIUS + 0.03);
        } else {
          const o = othersPos.get(uid);
          if (o) g.position.set(o.x, 0, o.z);
        }
      }

      // animation flottement du monstre
      monsterTime += dt;
      if (monsterMeshes[0]) {
        const m = monsterMeshes[0]!;
        m.position.y = 0.035 + 0.05 * Math.abs(Math.sin(monsterTime * 1.8));
      }

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      requestStateRef.current = null;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      ro.disconnect();
      socket.off("sandbox:players", onPlayers);
      socket.off("sandbox:eggs:score", onEggScores);
      socket.off("sandbox:monster-state", onMonsterState);
      socket.off("connect", requestSandboxState);
      socket.off("sandbox:room-joined", onRoomJoined);
      socket.off("sandbox:map-reload", onMapReload);
      socket.off("sandbox:teleport-to", onTeleportTo);
      clearFurniture();
      disposableTextures.forEach((t) => t.dispose());
      renderer.dispose();
      el.removeChild(renderer.domElement);
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      for (const w of walls) {
        w.geometry.dispose();
      }
      wallMat.dispose();
      for (const g of playerMeshes.values()) {
        scene.remove(g);
        disposeGroup(g);
      }
      playerMeshes.clear();
    };
  }, [socket, editingMap]);

  return (
    <div className="space-y-4">
      {isAdmin && !editingMap && (
        <div className="flex justify-end">
          <button
            onClick={() => setEditingMap(true)}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:bg-soft/60 hover:text-foreground"
          >
            Editer la map
          </button>
        </div>
      )}

      {!editingMap && (
        <div className="relative">
          <div
            ref={containerRef}
            className="aspect-2/1 w-full min-h-96 cursor-crosshair overflow-hidden rounded-xl border border-border bg-soft/30"
          />
          <div className="pointer-events-none absolute top-3 right-3 rounded-md border border-border/70 bg-white/90 px-3 py-2 text-sm shadow-sm">
            <div className="text-xs text-muted">Capturés</div>
            <div className="text-base font-semibold text-foreground">{myScore}/{MONSTER_TOTAL}</div>
          </div>
        </div>
      )}

      {isAdmin && editingMap && (
        <SandboxMapEditor
          onClose={() => setEditingMap(false)}
          onSaved={() => requestStateRef.current?.()}
        />
      )}

      {/* Pokédex button */}
      {!editingMap && <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-foreground">Hall of fame</h3>
        <button
          onClick={() => setDrawerOpen(true)}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:bg-soft/60 hover:text-foreground"
        >
          Mon Pokédex ({myScore}/{MONSTER_TOTAL})
        </button>
      </div>}

      {!editingMap && <div className="rounded-xl border border-border bg-soft/30 p-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-2 py-2 font-medium text-muted">#</th>
                <th className="px-2 py-2 font-medium text-muted">Joueur</th>
                <th className="px-2 py-2 font-medium text-muted">Uniques</th>
                <th className="px-2 py-2 font-medium text-muted">Total</th>
              </tr>
            </thead>
            <tbody>
              {hallOfFame.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-muted" colSpan={4}>
                    Aucun monstre capturé pour le moment.
                  </td>
                </tr>
              ) : (
                hallOfFame.map((row, idx) => (
                  <tr key={row.userId} className="border-b border-border/60">
                    <td className="px-2 py-2">{idx + 1}</td>
                    <td className="px-2 py-2">{row.email || row.userId}</td>
                    <td className="px-2 py-2 font-medium">{row.unique}/{MONSTER_TOTAL}</td>
                    <td className="px-2 py-2 text-muted">{row.eggs}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>}

      {/* Pokédex drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-semibold text-foreground">
                Pokédex — {myScore}/{MONSTER_TOTAL}
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-muted hover:text-foreground text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-4 gap-2">
                {MONSTER_NAMES.map((name) => {
                  const count = myCatches[name] ?? 0;
                  const caught = count > 0;
                  return (
                    <div
                      key={name}
                      className="relative flex flex-col items-center rounded-lg border border-border p-1"
                      style={{ opacity: caught ? 1 : 0.3 }}
                    >
                      <img
                        src={`/monsters/${encodeURIComponent(name)}.png`}
                        alt={name}
                        className="w-12 h-12 object-contain"
                        style={{ filter: caught ? "none" : "grayscale(1)" }}
                      />
                      <span className="mt-1 text-center text-[10px] leading-tight text-foreground break-words w-full text-center">
                        {name}
                      </span>
                      {count > 1 && (
                        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-white">
                          {count}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
