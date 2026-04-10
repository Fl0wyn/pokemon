import * as fs from "fs";
import * as path from "path";
import { PokemonConfig } from "../../models/PokemonConfig";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Layout slice used for bounds / spawn (legacy shape). */
export type PokemonRoomDef = {
  halfW: number;
  halfD: number;
  defaultSpawn: { x: number; z: number };
};

export type TileType = "rock" | "tree" | "water" | "grass" | "flower" | "sand" | "water-bridge" | "water-bridge-0" | "sand-water-1" | "sand-water-2" | "sand-water-3" | "sand-water-4" | "sand-water-a" | "sand-water-b" | "sand-water-c" | "sand-water-d" | "water-bridge-1" | "water-bridge-2" | "water-bridge-3" | "water-bridge-4" | "water-bridge-a" | "water-bridge-b" | "water-bridge-c" | "water-bridge-d" | "grass-water-1" | "grass-water-2" | "grass-water-3" | "grass-water-4" | "grass-water-5" | "grass-water-6" | "grass-water-a" | "grass-water-b" | "grass-tall-water-1" | "grass-tall-water-2" | "grass-corner" | "rock-water" | "sand-castle" | "sand-tree" | "house" | "chair";

/** Fixed sizes (world units) for each tile type. */
export const TILE_SIZES: Record<TileType, { width: number; depth: number }> = {
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

/** Tile types that block movement (same collision as old "desk"). */
export const SOLID_TILE_TYPES = new Set<TileType>(["rock", "tree", "water", "grass-tall-water-1", "grass-tall-water-2", "sand-tree", "house", "sand-castle"]);

export type PokemonDeskObject = {
  type: "tile";
  tileType: TileType;
  x: number;
  z: number;
  width: number;
  depth: number;
};

export type PokemonStairObject = {
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

export type PokemonRoomRuntime = PokemonRoomDef & {
  label?: string;
  objects: PokemonDeskObject[];
  stairs: PokemonStairObject[];
};

export type RawConfig = {
  version: number;
  defaultRoomId: string;
  rooms: Record<
    string,
    {
      label?: string;
      halfW: number;
      halfD: number;
      spawn: { x: number; z: number };
      objects?: unknown[];
      stairs?: unknown[];
    }
  >;
};

// ─── Parsing / validation ─────────────────────────────────────────────────────

function asNum(v: unknown, field: string): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  throw new Error(`Champ numérique invalide: ${field}`);
}

const VALID_TILE_TYPES: TileType[] = ["rock", "tree", "water", "grass", "flower", "sand", "water-bridge", "water-bridge-0", "sand-water-1", "sand-water-2", "sand-water-3", "sand-water-4", "sand-water-a", "sand-water-b", "sand-water-c", "sand-water-d", "water-bridge-1", "water-bridge-2", "water-bridge-3", "water-bridge-4", "water-bridge-a", "water-bridge-b", "water-bridge-c", "water-bridge-d", "grass-water-1", "grass-water-2", "grass-water-3", "grass-water-4", "grass-water-5", "grass-water-6", "grass-water-a", "grass-water-b", "grass-tall-water-1", "grass-tall-water-2", "grass-corner", "rock-water", "sand-castle", "sand-tree", "house", "chair"];

function parseTile(o: unknown, idx: number): PokemonDeskObject {
  if (!o || typeof o !== "object") throw new Error(`objects[${idx}] invalide`);
  const r = o as Record<string, unknown>;
  // Accept legacy "desk" type as "rock" for backwards-compatibility.
  if (r.type !== "tile" && r.type !== "desk") throw new Error(`objects[${idx}]: type inconnu (attendu "tile")`);
  const rawTileType = r.type === "desk" ? "rock" : r.tileType;
  if (!VALID_TILE_TYPES.includes(rawTileType as TileType)) {
    throw new Error(`objects[${idx}]: tileType invalide (${rawTileType})`);
  }
  const tt = rawTileType as TileType;
  const fixed = TILE_SIZES[tt];
  return {
    type: "tile",
    tileType: tt,
    x: asNum(r.x, "tile.x"),
    z: asNum(r.z, "tile.z"),
    width: fixed.width,
    depth: fixed.depth,
  };
}

function parseStair(o: unknown, idx: number): PokemonStairObject {
  if (!o || typeof o !== "object") throw new Error(`stairs[${idx}] invalide`);
  const r = o as Record<string, unknown>;
  const spawn = r.spawnOnArrival as Record<string, unknown> | undefined;
  if (!spawn) throw new Error(`stairs[${idx}].spawnOnArrival requis`);
  return {
    id: typeof r.id === "string" && r.id ? r.id : `stair-${idx}`,
    x: asNum(r.x, "stair.x"),
    z: asNum(r.z, "stair.z"),
    width: asNum(r.width, "stair.width"),
    depth: asNum(r.depth, "stair.depth"),
    targetRoomId:
      typeof r.targetRoomId === "string" && r.targetRoomId ? r.targetRoomId : "",
    interactRadius: asNum(r.interactRadius, "stair.interactRadius"),
    spawnOnArrival: {
      x: asNum(spawn.x, "spawnOnArrival.x"),
      z: asNum(spawn.z, "spawnOnArrival.z"),
    },
    ...(typeof r.skin === "string" && r.skin ? { skin: r.skin } : {}),
  };
}

export function parseConfig(raw: RawConfig): {
  defaultRoomId: string;
  rooms: Record<string, PokemonRoomRuntime>;
} {
  if (!raw || raw.version !== 1) throw new Error("version 1 requise");
  if (typeof raw.defaultRoomId !== "string" || !raw.defaultRoomId) {
    throw new Error("defaultRoomId manquant");
  }
  const rooms: Record<string, PokemonRoomRuntime> = {};
  for (const [id, room] of Object.entries(raw.rooms || {})) {
    const objects = (room.objects ?? []).map((o, i) => parseTile(o, i));
    const stairs = (room.stairs ?? []).map((s, i) => parseStair(s, i));
    for (const s of stairs) {
      if (!s.targetRoomId) throw new Error(`stairs: targetRoomId manquant (${id})`);
    }
    rooms[id] = {
      label: typeof room.label === "string" ? room.label : undefined,
      halfW: asNum(room.halfW, `${id}.halfW`),
      halfD: asNum(room.halfD, `${id}.halfD`),
      defaultSpawn: {
        x: asNum(room.spawn?.x, `${id}.spawn.x`),
        z: asNum(room.spawn?.z, `${id}.spawn.z`),
      },
      objects,
      stairs,
    };
  }
  if (!rooms[raw.defaultRoomId]) {
    throw new Error(`defaultRoomId "${raw.defaultRoomId}" absent des rooms`);
  }
  for (const r of Object.values(rooms)) {
    for (const s of r.stairs) {
      if (!rooms[s.targetRoomId]) {
        throw new Error(`Cible stair inconnue: ${s.targetRoomId}`);
      }
    }
  }
  return { defaultRoomId: raw.defaultRoomId, rooms };
}

// ─── Seed from JSON file (used for first boot / migration) ───────────────────

function resolveJsonConfigPath(): string | null {
  const fromDist = path.join(__dirname, "pokemonRooms.config.json");
  if (fs.existsSync(fromDist)) return fromDist;
  const fromSrc = path.join(
    process.cwd(),
    "src",
    "services",
    "pokemonService",
    "pokemonRooms.config.json",
  );
  if (fs.existsSync(fromSrc)) return fromSrc;
  return null;
}

function readJsonConfig(): RawConfig | null {
  const p = resolveJsonConfigPath();
  if (!p) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as RawConfig;
  } catch {
    return null;
  }
}

