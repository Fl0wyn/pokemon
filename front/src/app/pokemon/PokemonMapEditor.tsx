"use client";

import axiosInstance from "@/utils/axiosInstance";
import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TileType = "rock" | "tree" | "water" | "grass" | "flower" | "sand" | "water-bridge" | "water-bridge-0" | "sand-water-1" | "sand-water-2" | "sand-water-3" | "sand-water-4" | "sand-water-a" | "sand-water-b" | "sand-water-c" | "sand-water-d" | "water-bridge-1" | "water-bridge-2" | "water-bridge-3" | "water-bridge-4" | "water-bridge-a" | "water-bridge-b" | "water-bridge-c" | "water-bridge-d" | "grass-water-1" | "grass-water-2" | "grass-water-3" | "grass-water-4" | "grass-water-5" | "grass-water-6" | "grass-water-a" | "grass-water-b" | "grass-tall-water-1" | "grass-tall-water-2" | "grass-corner" | "rock-water" | "sand-castle" | "sand-tree" | "house" | "chair";

const TILE_SIZES: Record<TileType, { width: number; depth: number }> = {
  rock:           { width: 1, depth: 1 },
  tree:           { width: 1, depth: 1 },
  water:          { width: 1, depth: 1 },
  grass:          { width: 1, depth: 1 },
  flower:         { width: 1, depth: 1 },
  sand:           { width: 1, depth: 1 },
  "water-bridge": { width: 1, depth: 1 },
  "water-bridge-0": { width: 1, depth: 1 },
  "sand-water-1": { width: 1, depth: 1 },
  "sand-water-2": { width: 1, depth: 1 },
  "sand-water-3": { width: 1, depth: 1 },
  "sand-water-4": { width: 1, depth: 1 },
  "sand-water-a": { width: 1, depth: 1 },
  "sand-water-b": { width: 1, depth: 1 },
  "sand-water-c": { width: 1, depth: 1 },
  "sand-water-d":   { width: 1, depth: 1 },
  "water-bridge-1": { width: 1, depth: 1 },
  "water-bridge-2": { width: 1, depth: 1 },
  "water-bridge-3": { width: 1, depth: 1 },
  "water-bridge-4": { width: 1, depth: 1 },
  "water-bridge-a": { width: 1, depth: 1 },
  "water-bridge-b": { width: 1, depth: 1 },
  "water-bridge-c": { width: 1, depth: 1 },
  "water-bridge-d": { width: 1, depth: 1 },
  "grass-water-1":  { width: 1, depth: 1 },
  "grass-water-2":  { width: 1, depth: 1 },
  "grass-water-3":  { width: 1, depth: 1 },
  "grass-water-4":  { width: 1, depth: 1 },
  "grass-water-5":  { width: 1, depth: 1 },
  "grass-water-6":  { width: 1, depth: 1 },
  "grass-water-a":  { width: 1, depth: 1 },
  "grass-water-b":  { width: 1, depth: 1 },
  "grass-tall-water-1": { width: 1, depth: 1 },
  "grass-tall-water-2": { width: 1, depth: 1 },
  "grass-corner":       { width: 1, depth: 1 },
  "rock-water":         { width: 1, depth: 1 },
  "sand-castle":        { width: 1, depth: 1 },
  "sand-tree":          { width: 1, depth: 1 },
  "house":              { width: 2, depth: 3 },
  "chair":              { width: 1, depth: 1 },
};

const SOLID_TILES = new Set<TileType>(["rock", "tree", "water", "grass-tall-water-1", "grass-tall-water-2", "sand-tree", "house", "sand-castle"]);

const TILE_LABELS: Record<TileType, string> = {
  rock: "Rocher", tree: "Arbre", water: "Eau", grass: "Herbe", flower: "Fleur",
  sand: "Sable", "water-bridge": "Pont", "water-bridge-0": "Pont 0",
  "sand-water-1": "Sable-Eau 1", "sand-water-2": "Sable-Eau 2",
  "sand-water-3": "Sable-Eau 3", "sand-water-4": "Sable-Eau 4",
  "sand-water-a": "Sable-Eau A", "sand-water-b": "Sable-Eau B",
  "sand-water-c": "Sable-Eau C", "sand-water-d": "Sable-Eau D",
  "water-bridge-1": "Pont 1", "water-bridge-2": "Pont 2",
  "water-bridge-3": "Pont 3", "water-bridge-4": "Pont 4",
  "water-bridge-a": "Pont A", "water-bridge-b": "Pont B",
  "water-bridge-c": "Pont C", "water-bridge-d": "Pont D",
  "grass-water-1": "Herbe-Eau 1", "grass-water-2": "Herbe-Eau 2",
  "grass-water-3": "Herbe-Eau 3", "grass-water-4": "Herbe-Eau 4",
  "grass-water-5": "Herbe-Eau 5", "grass-water-6": "Herbe-Eau 6",
  "grass-water-a": "Herbe-Eau A", "grass-water-b": "Herbe-Eau B",
  "grass-tall-water-1": "Herbe haute-Eau 1", "grass-tall-water-2": "Herbe haute-Eau 2",
  "grass-corner": "Herbe coin", "rock-water": "Rocher eau", "sand-castle": "Château de sable",
  "sand-tree": "Arbre sable",
  "house": "Maison",
  "chair": "Chaise",
};

