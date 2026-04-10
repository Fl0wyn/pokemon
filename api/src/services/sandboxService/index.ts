import mongoose from "mongoose";
import type { Server as SocketIOServer } from "socket.io";
import type { Socket } from "socket.io";
import { User } from "../../models/User";
import { SandboxEggClaim } from "../../models/SandboxEggClaim";
import { SandboxMonsterCatch } from "../../models/SandboxMonsterCatch";
import { SandboxPlacement } from "../../models/SandboxPlacement";
import {
  socketUserService,
  TOOLBOX_PAGE,
} from "../socketUserService";
import type {
  UserSocketAttachContext,
  UserSocketExtension,
  UserSocketPageNavigationContext,
} from "../socketUserService/userSocketExtensions";
import {
  DEFAULT_SANDBOX_ROOM_ID,
  SOLID_TILE_TYPES,
  canUseStairAtPosition,
  findStairDef,
  getClientRoomScene,
  getSandboxRoom,
  getSandboxRoomRuntime,
  listSandboxRoomIds,
  type SandboxRoomDef,
} from "./rooms";
import {
  getResumeSandboxRoomId,
  persistLastSandboxRoomId,
} from "./sandboxLastRoom";
import { generateEggSvg } from "./eggGeneratorService";
import { randomMonsterName } from "./monsterGeneratorService";

const AVATAR_RADIUS = 0.3;
const EGG_RESPAWN_MS = 5000;
const EGG_PICK_RADIUS = 1.1;
const EGG_RADIUS = 0.35;
const MONSTER_RESPAWN_MS = 8000;
const MONSTER_PICK_RADIUS = 1.1;
const MONSTER_RADIUS = 0.35;

type SandboxPlayerState = {
  x: number;
  z: number;
  previewKey: string | null;
};

type SandboxEggState = {
  id: string;
  roomId: string;
  x: number;
  z: number;
  svg: string;
};

type SandboxMonsterState = {
  id: string;
  roomId: string;
  x: number;
  z: number;
  name: string;
};

type ScoreRow = {
  userId: string;
  email: string;
  eggs: number;
  unique: number;
  svgs: string[];
};

function normalizeRoomId(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return DEFAULT_SANDBOX_ROOM_ID;
  const id = raw.trim();
  return getSandboxRoom(id) ? id : DEFAULT_SANDBOX_ROOM_ID;
}

class SandboxService implements UserSocketExtension {
  /** `${userId}::${roomId}` → live position for online users */
  private playerState = new Map<string, SandboxPlayerState>();
  private persistTimers = new Map<string, NodeJS.Timeout>();
  private egg: SandboxEggState | null = null;
  private eggRespawnTimer: NodeJS.Timeout | null = null;
  private monster: SandboxMonsterState | null = null;
  private monsterRespawnTimer: NodeJS.Timeout | null = null;
  private registered = false;

  initialize(): void {
    if (this.registered) return;
    this.registered = true;
    this.egg = this.randomSpawnEgg();
    this.monster = this.randomSpawnMonster();
    socketUserService.registerUserSocketExtension(this);
  }

  private channel(roomId: string): string {
    return `sandbox:${roomId}`;
  }

  private stateKey(userId: string, roomId: string): string {
    return `${userId}::${roomId}`;
  }

  private listSandboxSocketIds(io: SocketIOServer): Set<string> {
    const ids = new Set<string>();
    for (const rid of listSandboxRoomIds()) {
      const room = io.sockets.adapter.rooms.get(this.channel(rid));
      if (!room) continue;
      for (const sid of room) ids.add(sid);
    }
    return ids;
  }

  private isPointOnDesk(roomId: string, x: number, z: number): boolean {
    const rt = getSandboxRoomRuntime(roomId);
    if (!rt) return false;
    for (const d of rt.objects) {
      if (!SOLID_TILE_TYPES.has(d.tileType)) continue;
      const halfW = d.width / 2 + EGG_RADIUS;
      const halfD = d.depth / 2 + EGG_RADIUS;
      if (Math.abs(x - d.x) <= halfW && Math.abs(z - d.z) <= halfD) return true;
    }
    // Stair lateral walls (block X, allow Z)
    for (const s of rt.stairs) {
      const wallThick = 0.05 + EGG_RADIUS;
      const halfD = 0.5 + EGG_RADIUS;
      if (Math.abs(z - s.z) <= halfD) {
        if (x >= s.x - 0.5 - wallThick && x <= s.x - 0.5) return true;
        if (x >= s.x + 0.5 && x <= s.x + 0.5 + wallThick) return true;
      }
    }
    return false;
  }

