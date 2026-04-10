import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { Socket, Server as SocketIOServer } from "socket.io";
import { User } from "../../models/User";
import type { UserSocketExtension } from "./userSocketExtensions";

export type { UserSocketExtension, UserSocketAttachContext, UserSocketPageNavigationContext } from "./userSocketExtensions";

interface UserSession {
  userId: string;
  userEmail: string;
  socketId: string;
  currentPage: string;
  connectedAt: Date;
  deviceType?: "mobile" | "web";
}

interface UserProfileInfo {
  userId: string;
  userEmail: string;
  profileImage?: { _id: string; thumbnail?: string };
  short?: string;
}

export interface ConnectedUser {
  userId: string;
  userEmail: string;
  profileImage?: { _id: string; thumbnail?: string };
  short?: string;
  sessions: UserSession[];
}

type LogsSubscribeFn = (agentSocketId: string, processName: string) => void;
type RestartFn = (agentSocketId: string, processName: string) => void;

/** Must match Next.js `usePathname()` values for page-scoped emits. */
export const TOOLBOX_PAGE = {
  USERS: "/users",
  DEPLOYMENTS: "/deployments",
  MONITORING: "/monitoring",
  SANDBOX: "/sandbox",
} as const;

class SocketUserService {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, ConnectedUser> = new Map();
  private socketToUser: Map<string, string> = new Map();
  private logsSubscribeFn: LogsSubscribeFn | null = null;
  private logsUnsubscribeFn: LogsSubscribeFn | null = null;
  private restartFn: RestartFn | null = null;
  private uninstallFn: ((agentSocketId: string) => void) | null = null;
  private extensions: UserSocketExtension[] = [];

  public onLogsSubscribe(fn: LogsSubscribeFn) {
    this.logsSubscribeFn = fn;
  }
  public onLogsUnsubscribe(fn: LogsSubscribeFn) {
    this.logsUnsubscribeFn = fn;
  }
  public onRestart(fn: RestartFn) {
    this.restartFn = fn;
  }
  public onUninstall(fn: (agentSocketId: string) => void) {
    this.uninstallFn = fn;
  }

  /**
   * Register feature-specific `socket.on` handlers for every authenticated user connection.
   * Returns an unregister function (e.g. for tests).
   */
  public registerUserSocketExtension(ext: UserSocketExtension): () => void {
    this.extensions.push(ext);
    return () => {
      const i = this.extensions.indexOf(ext);
      if (i >= 0) this.extensions.splice(i, 1);
    };
  }