// Canvas preview colors (bg, border)
const TILE_COLORS: Record<TileType, { bg: string; border: string; text: string }> = {
  rock:           { bg: "rgba(120,113,108,0.8)",  border: "#57534e", text: "#fff" },
  tree:           { bg: "rgba(34,197,94,0.8)",    border: "#15803d", text: "#fff" },
  water:          { bg: "rgba(56,189,248,0.8)",   border: "#0284c7", text: "#fff" },
  grass:          { bg: "rgba(163,230,53,0.7)",   border: "#65a30d", text: "#365314" },
  flower:         { bg: "rgba(244,114,182,0.75)", border: "#db2777", text: "#fff" },
  sand:           { bg: "rgba(234,179,8,0.75)",   border: "#a16207", text: "#fff" },
  "water-bridge": { bg: "rgba(147,197,253,0.8)",  border: "#2563eb", text: "#1e3a5f" },
  "water-bridge-0": { bg: "rgba(147,197,253,0.8)", border: "#2563eb", text: "#1e3a5f" },
  "sand-water-1": { bg: "rgba(234,179,8,0.6)",    border: "#0284c7", text: "#fff" },
  "sand-water-2": { bg: "rgba(234,179,8,0.6)",    border: "#0284c7", text: "#fff" },
  "sand-water-3": { bg: "rgba(234,179,8,0.6)",    border: "#0284c7", text: "#fff" },
  "sand-water-4": { bg: "rgba(234,179,8,0.6)",    border: "#0284c7", text: "#fff" },
  "sand-water-a": { bg: "rgba(234,179,8,0.6)",    border: "#0284c7", text: "#fff" },
  "sand-water-b": { bg: "rgba(234,179,8,0.6)",    border: "#0284c7", text: "#fff" },
  "sand-water-c": { bg: "rgba(234,179,8,0.6)",    border: "#0284c7", text: "#fff" },
  "sand-water-d":   { bg: "rgba(234,179,8,0.6)",   border: "#0284c7", text: "#fff" },
  "water-bridge-1": { bg: "rgba(147,197,253,0.8)", border: "#2563eb", text: "#1e3a5f" },
  "water-bridge-2": { bg: "rgba(147,197,253,0.8)", border: "#2563eb", text: "#1e3a5f" },
  "water-bridge-3": { bg: "rgba(147,197,253,0.8)", border: "#2563eb", text: "#1e3a5f" },
  "water-bridge-4": { bg: "rgba(147,197,253,0.8)", border: "#2563eb", text: "#1e3a5f" },
  "water-bridge-a": { bg: "rgba(147,197,253,0.8)", border: "#2563eb", text: "#1e3a5f" },
  "water-bridge-b": { bg: "rgba(147,197,253,0.8)", border: "#2563eb", text: "#1e3a5f" },
  "water-bridge-c": { bg: "rgba(147,197,253,0.8)", border: "#2563eb", text: "#1e3a5f" },
  "water-bridge-d": { bg: "rgba(147,197,253,0.8)", border: "#2563eb", text: "#1e3a5f" },
  "grass-water-1":  { bg: "rgba(163,230,53,0.6)",  border: "#0284c7", text: "#fff" },
  "grass-water-2":  { bg: "rgba(163,230,53,0.6)",  border: "#0284c7", text: "#fff" },
  "grass-water-3":  { bg: "rgba(163,230,53,0.6)",  border: "#0284c7", text: "#fff" },
  "grass-water-4":  { bg: "rgba(163,230,53,0.6)",  border: "#0284c7", text: "#fff" },
  "grass-water-5":  { bg: "rgba(163,230,53,0.6)",  border: "#0284c7", text: "#fff" },
  "grass-water-6":  { bg: "rgba(163,230,53,0.6)",  border: "#0284c7", text: "#fff" },
  "grass-water-a":  { bg: "rgba(163,230,53,0.6)",  border: "#0284c7", text: "#fff" },
  "grass-water-b":  { bg: "rgba(163,230,53,0.6)",  border: "#0284c7", text: "#fff" },
  "grass-tall-water-1": { bg: "rgba(34,197,94,0.8)", border: "#15803d", text: "#fff" },
  "grass-tall-water-2": { bg: "rgba(34,197,94,0.8)", border: "#15803d", text: "#fff" },
  "grass-corner":       { bg: "rgba(163,230,53,0.7)",  border: "#65a30d", text: "#365314" },
  "rock-water":         { bg: "rgba(120,113,108,0.7)", border: "#0284c7", text: "#fff" },
  "sand-castle":        { bg: "rgba(234,179,8,0.75)",  border: "#a16207", text: "#fff" },
  "sand-tree":          { bg: "rgba(234,179,8,0.65)",  border: "#15803d", text: "#fff" },
  "house":              { bg: "rgba(251,191,36,0.7)",  border: "#b45309", text: "#fff" },
  "chair":              { bg: "rgba(163,230,53,0.7)",  border: "#65a30d", text: "#365314" },
};

type DeskObj = {
  type: "tile";
  tileType: TileType;
  x: number;
  z: number;
  width: number;
  depth: number;
};

type StairObj = {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  targetRoomId: string;
  interactRadius: number;
  spawnOnArrival: { x: number; z: number };
  skin?: string;
};

type RoomConfig = {
  label?: string;
  halfW: number;
  halfD: number;
  spawn: { x: number; z: number };
  objects: DeskObj[];
  stairs: StairObj[];
};

type PokemonConfig = {
  version: number;
  defaultRoomId: string;
  rooms: Record<string, RoomConfig>;
};