// ─── In-memory state ─────────────────────────────────────────────────────────

// Bootstrap from JSON synchronously so the service is usable before DB is ready.
const _jsonSeed = readJsonConfig();
if (!_jsonSeed) throw new Error("pokemonRooms.config.json introuvable au démarrage.");

let _raw: RawConfig = _jsonSeed;
let _parsed = parseConfig(_raw);

function applyRaw(raw: RawConfig): void {
  _parsed = parseConfig(raw);
  _raw = raw;
  // Sync POKEMON_ROOMS in place so existing references stay valid.
  for (const key of Object.keys(POKEMON_ROOMS)) delete POKEMON_ROOMS[key];
  for (const [id, r] of Object.entries(_parsed.rooms)) {
    POKEMON_ROOMS[id] = { halfW: r.halfW, halfD: r.halfD, defaultSpawn: r.defaultSpawn };
  }
}

// ─── DB persistence ───────────────────────────────────────────────────────────

const DB_KEY = "main";

/**
 * Called once at startup (after Mongoose connects).
 * Loads config from DB if it exists, otherwise seeds it from the JSON file.
 */
function hasLegacyDeskObjects(rooms: RawConfig["rooms"]): boolean {
  return Object.values(rooms).some((r) =>
    (r.objects ?? []).some((o: unknown) => (o as Record<string, unknown>).type === "desk"),
  );
}

