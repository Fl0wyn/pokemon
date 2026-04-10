import cors from "cors";
import express, { Express, Request, Response } from "express";
import { createServer } from "http";
import connectDB from "./utils/db";
import { debugApiEnabled, debugApiLog } from "./utils/debugApi";
import { ensureUploadsDir } from "./utils/uploadsDir";

require("dotenv").config();

import { ServiceJira } from "./services/Jira/ServiceJira";
import { ServiceNotion } from "./services/Notion/ServiceNotion";
import { socketAgentService } from "./services/socketAgentService";
import { sandboxService } from "./services/sandboxService";
import { initSandboxConfigFromDb } from "./services/sandboxService/rooms";
import { socketUserService } from "./services/socketUserService";
import { botService } from "./services/botService";
import { getTeamsBotAdapter } from "./services/botService/teamsAdapter";
import { taskService } from "./services/taskService";

import { Router } from "./router";

export class Main {
  public app: Express;
  public serviceNotion: ServiceNotion;
  public serviceJira: ServiceJira;

  constructor() {
    console.log("acs2i-toolbox-api is starting");

    // Database
    connectDB();
    ensureUploadsDir();

    // Services
    this.serviceNotion = new ServiceNotion({ main: this });
    this.serviceJira = new ServiceJira({ main: this });

    // Server
    this.app = express();
    const port = Number(process.env.PORT as string);

    this.app.use(cors());
    this.app.use(
        express.json({
            verify: (req, _res, buf) => {
                (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
            },
        }),
    );

    if (debugApiEnabled()) {
      this.app.use((req, res, next) => {
        const start = Date.now();
        res.on("finish", () => {
          debugApiLog(
            req.method,
            req.originalUrl,
            res.statusCode,
            `${Date.now() - start}ms`,
            req.ip || req.socket.remoteAddress || "",
          );
        });
        next();
      });
    }

    this.app.get("/", (req: Request, res: Response) => {
      res.send("🏠");
    });

    new Router({ main: this });

    // HTTP server
    const httpServer = createServer(this.app);

    // Socket.IO: agent (no auth) + user (JWT auth)
    socketAgentService.setBroadcast((socketId, payload) => {
      socketUserService.broadcastPm2Status(socketId, payload);
    });

    socketAgentService.setLogLine((agentSocketId, processName, line) => {
      socketUserService.broadcastLogLine(agentSocketId, processName, line);
    });

    socketAgentService.initialize(httpServer);

    // Allow frontend to subscribe/unsubscribe logs on a specific agent
    socketUserService.onLogsSubscribe((agentSocketId, processName) => {
      socketAgentService.sendToAgent(agentSocketId, "pm2:logs:subscribe", { processName });
    });
    socketUserService.onLogsUnsubscribe((agentSocketId, processName) => {
      socketAgentService.sendToAgent(agentSocketId, "pm2:logs:unsubscribe", { processName });
    });
    socketUserService.onRestart((agentSocketId, processName) => {
      socketAgentService.sendToAgent(agentSocketId, "pm2:restart", { processName });
    });
    socketUserService.onUninstall((agentSocketId) => {
      socketAgentService.sendToAgent(agentSocketId, "agent:uninstall", {});
    });

    socketUserService.initialize(httpServer);
    sandboxService.initialize();

    // Initialise l’adapter Teams au démarrage (logs debugApi si activé)
    getTeamsBotAdapter();

    httpServer.listen(port, () => {
      console.log("Server is running on " + port);
      // Init task scheduler after DB is connected (connectDB is async but safe to call after listen)
      taskService.initialize().catch((e) => console.error("[taskService] init error:", e));
      initSandboxConfigFromDb().catch((e) => console.error("[sandbox] init config error:", e));
      if (debugApiEnabled()) {
        debugApiLog(
          "Mode debug API actif (HTTP). Désactiver: DEBUG_API=false. Teams:",
          "POST /teams/messages",
        );
      }
    });

    httpServer.on("listening", () => {
      const addr = httpServer.address();
      if (addr && typeof addr === "object" && debugApiEnabled()) {
        debugApiLog(
          "Serveur HTTP à l’écoute",
          `port=${addr.port}`,
          `address=${addr.address}`,
        );
      }
      void botService.notifyApiStarted(process.env.APP_ENV, port);
    });
  }
}

new Main();