type StairSpawnRef = { stairId: string; sourceRoomId: string };

type DragTarget =
  | { type: "desk"; idx: number }
  | { type: "stair"; idx: number }
  | { type: "spawn" }
  | { type: "stair-spawn"; stairId: string; sourceRoomId: string };

type Props = {
  onClose: () => void;
  onSaved?: () => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TILE_TYPES: TileType[] = ["grass", "rock", "tree", "water", "flower", "sand", "water-bridge", "water-bridge-0", "sand-water-1", "sand-water-2", "sand-water-3", "sand-water-4", "sand-water-a", "sand-water-b", "sand-water-c", "sand-water-d", "water-bridge-1", "water-bridge-2", "water-bridge-3", "water-bridge-4", "water-bridge-a", "water-bridge-b", "water-bridge-c", "water-bridge-d", "grass-water-1", "grass-water-2", "grass-water-3", "grass-water-4", "grass-water-5", "grass-water-6", "grass-water-a", "grass-water-b", "grass-tall-water-1", "grass-tall-water-2", "grass-corner", "rock-water", "sand-castle", "sand-tree", "house", "chair"];

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/** Snap a world coordinate to the correct grid alignment based on tile size.
 *  Odd-size tiles (1,3,…) center at x.5; even-size tiles (2,4,…) center at integer x.
 */
function snapAxis(v: number, size: number): number {
  return size % 2 === 0 ? Math.round(v) : Math.floor(v) + 0.5;
}

const EDITOR_EXTRA_BOTTOM = 2;

function worldToCanvas(
  wx: number,
  wz: number,
  halfW: number,
  halfD: number,
  canvasW: number,
  canvasH: number,
): { cx: number; cy: number } {
  const totalH = halfD * 2 + EDITOR_EXTRA_BOTTOM;
  const px = (wx + halfW) / (halfW * 2);
  const py = (wz + halfD) / totalH;
  return { cx: px * canvasW, cy: py * canvasH };
}

function canvasToWorld(
  cx: number,
  cy: number,
  halfW: number,
  halfD: number,
  canvasW: number,
  canvasH: number,
): { wx: number; wz: number } {
  const totalH = halfD * 2 + EDITOR_EXTRA_BOTTOM;
  return {
    wx: (cx / canvasW) * halfW * 2 - halfW,
    wz: (cy / canvasH) * totalH - halfD,
  };
}

function pointInTile(px: number, pz: number, d: DeskObj): boolean {
  return Math.abs(px - d.x) <= d.width / 2 + 0.05 && Math.abs(pz - d.z) <= d.depth / 2 + 0.05;
}

function pointInStair(px: number, pz: number, st: StairObj): boolean {
  return (
    Math.abs(px - st.x) <= st.width / 2 + 0.1 &&
    Math.abs(pz - st.z) <= st.depth / 2 + 0.1
  );
}

// ─── Canvas renderer ──────────────────────────────────────────────────────────

function drawRoom(
  ctx: CanvasRenderingContext2D,
  room: RoomConfig,
  currentRoomId: string,
  allRooms: Record<string, RoomConfig>,
  selectedDeskIdx: number | null,
  selectedStairIdx: number | null,
  hoveredDeskIdx: number | null,
  hoveredStairIdx: number | null,
  hoveredSpawn: boolean,
  hoveredStairSpawn: StairSpawnRef | null,
  dragPreview: { x: number; z: number } | null,
  dragTarget: DragTarget | null,
  canvasW: number,
  canvasH: number,
  tileImgs: Partial<Record<TileType, HTMLImageElement>>,
  stairImgs: Record<string, HTMLImageElement>,
  pendingTile: TileType | null,
  pendingPos: { x: number; z: number } | null,
  showSpawn: boolean,
) {
  const { halfW, halfD } = room;

  const tw = (wx: number, wz: number) =>
    worldToCanvas(wx, wz, halfW, halfD, canvasW, canvasH);

  // cell size in pixels for 1 world unit
  const totalRows = halfD * 2 + EDITOR_EXTRA_BOTTOM;
  const cellW = canvasW / (halfW * 2);
  const cellH = canvasH / totalRows;

  // background — plain grey
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(0, 0, canvasW, canvasH);

  // outer border
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvasW - 2, canvasH - 2);



  // stairs
  room.stairs.forEach((st, idx) => {
    const isSel = selectedStairIdx === idx;
    const isDragging = dragTarget?.type === "stair" && dragTarget.idx === idx;
    const drawX = isDragging && dragPreview ? dragPreview.x : st.x;
    const drawZ = isDragging && dragPreview ? dragPreview.z : st.z;

    const center = tw(drawX, drawZ);
    const STAIR_R = 12;
    const skin = st.skin ?? "stair-to-top";
    const label = skin === "stair-to-bottom" ? "S↓" : "S↑";

    ctx.fillStyle = isDragging
      ? "rgba(139,92,246,0.55)"
      : isSel
      ? "rgba(139,92,246,0.5)"
      : "rgba(139,92,246,0.25)";
    ctx.beginPath();
    ctx.arc(center.cx, center.cy, STAIR_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isSel ? "#f59e0b" : "#7c3aed";
    ctx.lineWidth = isSel ? 2.5 : 1.5;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 9px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, center.cx, center.cy);
  });

  // tiles
  room.objects.forEach((d, idx) => {
    if (d.type !== "tile") return;
    const isSel = selectedDeskIdx === idx;
    const isHov = hoveredDeskIdx === idx;
    const isDragging = dragTarget?.type === "desk" && dragTarget.idx === idx;
    const drawD = isDragging && dragPreview ? { ...d, x: dragPreview.x, z: dragPreview.z } : d;

    const tl2 = tw(drawD.x - drawD.width / 2, drawD.z - drawD.depth / 2);
    const br2 = tw(drawD.x + drawD.width / 2, drawD.z + drawD.depth / 2);
    const pw = br2.cx - tl2.cx;
    const ph = br2.cy - tl2.cy;

    const tileImg = tileImgs[d.tileType];
    if (tileImg) {
      ctx.drawImage(tileImg, tl2.cx, tl2.cy, pw, ph);
    } else {
      ctx.fillStyle = TILE_COLORS[d.tileType].bg;
      ctx.fillRect(tl2.cx, tl2.cy, pw, ph);
    }
    // selection / hover outline
    if (isSel || isHov) {
      ctx.strokeStyle = isSel ? "#f59e0b" : "#94a3b8";
      ctx.lineWidth = isSel ? 2.5 : 1.5;
      ctx.strokeRect(tl2.cx, tl2.cy, pw, ph);
    }
  });

  // spawn (dessiné après les tiles — uniquement sur la map par défaut)
  if (showSpawn) {
    const isSpawnDragging = dragTarget?.type === "spawn";
    const spawnDrawX = isSpawnDragging && dragPreview ? dragPreview.x : room.spawn.x;
    const spawnDrawZ = isSpawnDragging && dragPreview ? dragPreview.z : room.spawn.z;
    const sp = tw(spawnDrawX, spawnDrawZ);
    const SPAWN_R = 12;
    ctx.fillStyle = isSpawnDragging
      ? "rgba(34,197,94,0.55)"
      : hoveredSpawn
      ? "rgba(34,197,94,0.45)"
      : "rgba(34,197,94,0.25)";
    ctx.beginPath();
    ctx.arc(sp.cx, sp.cy, SPAWN_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isSpawnDragging ? "#15803d" : "#16a34a";
    ctx.lineWidth = isSpawnDragging ? 2.5 : 1.5;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 9px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("S", sp.cx, sp.cy);
  }

  // Ghost tile following mouse
  if (pendingTile && pendingPos) {
    const sizes = TILE_SIZES[pendingTile];
    const tl = tw(pendingPos.x - sizes.width / 2, pendingPos.z - sizes.depth / 2);
    const br = tw(pendingPos.x + sizes.width / 2, pendingPos.z + sizes.depth / 2);
    const pw = br.cx - tl.cx;
    const ph = br.cy - tl.cy;
    ctx.globalAlpha = 0.6;
    const img = tileImgs[pendingTile];
    if (img) {
      ctx.drawImage(img, tl.cx, tl.cy, pw, ph);
    } else {
      ctx.fillStyle = TILE_COLORS[pendingTile].bg;
      ctx.fillRect(tl.cx, tl.cy, pw, ph);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.strokeRect(tl.cx, tl.cy, pw, ph);
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PokemonMapEditor({ onClose, onSaved }: Props) {
  const [config, setConfig] = useState<PokemonConfig | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [selectedDesk, setSelectedDesk] = useState<number | null>(null);
  const [selectedStair, setSelectedStair] = useState<number | null>(null);
  const [hoveredDesk, setHoveredDesk] = useState<number | null>(null);
  const [hoveredStair, setHoveredStair] = useState<number | null>(null);
  const [hoveredSpawn, setHoveredSpawn] = useState(false);
  const [hoveredStairSpawn, setHoveredStairSpawn] = useState<StairSpawnRef | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{
    active: boolean;
    target: DragTarget | null;
    startWorld: { x: number; z: number };
    objOrigin: { x: number; z: number };
  }>({ active: false, target: null, startWorld: { x: 0, z: 0 }, objOrigin: { x: 0, z: 0 } });
  const [dragPreview, setDragPreview] = useState<{ x: number; z: number } | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [pendingTile, setPendingTile] = useState<TileType | null>(null);
  const [pendingPos, setPendingPos] = useState<{ x: number; z: number } | null>(null);
  const tileImgsRef = useRef<Partial<Record<TileType, HTMLImageElement>>>({});
  const stairImgsRef = useRef<Record<string, HTMLImageElement>>({});

  // Preload all tile images
  useEffect(() => {
    const all: TileType[] = ["grass", ...TILE_TYPES];
    for (const tt of all) {
      const img = new Image();
      img.src = `/pokemon/tiles/${tt}.png`;
      img.onload = () => { tileImgsRef.current[tt] = img; render(); };
    }
    for (const skin of ["stair-to-top", "stair-to-bottom"]) {
      const img = new Image();
      img.src = `/pokemon/tiles/${skin}.png`;
      img.onload = () => { stairImgsRef.current[skin] = img; render(); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load config
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
    if (!token) { setError("Non authentifié."); setLoading(false); return; }
    axiosInstance
      .get<PokemonConfig>("/pokemon/config", { headers: { Authorization: token } })
      .then((res) => {
        setConfig(res.data);
        setCurrentRoomId(res.data.defaultRoomId);
        setLoading(false);
      })
      .catch((e) => {
        setError(e?.response?.data?.error ?? e.message ?? "Erreur de chargement.");
        setLoading(false);
      });
  }, []);

  const room = config && currentRoomId ? config.rooms[currentRoomId] ?? null : null;

  // ─── Canvas helpers ────────────────────────────────────────────────────────

  function getCanvasSize(): { w: number; h: number } {
    const c = canvasRef.current;
    if (!c) return { w: 600, h: 240 };
    return { w: c.width, h: c.height };
  }

  function toWorld(cx: number, cy: number): { wx: number; wz: number } | null {
    if (!room) return null;
    const { w, h } = getCanvasSize();
    return canvasToWorld(cx, cy, room.halfW, room.halfD, w, h);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const render = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !room) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawRoom(
      ctx, room,
      currentRoomId, config?.rooms ?? {},
      selectedDesk, selectedStair,
      hoveredDesk, hoveredStair,
      hoveredSpawn, hoveredStairSpawn,
      dragPreview, dragTarget,
      c.width, c.height,
      tileImgsRef.current,
      stairImgsRef.current,
      pendingTile, pendingPos,
      currentRoomId === config?.defaultRoomId,
    );
  }, [room, currentRoomId, config, selectedDesk, selectedStair, hoveredDesk, hoveredStair, hoveredSpawn, hoveredStairSpawn, dragPreview, dragTarget, pendingTile, pendingPos]);

  useEffect(() => { render(); }, [render]);

  // Resize canvas to container
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !room) return;
    const observer = new ResizeObserver(() => {
      const rect = c.getBoundingClientRect();
      const aspect = (room.halfW * 2) / (room.halfD * 2 + EDITOR_EXTRA_BOTTOM);
      c.width = Math.round(rect.width);
      c.height = Math.round(rect.width / aspect);
      render();
    });
    observer.observe(c);
    const rect = c.getBoundingClientRect();
    const aspect = (room.halfW * 2) / (room.halfD * 2 + EDITOR_EXTRA_BOTTOM);
    c.width = Math.round(rect.width || 600);
    c.height = Math.round((rect.width || 600) / aspect);
    render();
    return () => observer.disconnect();
  }, [room, render]);

  // ─── Mouse events ──────────────────────────────────────────────────────────

  function getMouseWorld(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (c.width / rect.width);
    const cy = (e.clientY - rect.top) * (c.height / rect.height);
    return toWorld(cx, cy);
  }

  const SPAWN_HIT_R = 0.6;

  function hitTest(wx: number, wz: number, r: RoomConfig): DragTarget | null {
    // tiles first (on top)
    for (let i = r.objects.length - 1; i >= 0; i--) {
      if (pointInTile(wx, wz, r.objects[i]!)) return { type: "desk", idx: i };
    }
    for (let i = r.stairs.length - 1; i >= 0; i--) {
      if (pointInStair(wx, wz, r.stairs[i]!)) return { type: "stair", idx: i };
    }
    if (currentRoomId === config?.defaultRoomId &&
        Math.hypot(wx - r.spawn.x, wz - r.spawn.z) <= SPAWN_HIT_R) return { type: "spawn" };
    return null;
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!room) return;
    const w = getMouseWorld(e);
    if (!w) return;
    // Pending tile placement
    if (pendingTile) {
      const sz = TILE_SIZES[pendingTile];
      const snappedX = snapAxis(w.wx, sz.width);
      const snappedZ = snapAxis(w.wz, sz.depth);
      placePendingTile(pendingTile, snappedX, snappedZ);
      return;
    }
    const hit = hitTest(w.wx, w.wz, room);
    if (hit) {
      let origin: { x: number; z: number };
      if (hit.type === "desk") origin = { x: room.objects[hit.idx]!.x, z: room.objects[hit.idx]!.z };
      else if (hit.type === "stair") origin = { x: room.stairs[hit.idx]!.x, z: room.stairs[hit.idx]!.z };
      else origin = { x: room.spawn.x, z: room.spawn.z };
      dragRef.current = {
        active: true,
        target: hit,
        startWorld: { x: w.wx, z: w.wz },
        objOrigin: origin,
      };
      if (hit.type === "desk") { setSelectedDesk(hit.idx); setSelectedStair(null); }
      else if (hit.type === "stair") { setSelectedStair(hit.idx); setSelectedDesk(null); }
      else { setSelectedDesk(null); setSelectedStair(null); }
      setDragTarget(hit);
      setDragPreview(origin);
    } else {
      setSelectedDesk(null);
      setSelectedStair(null);
    }
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!room) return;
    const w = getMouseWorld(e);
    if (!w) return;

    // Pending tile follows mouse
    if (pendingTile) {
      const sz = TILE_SIZES[pendingTile];
      const snappedX = snapAxis(w.wx, sz.width);
      const snappedZ = snapAxis(w.wz, sz.depth);
      setPendingPos({ x: snappedX, z: snappedZ });
      return;
    }

    if (dragRef.current.active && dragRef.current.target) {
      const dx = w.wx - dragRef.current.startWorld.x;
      const dz = w.wz - dragRef.current.startWorld.z;
      let nx = dragRef.current.objOrigin.x + dx;
      let nz = dragRef.current.objOrigin.z + dz;
      // snap inside grid cells — even-size tiles center on integers, odd-size on x.5
      const target = dragRef.current.target;
      if (target.type === "desk") {
        const d = room.objects[target.idx]!;
        nx = snapAxis(nx, d.width);
        nz = snapAxis(nz, d.depth);
      } else {
        nx = Math.floor(nx) + 0.5;
        nz = Math.floor(nz) + 0.5;
      }
      // clamp inside room
      if (target.type === "desk") {
        const d = room.objects[target.idx]!;
        const maxZ = room.halfD + EDITOR_EXTRA_BOTTOM - d.depth / 2;
        nx = Math.max(-room.halfW + d.width / 2, Math.min(room.halfW - d.width / 2, nx));
        nz = Math.max(-room.halfD + d.depth / 2, Math.min(maxZ, nz));
      } else if (target.type === "stair") {
        const st = room.stairs[target.idx]!;
        const maxZ = room.halfD + EDITOR_EXTRA_BOTTOM - st.depth / 2;
        nx = Math.max(-room.halfW + st.width / 2, Math.min(room.halfW - st.width / 2, nx));
        nz = Math.max(-room.halfD + st.depth / 2, Math.min(maxZ, nz));
      } else {
        // spawn or stair-spawn — clamp with small margin inside current room
        nx = Math.max(-room.halfW + 0.3, Math.min(room.halfW - 0.3, nx));
        nz = Math.max(-room.halfD + 0.3, Math.min(room.halfD + EDITOR_EXTRA_BOTTOM - 0.3, nz));
      }
      setDragPreview({ x: nx, z: nz });
    } else {
      const hit = hitTest(w.wx, w.wz, room);
      setHoveredDesk(hit?.type === "desk" ? hit.idx : null);
      setHoveredStair(hit?.type === "stair" ? hit.idx : null);
      setHoveredSpawn(hit?.type === "spawn" === true);
      setHoveredStairSpawn(null);
    }
  }

  function onMouseUp(_e: React.MouseEvent<HTMLCanvasElement>) {
    if (!room || !dragRef.current.active || !dragRef.current.target || !dragPreview) {
      dragRef.current.active = false;
      setDragTarget(null);
      setDragPreview(null);
      return;
    }
    const target = dragRef.current.target;
    dragRef.current.active = false;

    setConfig((prev) => {
      if (!prev) return prev;
      const rooms = { ...prev.rooms };
      const r = { ...rooms[currentRoomId]! };
      if (target.type === "desk") {
        const objs = [...r.objects];
        objs[target.idx] = { ...objs[target.idx]!, x: dragPreview.x, z: dragPreview.z };
        r.objects = objs;
      } else if (target.type === "stair") {
        const stairs = [...r.stairs];
        const moved = { ...stairs[target.idx]!, x: dragPreview.x, z: dragPreview.z };
        stairs[target.idx] = moved;
        r.stairs = stairs;
        // Auto-update spawnOnArrival in target room
        const targetRoom = rooms[moved.targetRoomId];
        if (targetRoom) {
          const skin = moved.skin ?? "stair-to-top";
          const spawnZ = skin === "stair-to-top"
            ? targetRoom.halfD - 0.5   // arrive en bas de la map cible
            : -targetRoom.halfD + 0.5; // arrive en haut de la map cible
          const updated = { ...targetRoom };
          updated.stairs = updated.stairs.map((s) =>
            s.id === moved.id ? { ...s, spawnOnArrival: { x: dragPreview.x, z: spawnZ } } : s,
          );
          rooms[moved.targetRoomId] = updated;
        }
      } else if (target.type === "spawn") {
        // Autoriser uniquement si pas sur une tile solide
        const onSolid = r.objects.some((o) => {
          if (!SOLID_TILES.has(o.tileType)) return false;
          return Math.abs(dragPreview.x - o.x) < o.width / 2 &&
                 Math.abs(dragPreview.z - o.z) < o.depth / 2;
        });
        if (!onSolid) r.spawn = { x: dragPreview.x, z: dragPreview.z };
      }
      rooms[currentRoomId] = r;
      return { ...prev, rooms };
    });

    setDragTarget(null);
    setDragPreview(null);
  }

  function onMouseLeave() {
    if (dragRef.current.active) {
      dragRef.current.active = false;
      setDragTarget(null);
      setDragPreview(null);
    }
    if (pendingTile) setPendingPos(null);
    setHoveredDesk(null);
    setHoveredStair(null);
    setHoveredSpawn(false);
    setHoveredStairSpawn(null);
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pendingTile) {
        setPendingTile(null);
        setPendingPos(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingTile]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  function placePendingTile(tileType: TileType, x: number, z: number) {
    if (!room) return;
    const sizes = TILE_SIZES[tileType];
    const newTile = { type: "tile" as const, tileType, x, z, width: sizes.width, depth: sizes.depth };
    let newSelectedIdx = room.objects.length;
    setConfig((prev) => {
      if (!prev) return prev;
      const rooms = { ...prev.rooms };
      const r = { ...rooms[currentRoomId]! };
      const existingIdx = r.objects.findIndex((o) => o.x === x && o.z === z);
      if (existingIdx !== -1) {
        const objs = [...r.objects];
        objs[existingIdx] = newTile;
        r.objects = objs;
        newSelectedIdx = existingIdx;
      } else {
        r.objects = [...r.objects, newTile];
      }
      rooms[currentRoomId] = r;
      return { ...prev, rooms };
    });
    setSelectedDesk(newSelectedIdx);
    setSelectedStair(null);
    setSuccess(false);
    setPendingPos(null);
  }

  function addTile(tileType: TileType) {
    setPendingTile(tileType);
    setPendingPos(null);
    setSelectedDesk(null);
    setSelectedStair(null);
  }

  function addStair(skin: "stair-to-bottom" | "stair-to-top") {
    if (!config) return;
    const ids = Object.keys(config.rooms);
    const targetRoomId = ids.find((id) => id !== currentRoomId) ?? ids[0] ?? "";
    if (!targetRoomId || targetRoomId === currentRoomId) return;
    const targetRoom = config.rooms[targetRoomId]!;
    const currentRoom = config.rooms[currentRoomId]!;

    // spawnOnArrival = 1 case devant l'escalier de destination
    const spawnZ = skin === "stair-to-bottom"
      ? -targetRoom.halfD + 1.5   // arrivée en haut de la cible (devant stair-to-top)
      : targetRoom.halfD - 1.5;   // arrivée en bas de la cible (devant stair-to-bottom)

    // position par défaut = bord correspondant de la map courante
    const stairZ = skin === "stair-to-bottom"
      ? currentRoom.halfD - 0.5
      : -currentRoom.halfD + 0.5;

    const existingId = (currentRoom.stairs ?? []).find((s) => s.skin === skin)?.id;
    const newStair: StairObj = {
      id: existingId ?? `${currentRoomId}-${skin}-${Date.now()}`,
      x: 0,
      z: stairZ,
      width: 1.1,
      depth: 1.1,
      targetRoomId,
      interactRadius: 1.35,
      spawnOnArrival: { x: 0, z: spawnZ },
      skin,
    };

    setConfig((prev) => {
      if (!prev) return prev;
      const rooms = { ...prev.rooms };
      const r = { ...rooms[currentRoomId]! };
      // Remplace l'escalier existant du même skin, sinon ajoute
      const stairs = [...(r.stairs ?? [])];
      const idx = stairs.findIndex((s) => s.skin === skin);
      if (idx !== -1) stairs[idx] = newStair;
      else stairs.push(newStair);
      r.stairs = stairs;
      rooms[currentRoomId] = r;
      return { ...prev, rooms };
    });
    setSelectedStair(null);
    setSelectedDesk(null);
    setSuccess(false);
  }

  function onDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!room || pendingTile) return;
    const w = getMouseWorld(e);
    if (!w) return;
    const hit = hitTest(w.wx, w.wz, room);
    if (hit?.type !== "desk") return;
    const idx = hit.idx;
    setConfig((prev) => {
      if (!prev) return prev;
      const rooms = { ...prev.rooms };
      const r = { ...rooms[currentRoomId]! };
      r.objects = r.objects.filter((_, i) => i !== idx);
      rooms[currentRoomId] = r;
      return { ...prev, rooms };
    });
    setSelectedDesk(null);
    setSuccess(false);
  }

  function deleteSelectedDesk() {
    if (selectedDesk === null || !room) return;
    const idx = selectedDesk;
    setConfig((prev) => {
      if (!prev) return prev;
      const rooms = { ...prev.rooms };
      const r = { ...rooms[currentRoomId]! };
      r.objects = r.objects.filter((_, i) => i !== idx);
      rooms[currentRoomId] = r;
      return { ...prev, rooms };
    });
    setSelectedDesk(null);
    setSuccess(false);
  }

  function updateSelectedTile(field: "x" | "z", value: number) {
    if (selectedDesk === null) return;
    setConfig((prev) => {
      if (!prev) return prev;
      const rooms = { ...prev.rooms };
      const r = { ...rooms[currentRoomId]! };
      const objs = [...r.objects];
      objs[selectedDesk] = { ...objs[selectedDesk]!, [field]: value };
      r.objects = objs;
      rooms[currentRoomId] = r;
      return { ...prev, rooms };
    });
    setSuccess(false);
  }

  function handleExport() {
    if (!config) return;
    const exportData: Record<string, { objects: DeskObj[]; stairs: StairObj[] }> = {};
    for (const [id, r] of Object.entries(config.rooms)) {
      exportData[id] = { objects: r.objects, stairs: r.stairs };
    }
    const data = JSON.stringify(exportData, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "maps.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (!parsed || typeof parsed !== "object") throw new Error("Format invalide");
          setConfig((prev) => {
            if (!prev) return prev;
            const rooms = { ...prev.rooms };
            // Multi-room format: { roomId: { objects, stairs }, ... }
            const isMultiRoom = Object.keys(parsed).some((k) => k in rooms);
            if (isMultiRoom) {
              for (const [id, val] of Object.entries(parsed) as [string, { objects?: unknown; stairs?: unknown }][]) {
                if (!(id in rooms)) continue;
                const r = { ...rooms[id]! };
                if (Array.isArray(val.objects)) r.objects = val.objects;
                if (Array.isArray(val.stairs)) r.stairs = val.stairs;
                rooms[id] = r;
              }
            } else {
              // Legacy single-room format: { objects, stairs }
              const r = { ...rooms[currentRoomId]! };
              if (Array.isArray(parsed.objects)) r.objects = parsed.objects;
              if (Array.isArray(parsed.stairs)) r.stairs = parsed.stairs;
              rooms[currentRoomId] = r;
            }
            return { ...prev, rooms };
          });
          setSelectedDesk(null);
          setSelectedStair(null);
          setSuccess(false);
        } catch {
          setError("Fichier JSON invalide.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function handleReset() {
    if (!window.confirm("Remettre les deux maps à zéro ?")) return;
    setError(null);
    setSuccess(false);
    setResetting(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
    if (!token) { setError("Non authentifié."); setResetting(false); return; }
    axiosInstance
      .delete("/pokemon/config", { headers: { Authorization: token } })
      .then(() => axiosInstance.get<PokemonConfig>("/pokemon/config", { headers: { Authorization: token } }))
      .then((r) => {
        setConfig(r.data);
        setCurrentRoomId(r.data.defaultRoomId);
        setResetting(false);
        onSaved?.();
      })
      .catch((e) => {
        setError(e?.response?.data?.error ?? e.message ?? "Erreur de reset.");
        setResetting(false);
      });
  }

  function handleSave() {
    if (!config) return;
    setError(null);
    setSuccess(false);
    setSaving(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
    if (!token) { setError("Non authentifié."); setSaving(false); return; }
    axiosInstance
      .put("/pokemon/config", config, {
        headers: { Authorization: token, "Content-Type": "application/json" },
      })
      .then(() => {
        setSuccess(true);
        setSaving(false);
        onSaved?.();
      })
      .catch((e) => {
        setError(e?.response?.data?.error ?? e.message ?? "Erreur de sauvegarde.");
        setSaving(false);
      });
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-soft/30 p-4">
        <div className="py-8 text-center text-sm text-muted">Chargement…</div>
      </div>
    );
  }

  const roomIds = config ? Object.keys(config.rooms) : [];
  const selDeskObj = selectedDesk !== null && room ? room.objects[selectedDesk] ?? null : null;
  const selStairObj = selectedStair !== null && room ? room.stairs[selectedStair] ?? null : null;

  return (
    <div className="rounded-xl border border-border bg-soft/30 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Editer la map</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:bg-soft/60 hover:text-foreground"
          >
            Importer
          </button>
          <button
            onClick={handleExport}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:bg-soft/60 hover:text-foreground"
          >
            Exporter
          </button>
          <button
            onClick={handleReset}
            disabled={resetting || saving}
            className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 transition-colors"
          >
            {resetting ? "Reset…" : "Reset"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || resetting}
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </button>
          <button
            onClick={onClose}
            className="rounded px-2 py-1.5 text-xs text-muted hover:bg-soft/60 hover:text-foreground"
          >
            Fermer
          </button>
        </div>
      </div>

      {/* Room selector */}
      {roomIds.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Salle :</span>
          <div className="flex gap-1.5">
            {roomIds.map((id) => (
              <button
                key={id}
                onClick={() => { setCurrentRoomId(id); setSelectedDesk(null); setSelectedStair(null); }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${currentRoomId === id ? "bg-primary text-black shadow-sm" : "border border-border bg-white text-foreground hover:bg-soft/60"}`}
              >
                {config?.rooms[id]?.label ?? id}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Room label editor */}
      {room && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Nom de la salle :</span>
          <input
            type="text"
            value={room.label ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setConfig((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  rooms: {
                    ...prev.rooms,
                    [currentRoomId]: { ...prev.rooms[currentRoomId]!, label: val },
                  },
                };
              });
              setSuccess(false);
            }}
            className="rounded border border-border bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder={currentRoomId}
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setPendingTile(null); setPendingPos(null); }}
          title="Souris — mode sélection/déplacement"
          className={`rounded border p-0.5 w-9 h-9 flex items-center justify-center text-base transition-colors ${!pendingTile ? "border-primary bg-soft/60 text-foreground" : "border-border hover:border-primary hover:bg-soft/60 text-muted"}`}
        >
          🖱️
        </button>
{TILE_TYPES.map((tt) => (
          <button
            key={tt}
            onClick={() => addTile(tt)}
            title={TILE_LABELS[tt]}
            className="rounded border border-border p-0.5 hover:border-primary hover:bg-soft/60"
          >
            <img src={`/pokemon/tiles/${tt}.png`} alt={TILE_LABELS[tt]} width={32} height={32} className="block w-8 h-8 rounded" />
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="relative w-full rounded-lg overflow-hidden border border-border bg-[#86efac]">
        <canvas
          ref={canvasRef}
          className={`w-full block select-none ${pendingTile ? "cursor-cell" : "cursor-crosshair"}`}
          style={{ touchAction: "none" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onDoubleClick={onDoubleClick}
        />
      </div>

      {/* Selected tile inspector */}
      {selDeskObj && (
        <div className="rounded-lg border border-border bg-soft/20 p-3 space-y-2">
          <span className="text-xs font-medium text-foreground">
            {TILE_LABELS[selDeskObj.tileType]} — {SOLID_TILES.has(selDeskObj.tileType) ? "Solide (collision)" : "Décoratif"}
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {(["x", "z"] as const).map((field) => (
              <label key={field} className="flex flex-col gap-0.5">
                <span className="text-muted capitalize">{field}</span>
                <input
                  type="number"
                  step="0.25"
                  value={selDeskObj[field]}
                  onChange={(e) => updateSelectedTile(field, parseFloat(e.target.value) || 0)}
                  className="rounded border border-border bg-white px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {selStairObj && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
          <div className="text-xs font-medium text-violet-800 mb-1">
            Escalier — {selStairObj.id} → {selStairObj.targetRoomId}
          </div>
          <div className="text-xs text-violet-600">
            Position : x={selStairObj.x.toFixed(2)}, z={selStairObj.z.toFixed(2)}
            <br />Glissez l&apos;escalier sur la map pour le déplacer.
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          Configuration sauvegardée. La map a été mise à jour.
        </div>
      )}
    </div>
  );
}