  public initialize(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["polling", "websocket"],
      allowEIO3: true,
      path: "/socket.io",
    });

    this.io.use(async (socket: Socket, next) => {
      try {
        const token =
          socket.handshake.auth.token || socket.handshake.headers.authorization;

        if (!token) {
          return next(new Error("Authentication error: No token provided"));
        }

        const cleanToken = (token as string).replace("JWT ", "").trim();
        const jwtSecret = process.env.JWT_SECRET || process.env.JWTSECRET;
        console.log(
          "[socketUser] token prefix:",
          (token as string).slice(0, 20),
          "| secret defined:",
          !!jwtSecret,
        );
        if (!jwtSecret) throw new Error("JWT secret not configured");
        const decoded = jwt.verify(cleanToken, jwtSecret) as { userEmail: string };

        const user = await User.findOne({ email: decoded.userEmail })
          .populate("profileImageFile", "previewStorageKey")
          .exec();
        if (!user) {
          return next(new Error("Authentication error: User not found"));
        }

        const u = user as any;
        const imgFile = u.profileImageFile as
          | { _id: { toString: () => string }; previewStorageKey?: string }
          | null
          | undefined;

        (socket as any).userEmail = decoded.userEmail;
        (socket as any).userId = u._id.toString();
        (socket as any).userProfile = {
          userId: u._id.toString(),
          userEmail: u.email,
          profileImage:
            imgFile?.previewStorageKey != null
              ? {
                  _id: imgFile._id.toString(),
                  thumbnail: imgFile.previewStorageKey,
                }
              : undefined,
          short: u.short,
        };

        next();
      } catch (err) {
        console.error(
          "[socketUser] verify failed:",
          err instanceof Error ? err.message : err,
        );
        next(new Error("Authentication error: Invalid token"));
      }
    });

    this.io.on("connection", (socket: Socket) => {
      const userEmail = (socket as any).userEmail;
      const userId = (socket as any).userId;
      const userProfile = (socket as any).userProfile;

      console.log(
        `[user] Connecté : ${userEmail} (${userId}) - Socket: ${socket.id}`,
      );

      const userAgent = socket.handshake.headers["user-agent"] || "";
      const isMobile =
        /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          userAgent,
        );
      const deviceType: "mobile" | "web" = isMobile ? "mobile" : "web";

      this.addUserSession(
        userId,
        userEmail,
        socket.id,
        userProfile,
        deviceType,
      );

      const attachCtx = {
        userId,
        userEmail,
        socket,
        getSessionPage: () => this.getUserPage(userId, socket.id),
      };

      for (const ext of this.extensions) {
        ext.onAttach(attachCtx);
      }

      socket.on(
        "page-navigation",
        (data: { page: string; deviceType?: "mobile" | "web" }) => {
          const oldPage = this.getUserPage(userId, socket.id);
          this.updateUserPage(userId, socket.id, data.page, data.deviceType);
          if (oldPage && oldPage !== data.page) this.notifyPageUsers(oldPage);
          this.notifyPageUsers(data.page);

          const navCtx = {
            ...attachCtx,
            oldPage,
            newPage: data.page,
          };
          for (const ext of this.extensions) {
            ext.onAfterPageNavigation?.(navCtx);
          }
        },
      );

      socket.on(
        "pm2:logs:subscribe",
        ({
          agentSocketId,
          processName,
        }: {
          agentSocketId: string;
          processName: string;
        }) => {
          this.logsSubscribeFn?.(agentSocketId, processName);
        },
      );

      socket.on(
        "pm2:logs:unsubscribe",
        ({
          agentSocketId,
          processName,
        }: {
          agentSocketId: string;
          processName: string;
        }) => {
          this.logsUnsubscribeFn?.(agentSocketId, processName);
        },
      );

      socket.on(
        "pm2:restart",
        ({
          agentSocketId,
          processName,
        }: {
          agentSocketId: string;
          processName: string;
        }) => {
          this.restartFn?.(agentSocketId, processName);
        },
      );

      socket.on(
        "agent:uninstall",
        ({ agentSocketId }: { agentSocketId: string }) => {
          this.uninstallFn?.(agentSocketId);
        },
      );

      socket.on("toolbox:presence:request", () => {
        socket.emit("toolbox:presence", {
          onlineUserIds: this.getOnlineUserIds(),
        });
      });

      socket.on("disconnect", () => {
        console.log(`[user] Déconnecté : ${userEmail} - Socket: ${socket.id}`);
        for (const ext of this.extensions) {
          ext.onBeforeSessionRemoved?.(attachCtx);
        }
        const page = this.getUserPage(userId, socket.id);
        this.removeUserSession(userId, socket.id);
        if (page) this.notifyPageUsers(page);
      });
    });

    console.log("[user] Socket.IO user service initialized on /socket.io");
  }

  /** Called by socketAgentService when a pm2:status is received */
  public broadcastPm2Status(agentSocketId: string, payload: unknown) {
    if (payload === null) {
      this.emitToPage(TOOLBOX_PAGE.MONITORING, "pm2:agent-disconnected", {
        socketId: agentSocketId,
      });
    } else {
      this.emitToPage(TOOLBOX_PAGE.MONITORING, "pm2:status", {
        socketId: agentSocketId,
        payload,
      });
    }
  }

  /** Called by socketAgentService when a log line arrives from an agent */
  public broadcastLogLine(
    agentSocketId: string,
    processName: string,
    line: string,
  ) {
    this.emitToPage(TOOLBOX_PAGE.MONITORING, "pm2:log:line", {
      agentSocketId,
      processName,
      line,
    });
  }

  /** After GitHub webhook updates deployments collection — clients on Déploiements only. */
  public broadcastDeploymentsUpdated(payload: {
    repository: string;
    githubDeploymentId: number;
    headSha?: string | null;
  }) {
    this.emitToPage(TOOLBOX_PAGE.DEPLOYMENTS, "deployments:updated", payload);
  }

  public getSessionPage(userId: string, socketId: string): string | null {
    return this.getUserPage(userId, socketId);
  }

  public getUserIdsWithSessionOnPage(page: string): Set<string> {
    const set = new Set<string>();
    this.connectedUsers.forEach((u) => {
      u.sessions.forEach((s) => {
        if (s.currentPage === page) set.add(u.userId);
      });
    });
    return set;
  }

  public getConnectedUserById(userId: string): ConnectedUser | undefined {
    return this.connectedUsers.get(userId);
  }

  private addUserSession(
    userId: string,
    userEmail: string,
    socketId: string,
    userProfile?: UserProfileInfo,
    deviceType?: "mobile" | "web",
  ) {
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, {
        userId,
        userEmail,
        profileImage: userProfile?.profileImage,
        short: userProfile?.short,
        sessions: [],
      });
    } else {
      const user = this.connectedUsers.get(userId)!;
      if (userProfile) {
        user.profileImage = userProfile.profileImage;
        user.short = userProfile.short;
      }
    }

    const user = this.connectedUsers.get(userId)!;
    user.sessions.push({
      userId,
      userEmail,
      socketId,
      currentPage: "/",
      connectedAt: new Date(),
      deviceType,
    });
    this.socketToUser.set(socketId, userId);
    this.broadcastToolboxPresence();
  }

  private getOnlineUserIds(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  /** Presence updates — clients on Utilisateurs only (others use `toolbox:presence:request` when entering). */
  private broadcastToolboxPresence() {
    this.emitToPage(TOOLBOX_PAGE.USERS, "toolbox:presence", {
      onlineUserIds: this.getOnlineUserIds(),
    });
  }

  private updateUserPage(
    userId: string,
    socketId: string,
    page: string,
    deviceType?: "mobile" | "web",
  ) {
    const user = this.connectedUsers.get(userId);
    if (user) {
      const session = user.sessions.find((s) => s.socketId === socketId);
      if (session) {
        session.currentPage = page;
        if (deviceType) session.deviceType = deviceType;
      }
    }
  }

  private removeUserSession(userId: string, socketId: string) {
    const user = this.connectedUsers.get(userId);
    if (user) {
      user.sessions = user.sessions.filter((s) => s.socketId !== socketId);
      if (user.sessions.length === 0) this.connectedUsers.delete(userId);
    }
    this.socketToUser.delete(socketId);
    this.broadcastToolboxPresence();
  }

  private getUserPage(userId: string, socketId: string): string | null {
    const user = this.connectedUsers.get(userId);
    return (
      user?.sessions.find((s) => s.socketId === socketId)?.currentPage ?? null
    );
  }

  private notifyPageUsers(page: string) {
    if (!this.io) return;
    const usersOnPage = this.getUsersOnPage(page);
    this.connectedUsers.forEach((user) => {
      user.sessions.forEach((session) => {
        if (session.currentPage === page) {
          this.io!.to(session.socketId).emit("page-users-updated", {
            page,
            users: usersOnPage,
          });
        }
      });
    });
  }

  public getUsersOnPage(
    page: string,
  ): Array<
    UserProfileInfo & {
      sessions: Array<{ socketId: string; deviceType?: "mobile" | "web" }>;
    }
  > {
    const result: Map<
      string,
      UserProfileInfo & {
        sessions: Array<{ socketId: string; deviceType?: "mobile" | "web" }>;
      }
    > = new Map();
    this.connectedUsers.forEach((user) => {
      const sessionsOnPage = user.sessions.filter(
        (s) => s.currentPage === page,
      );
      if (sessionsOnPage.length > 0) {
        result.set(user.userId, {
          userId: user.userId,
          userEmail: user.userEmail,
          profileImage: user.profileImage,
          short: user.short,
          sessions: sessionsOnPage.map((s) => ({
            socketId: s.socketId,
            deviceType: s.deviceType,
          })),
        });
      }
    });
    return Array.from(result.values());
  }

  public emitToPage(page: string, event: string, data: unknown) {
    if (!this.io) return;
    this.connectedUsers.forEach((user) => {
      user.sessions.forEach((session) => {
        if (session.currentPage === page) {
          this.io!.to(session.socketId).emit(event, data);
        }
      });
    });
  }

  public getConnectedUsers(): ConnectedUser[] {
    return Array.from(this.connectedUsers.values());
  }

  public getIO(): SocketIOServer | null {
    return this.io;
  }
}

export const socketUserService = new SocketUserService();