  private randomSpawnEgg(): SandboxEggState | null {
    const roomIds = listSandboxRoomIds();
    if (roomIds.length === 0) return null;
    for (let i = 0; i < 80; i++) {
      const roomId = roomIds[Math.floor(Math.random() * roomIds.length)]!;
      const def = getSandboxRoom(roomId);
      if (!def) continue;
      const x = (Math.random() * 2 - 1) * (def.halfW - EGG_RADIUS - 0.2);
      const z = (Math.random() * 2 - 1) * (def.halfD - EGG_RADIUS - 0.2);
      if (this.isPointOnDesk(roomId, x, z)) continue;
      return {
        id: new mongoose.Types.ObjectId().toString(),
        roomId,
        x,
        z,
        svg: generateEggSvg(),
      };
    }
    return null;
  }

  private broadcastEggState(): void {
    const io = socketUserService.getIO();
    if (!io) return;
    const socketIds = this.listSandboxSocketIds(io);
    for (const sid of socketIds) {
      const sock = io.sockets.sockets.get(sid);
      if (!sock) continue;
      sock.emit("sandbox:egg-state", { egg: this.egg });
    }
  }

  private scheduleEggRespawn(): void {
    if (this.eggRespawnTimer) clearTimeout(this.eggRespawnTimer);
    this.eggRespawnTimer = setTimeout(() => {
      this.eggRespawnTimer = null;
      this.egg = this.randomSpawnEgg();
      this.broadcastEggState();
    }, EGG_RESPAWN_MS);
  }

  // ── Monster system ──────────────────────────────────────────────────────────

  private randomSpawnMonster(): SandboxMonsterState | null {
    const roomIds = listSandboxRoomIds();
    if (roomIds.length === 0) return null;
    for (let i = 0; i < 80; i++) {
      const roomId = roomIds[Math.floor(Math.random() * roomIds.length)]!;
      const def = getSandboxRoom(roomId);
      if (!def) continue;
      const x = (Math.random() * 2 - 1) * (def.halfW - MONSTER_RADIUS - 0.2);
      const z = (Math.random() * 2 - 1) * (def.halfD - MONSTER_RADIUS - 0.2);
      if (this.isPointOnDesk(roomId, x, z)) continue;
      return {
        id: new mongoose.Types.ObjectId().toString(),
        roomId,
        x,
        z,
        name: randomMonsterName(),
      };
    }
    return null;
  }

  private broadcastMonsterState(): void {
    const io = socketUserService.getIO();
    if (!io) return;
    const socketIds = this.listSandboxSocketIds(io);
    for (const sid of socketIds) {
      const sock = io.sockets.sockets.get(sid);
      if (!sock) continue;
      sock.emit("sandbox:monster-state", { monster: this.monster });
    }
  }

  private scheduleMonsterRespawn(): void {
    if (this.monsterRespawnTimer) clearTimeout(this.monsterRespawnTimer);
    this.monsterRespawnTimer = setTimeout(() => {
      this.monsterRespawnTimer = null;
      this.monster = this.randomSpawnMonster();
      this.broadcastMonsterState();
    }, MONSTER_RESPAWN_MS);
  }

  private async collectMonster(socket: Socket, userId: string): Promise<void> {
    if (!this.monster) return;
    if (socket.data.sandboxRoomId !== this.monster.roomId) return;
    const st = this.playerState.get(this.stateKey(userId, this.monster.roomId));
    if (!st) return;
    const dist = Math.hypot(st.x - this.monster.x, st.z - this.monster.z);
    if (dist > MONSTER_PICK_RADIUS) return;

    const taken = this.monster;
    this.monster = null;
    this.broadcastMonsterState();
    this.scheduleMonsterRespawn();

    await SandboxMonsterCatch.create({
      userId: new mongoose.Types.ObjectId(userId),
      roomId: taken.roomId,
      x: taken.x,
      z: taken.z,
      name: taken.name,
    });
    await this.broadcastScores();
  }

  // ── End monster system ──────────────────────────────────────────────────────