function hasStairsWithoutSkin(rooms: RawConfig["rooms"]): boolean {
  return Object.values(rooms).some((r) =>
    (r.stairs ?? []).some((s: unknown) => !(s as Record<string, unknown>).skin),
  );
}

/** Détecte si un escalier connu a un skin inversé par rapport au JSON de référence. */
function hasInvertedStairSkins(rooms: RawConfig["rooms"]): boolean {
  for (const [roomId, room] of Object.entries(rooms)) {
    const refRoom = _raw.rooms[roomId];
    if (!refRoom) continue;
    for (const stair of room.stairs ?? []) {
      const s = stair as Record<string, unknown>;
      const refStair = (refRoom.stairs ?? []).find(
        (rs: unknown) => (rs as Record<string, unknown>).id === s.id,
      ) as Record<string, unknown> | undefined;
      if (refStair && refStair.skin && s.skin !== refStair.skin) return true;
    }
  }
  return false;
}


export async function initPokemonConfigFromDb(): Promise<void> {
  const doc = await PokemonConfig.findOne({ key: DB_KEY }).lean();
  if (doc) {
    const dbRooms = doc.rooms as RawConfig["rooms"];
    // If DB still has legacy "desk" objects or stairs without skin, reseed from JSON file.
    if (hasLegacyDeskObjects(dbRooms) || hasStairsWithoutSkin(dbRooms)) {
      console.log("[pokemon] Migration BDD détectée — reseed depuis le JSON.");
      await PokemonConfig.findOneAndUpdate(
        { key: DB_KEY },
        { $set: { version: _raw.version, defaultRoomId: _raw.defaultRoomId, rooms: _raw.rooms } },
        { upsert: true },
      );
      applyRaw(_raw);
      console.log("[pokemon] Config mise à jour depuis le JSON.");
      return;
    }
    let rooms = dbRooms;
    if (hasInvertedStairSkins(rooms)) {
      console.log("[pokemon] Migration escaliers inversés — correction des skins/positions.");
      // Patch only stair skin, z, and spawnOnArrival from JSON reference, keep objects intact
      const patchedRooms: RawConfig["rooms"] = {};
      for (const [roomId, room] of Object.entries(rooms)) {
        const refRoom = _raw.rooms[roomId];
        const patchedStairs = (room.stairs ?? []).map((stair: unknown) => {
          const s = stair as Record<string, unknown>;
          const refStair = refRoom
            ? (refRoom.stairs ?? []).find(
                (rs: unknown) => (rs as Record<string, unknown>).id === s.id,
              ) as Record<string, unknown> | undefined
            : undefined;
          if (refStair && refStair.skin !== s.skin) {
            return { ...s, skin: refStair.skin, z: refStair.z, spawnOnArrival: refStair.spawnOnArrival };
          }
          return s;
        });
        patchedRooms[roomId] = { ...room, stairs: patchedStairs };
      }
      rooms = patchedRooms;
      await PokemonConfig.findOneAndUpdate(
        { key: DB_KEY },
        { $set: { rooms } },
        { upsert: true },
      );
      console.log("[pokemon] Escaliers corrigés en BDD.");
    }
    const raw: RawConfig = {
      version: doc.version,
      defaultRoomId: doc.defaultRoomId,
      rooms,
    };
    applyRaw(raw);
    console.log("[pokemon] Config chargée depuis la BDD.");
  } else {
    // First boot: seed DB from JSON file.
    await PokemonConfig.create({
      key: DB_KEY,
      version: _raw.version,
      defaultRoomId: _raw.defaultRoomId,
      rooms: _raw.rooms,
    });
    console.log("[pokemon] Config initialisée en BDD depuis le fichier JSON.");
  }
}