  private async buildMonsterScoreboard(): Promise<ScoreRow[]> {
    const rows = await SandboxMonsterCatch.aggregate<{
      _id: mongoose.Types.ObjectId;
      eggs: number;
      names: string[];
    }>([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$userId",
          eggs: { $sum: 1 },
          names: { $addToSet: "$name" },
        },
      },
      { $sort: { eggs: -1, _id: 1 } },
      { $limit: 20 },
    ]);
    if (rows.length === 0) return [];
    const users = await User.find({
      _id: { $in: rows.map((r) => r._id) },
    })
      .select("email")
      .lean();
    const emailById = new Map<string, string>();
    for (const u of users) {
      emailById.set(String(u._id), typeof u.email === "string" ? u.email : "");
    }
    return rows.map((r) => ({
      userId: String(r._id),
      email: emailById.get(String(r._id)) ?? "",
      eggs: r.eggs,
      unique: Array.isArray(r.names) ? r.names.length : 0,
      svgs: [],
    }));
  }

  private async getUserMonsterCatches(userId: string): Promise<{ score: number; catches: Record<string, number> }> {
    const docs = await SandboxMonsterCatch.find({
      userId: new mongoose.Types.ObjectId(userId),
    }).select("name").lean();
    const catches: Record<string, number> = {};
    for (const d of docs) {
      const n = d.name as string;
      catches[n] = (catches[n] ?? 0) + 1;
    }
    return { score: Object.keys(catches).length, catches };
  }

  private async sendScoreToSocket(socket: Socket, userId: string): Promise<void> {
    const [{ score: myScore, catches: myCatches }, hallOfFame] = await Promise.all([
      this.getUserMonsterCatches(userId),
      this.buildMonsterScoreboard(),
    ]);
    socket.emit("sandbox:eggs:score", { myScore, myCatches, hallOfFame });
  }

  private async broadcastScores(): Promise<void> {
    const io = socketUserService.getIO();
    if (!io) return;
    const hallOfFame = await this.buildMonsterScoreboard();
    const socketIds = this.listSandboxSocketIds(io);
    const userCatchCache = new Map<string, { score: number; catches: Record<string, number> }>();
    for (const sid of socketIds) {
      const sock = io.sockets.sockets.get(sid);
      if (!sock) continue;
      const uid = (sock as unknown as { userId?: string }).userId;
      if (!uid) continue;
      let data = userCatchCache.get(uid);
      if (data === undefined) {
        data = await this.getUserMonsterCatches(uid);
        userCatchCache.set(uid, data);
      }
      sock.emit("sandbox:eggs:score", { myScore: data.score, myCatches: data.catches, hallOfFame });
    }
  }

  private async collectEgg(socket: Socket, userId: string): Promise<void> {
    if (!this.egg) return;
    if (socket.data.sandboxRoomId !== this.egg.roomId) return;
    const st = this.playerState.get(this.stateKey(userId, this.egg.roomId));
    if (!st) return;
    const dist = Math.hypot(st.x - this.egg.x, st.z - this.egg.z);
    if (dist > EGG_PICK_RADIUS) return;

    const taken = this.egg;
    this.egg = null;
    this.broadcastEggState();
    this.scheduleEggRespawn();

    await SandboxEggClaim.create({
      userId: new mongoose.Types.ObjectId(userId),
      roomId: taken.roomId,
      x: taken.x,
      z: taken.z,
      svg: taken.svg,
    });
    await this.broadcastScores();
  }

  private clampXZ(
    x: number,
    z: number,
    def: SandboxRoomDef,
  ): { x: number; z: number } {
    const r = AVATAR_RADIUS;
    return {
      x: Math.min(def.halfW - r, Math.max(-def.halfW + r, x)),
      z: Math.min(def.halfD - r, Math.max(-def.halfD + r, z)),
    };
  }

  private schedulePersist(
    userId: string,
    roomId: string,
    x: number,
    z: number,
    previewKey: string | null,
  ): void {
    const key = this.stateKey(userId, roomId);
    const prev = this.persistTimers.get(key);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      this.persistTimers.delete(key);
      void SandboxPlacement.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(userId), roomId },
        { $set: { x, z, previewKey } },
        { upsert: true },
      ).catch((err) => console.error("[sandbox] persist failed:", err));
    }, 500);
    this.persistTimers.set(key, t);
  }

  private async performJoinRoom(
    socket: Socket,
    userId: string,
    getSessionPage: () => string | null,
    roomId: string,
    spawnOverride?: { x: number; z: number },
  ): Promise<void> {
    if (getSessionPage() !== TOOLBOX_PAGE.SANDBOX) return;
    const def = getSandboxRoom(roomId);
    if (!def) return;

    const prev = socket.data.sandboxRoomId as string | undefined;
    if (prev === roomId && !spawnOverride) {
      if (!socket.rooms.has(this.channel(roomId))) {
        socket.join(this.channel(roomId));
      }
      const cur = this.playerState.get(this.stateKey(userId, roomId));
      const x = cur?.x ?? def.defaultSpawn.x;
      const z = cur?.z ?? def.defaultSpawn.z;
      const scene = getClientRoomScene(roomId);
      socket.emit("sandbox:room-joined", {
        roomId,
        x,
        z,
        bounds: { halfW: def.halfW, halfD: def.halfD },
        roomIds: listSandboxRoomIds(),
        defaultRoomId: DEFAULT_SANDBOX_ROOM_ID,
        scene: scene ?? { objects: [], stairs: [] },
      });
      persistLastSandboxRoomId(userId, roomId);
      this.sendPlayersToSocket(socket, roomId);
      socket.emit("sandbox:egg-state", { egg: this.egg });
      socket.emit("sandbox:monster-state", { monster: this.monster });
      void this.sendScoreToSocket(socket, userId);
      return;
    }

    if (prev && prev !== roomId) {
      socket.leave(this.channel(prev));
      this.broadcastRoom(prev);
    }

    socket.join(this.channel(roomId));
    socket.data.sandboxRoomId = roomId;

    let x = def.defaultSpawn.x;
    let z = def.defaultSpawn.z;

    if (
      spawnOverride &&
      Number.isFinite(spawnOverride.x) &&
      Number.isFinite(spawnOverride.z)
    ) {
      const c = this.clampXZ(spawnOverride.x, spawnOverride.z, def);
      x = c.x;
      z = c.z;
    } else {
      const doc = await SandboxPlacement.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        roomId,
      }).lean();
      if (doc) {
        const c = this.clampXZ(doc.x, doc.z, def);
        x = c.x;
        z = c.z;
      }
    }

    const user = socketUserService.getConnectedUserById(userId);
    const thumb = user?.profileImage?.thumbnail ?? null;

    this.playerState.set(this.stateKey(userId, roomId), {
      x,
      z,
      previewKey: thumb,
    });

    const sceneOut = getClientRoomScene(roomId);
    socket.emit("sandbox:room-joined", {
      roomId,
      x,
      z,
      bounds: { halfW: def.halfW, halfD: def.halfD },
      roomIds: listSandboxRoomIds(),
      defaultRoomId: DEFAULT_SANDBOX_ROOM_ID,
      scene: sceneOut ?? { objects: [], stairs: [] },
    });

    persistLastSandboxRoomId(userId, roomId);
    this.broadcastRoom(roomId);
    socket.emit("sandbox:egg-state", { egg: this.egg });
    socket.emit("sandbox:monster-state", { monster: this.monster });
    void this.sendScoreToSocket(socket, userId);
  }

  private leaveSandboxRoom(socket: Socket, roomId: string): void {
    socket.leave(this.channel(roomId));
    delete socket.data.sandboxRoomId;
    this.broadcastRoom(roomId);
  }

  onAttach(ctx: UserSocketAttachContext): void {
    const { socket, userId, getSessionPage } = ctx;

    socket.on("sandbox:join-room", (data: { roomId?: string }) => {
      const roomId = normalizeRoomId(data?.roomId);
      void this.performJoinRoom(socket, userId, getSessionPage, roomId);
    });

    socket.on("sandbox:teleport", (data: {
      roomId?: string;
      x?: unknown;
      z?: unknown;
    }) => {
      const roomId = normalizeRoomId(data?.roomId);
      const ox =
        typeof data.x === "number"
          ? data.x
          : parseFloat(String(data.x ?? ""));
      const oz =
        typeof data.z === "number"
          ? data.z
          : parseFloat(String(data.z ?? ""));
      const spawn =
        Number.isFinite(ox) && Number.isFinite(oz)
          ? { x: ox, z: oz }
          : undefined;
      void this.performJoinRoom(socket, userId, getSessionPage, roomId, spawn);
    });

    socket.on("sandbox:use-stair", (data: { stairId?: string }) => {
      if (getSessionPage() !== TOOLBOX_PAGE.SANDBOX) return;
      const roomId = socket.data.sandboxRoomId as string | undefined;
      const stairId = typeof data?.stairId === "string" ? data.stairId.trim() : "";
      if (!roomId || !stairId) return;

      const state = this.playerState.get(this.stateKey(userId, roomId));
      if (!state) return;

      const allowed = canUseStairAtPosition(
        roomId,
        stairId,
        state.x,
        state.z,
      );
      if (!allowed) {
        socket.emit("sandbox:stair-denied", { reason: "too_far" });
        return;
      }

      const def = findStairDef(roomId, stairId);
      if (!def) return;

      void this.performJoinRoom(
        socket,
        userId,
        getSessionPage,
        def.targetRoomId,
        def.spawnOnArrival,
      );
    });

    socket.on("sandbox:collect-egg", () => {
      if (getSessionPage() !== TOOLBOX_PAGE.SANDBOX) return;
      void this.collectEgg(socket, userId);
    });

    socket.on("sandbox:collect-monster", () => {
      if (getSessionPage() !== TOOLBOX_PAGE.SANDBOX) return;
      void this.collectMonster(socket, userId);
    });

    socket.on(
      "sandbox:position",
      (data: {
        roomId?: unknown;
        x?: unknown;
        z?: unknown;
        previewKey?: unknown;
      }) => {
        if (getSessionPage() !== TOOLBOX_PAGE.SANDBOX) return;
        const roomId = socket.data.sandboxRoomId as string | undefined;
        if (!roomId) return;
        if (typeof data.roomId === "string" && data.roomId !== roomId) return;

        const def = getSandboxRoom(roomId);
        if (!def) return;

        const x =
          typeof data.x === "number"
            ? data.x
            : parseFloat(String(data.x ?? ""));
        const z =
          typeof data.z === "number"
            ? data.z
            : parseFloat(String(data.z ?? ""));
        if (!Number.isFinite(x) || !Number.isFinite(z)) return;

        const clamped = this.clampXZ(x, z, def);
        const user = socketUserService.getConnectedUserById(userId);
        const thumb =
          typeof data.previewKey === "string" && data.previewKey.length > 0
            ? data.previewKey
            : user?.profileImage?.thumbnail ?? null;

        this.playerState.set(this.stateKey(userId, roomId), {
          x: clamped.x,
          z: clamped.z,
          previewKey: thumb,
        });
        this.schedulePersist(userId, roomId, clamped.x, clamped.z, thumb);
        this.broadcastRoom(roomId);
      },
    );

    socket.on("sandbox:request-state", () => {
      if (getSessionPage() !== TOOLBOX_PAGE.SANDBOX) return;
      const roomId = socket.data.sandboxRoomId as string | undefined;
      if (!roomId) {
        void (async () => {
          const resume = await getResumeSandboxRoomId(userId);
          await this.performJoinRoom(
            socket,
            userId,
            getSessionPage,
            resume,
          );
        })();
        return;
      }
      // Toujours renvoyer `sandbox:room-joined` : le premier émis au
      // `page-navigation` peut arriver avant que le client enregistre le listener.
      void this.performJoinRoom(socket, userId, getSessionPage, roomId);
    });
  }

  onBeforeSessionRemoved(ctx: UserSocketAttachContext): void {
    const { socket, getSessionPage } = ctx;
    if (getSessionPage() !== TOOLBOX_PAGE.SANDBOX) return;
    const roomId = socket.data.sandboxRoomId as string | undefined;
    if (roomId) this.leaveSandboxRoom(socket, roomId);
  }

  onAfterPageNavigation(ctx: UserSocketPageNavigationContext): void {
    const { socket, oldPage, newPage, getSessionPage } = ctx;
    if (oldPage === TOOLBOX_PAGE.SANDBOX && newPage !== TOOLBOX_PAGE.SANDBOX) {
      const roomId = socket.data.sandboxRoomId as string | undefined;
      if (roomId) this.leaveSandboxRoom(socket, roomId);
    }
    if (oldPage !== TOOLBOX_PAGE.SANDBOX && newPage === TOOLBOX_PAGE.SANDBOX) {
      void (async () => {
        const resume = await getResumeSandboxRoomId(ctx.userId);
        await this.performJoinRoom(
          socket,
          ctx.userId,
          getSessionPage,
          resume,
        );
      })();
    }
  }

  private pruneState(): void {
    const allowed = socketUserService.getUserIdsWithSessionOnPage(
      TOOLBOX_PAGE.SANDBOX,
    );
    for (const key of [...this.playerState.keys()]) {
      const userId = key.split("::")[0] ?? "";
      if (!allowed.has(userId)) this.playerState.delete(key);
    }
  }

  private buildPlayersPayload(
    roomId: string,
    io: SocketIOServer,
  ): {
    players: Array<{
      userId: string;
      email: string;
      x: number;
      z: number;
      previewKey: string | null;
    }>;
  } {
    this.pruneState();
    const room = io.sockets.adapter.rooms.get(this.channel(roomId));
    const userIds = new Set<string>();
    if (room) {
      for (const sid of room) {
        const sock = io.sockets.sockets.get(sid);
        if (!sock) continue;
        const uid = (sock as unknown as { userId?: string }).userId;
        if (!uid) continue;
        if (
          socketUserService.getSessionPage(uid, sid) !== TOOLBOX_PAGE.SANDBOX
        ) {
          continue;
        }
        userIds.add(uid);
      }
    }

    const players: Array<{
      userId: string;
      email: string;
      x: number;
      z: number;
      previewKey: string | null;
    }> = [];

    for (const uid of userIds) {
      const user = socketUserService.getConnectedUserById(uid);
      if (!user) continue;
      const thumb = user.profileImage?.thumbnail ?? null;
      const sk = this.stateKey(uid, roomId);
      let st = this.playerState.get(sk);
      if (!st) {
        st = { x: 0, z: 0, previewKey: thumb };
        this.playerState.set(sk, st);
      }
      players.push({
        userId: uid,
        email: user.userEmail,
        x: st.x,
        z: st.z,
        previewKey: st.previewKey ?? thumb,
      });
    }

    return { players };
  }

  private broadcastRoom(roomId: string): void {
    const io = socketUserService.getIO();
    if (!io) return;
    const { players } = this.buildPlayersPayload(roomId, io);
    io.to(this.channel(roomId)).emit("sandbox:players", {
      roomId,
      players,
    });
  }

  broadcastMapReload(changedSpawns: Record<string, { x: number; z: number }> = {}): void {
    const io = socketUserService.getIO();
    if (!io) return;
    for (const roomId of listSandboxRoomIds()) {
      const def = getSandboxRoom(roomId);
      const scene = getClientRoomScene(roomId);
      if (!def || !scene) continue;
      io.to(this.channel(roomId)).emit("sandbox:map-reload", {
        roomId,
        bounds: { halfW: def.halfW, halfD: def.halfD },
        scene,
      });

      // Teleport all players in this room to the new spawn if it changed.
      const newSpawn = changedSpawns[roomId];
      if (!newSpawn) continue;
      const room = io.sockets.adapter.rooms.get(this.channel(roomId));
      if (!room) continue;
      for (const sid of room) {
        const sock = io.sockets.sockets.get(sid);
        if (!sock) continue;
        const uid = (sock as unknown as { userId?: string }).userId;
        if (!uid) continue;
        const clamped = this.clampXZ(newSpawn.x, newSpawn.z, def);
        this.playerState.set(this.stateKey(uid, roomId), {
          ...this.playerState.get(this.stateKey(uid, roomId)) ?? { previewKey: null },
          x: clamped.x,
          z: clamped.z,
        });
        sock.emit("sandbox:teleport-to", { x: clamped.x, z: clamped.z });
      }
      this.broadcastRoom(roomId);
    }
  }

  private sendPlayersToSocket(socket: Socket, roomId: string): void {
    const io = socketUserService.getIO();
    if (!io) return;
    const { players } = this.buildPlayersPayload(roomId, io);
    socket.emit("sandbox:players", { roomId, players });
  }
}

export const sandboxService = new SandboxService();

export {
  DEFAULT_SANDBOX_ROOM_ID,
  getClientRoomScene,
  listSandboxRoomIds,
  SANDBOX_ROOMS,
  type SandboxDeskObject,
  type SandboxStairObject,
  type SandboxRoomRuntime,
} from "./rooms";