/** Returns the raw config currently in memory. */
export function getRawPokemonConfig(): RawConfig {
  return _raw;
}

/**
 * Validates, persists to DB, and reloads in-memory state.
 * Returns a map of roomId → old spawn position for rooms whose spawn changed.
 * Throws on validation error.
 */
export async function savePokemonConfig(
  raw: RawConfig,
): Promise<Record<string, { x: number; z: number }>> {
  // Validate first — throws if invalid.
  parseConfig(raw);

  // Collect new spawn positions for all rooms (teleport all players on save).
  const changedSpawns: Record<string, { x: number; z: number }> = {};
  for (const [id, newRoom] of Object.entries(raw.rooms)) {
    changedSpawns[id] = { x: newRoom.spawn.x, z: newRoom.spawn.z };
  }

  await PokemonConfig.findOneAndUpdate(
    { key: DB_KEY },
    { $set: { version: raw.version, defaultRoomId: raw.defaultRoomId, rooms: raw.rooms } },
    { upsert: true },
  );
  applyRaw(raw);
  return changedSpawns;
}

// ─── Public read API ─────────────────────────────────────────────────────────

export let DEFAULT_POKEMON_ROOM_ID = _parsed.defaultRoomId;

/** Minimal map for clamp / spawn (legacy shape). */
export const POKEMON_ROOMS: Record<string, PokemonRoomDef> = Object.fromEntries(
  Object.entries(_parsed.rooms).map(([id, r]) => [
    id,
    { halfW: r.halfW, halfD: r.halfD, defaultSpawn: r.defaultSpawn },
  ]),
);

export function getPokemonRoom(roomId: string): PokemonRoomDef | null {
  return POKEMON_ROOMS[roomId] ?? null;
}

export function getPokemonRoomRuntime(roomId: string): PokemonRoomRuntime | null {
  return _parsed.rooms[roomId] ?? null;
}

export function listPokemonRoomIds(): string[] {
  return Object.keys(_parsed.rooms);
}

/** Payload for clients (Three.js + interaction). */
export function getClientRoomScene(roomId: string): {
  objects: (PokemonDeskObject & { solid: boolean })[];
  stairs: Array<{
    id: string;
    x: number;
    z: number;
    width: number;
    depth: number;
    interactRadius: number;
    targetRoomId: string;
  }>;
} | null {
  const r = _parsed.rooms[roomId];
  if (!r) return null;
  return {
    objects: r.objects.map((d) => ({ ...d, solid: SOLID_TILE_TYPES.has(d.tileType) })),
    stairs: r.stairs.map((s) => ({
      id: s.id,
      x: s.x,
      z: s.z,
      width: s.width,
      depth: s.depth,
      interactRadius: s.interactRadius,
      targetRoomId: s.targetRoomId,
      ...(s.skin ? { skin: s.skin } : {}),
    })),
  };
}

export function findStairDef(roomId: string, stairId: string): PokemonStairObject | null {
  const r = _parsed.rooms[roomId];
  if (!r) return null;
  return r.stairs.find((s) => s.id === stairId) ?? null;
}

const STAIR_EPS = 0.08;

export function canUseStairAtPosition(
  roomId: string,
  stairId: string,
  px: number,
  pz: number,
): PokemonStairObject | null {
  const st = findStairDef(roomId, stairId);
  if (!st) return null;
  const dx = px - st.x;
  const dz = pz - st.z;
  const maxD = st.interactRadius + STAIR_EPS;
  if (dx * dx + dz * dz > maxD * maxD) return null;
  return st;
}
