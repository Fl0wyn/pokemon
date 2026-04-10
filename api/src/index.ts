import cors from "cors";
import express, { Express, Request, Response } from "express";
import { createServer } from "http";
import connectDB from "./utils/db";
import { debugApiEnabled, debugApiLog } from "./utils/debugApi";
import { ensureUploadsDir } from "./utils/uploadsDir";

require("dotenv").config();

import { pokemonService } from "./services/pokemonService";
import { initPokemonConfigFromDb } from "./services/pokemonService/rooms";
import { socketUserService } from "./services/socketUserService";

import { Router } from "./router";

export class Main {
  public app: Express;

  constructor() {
    console.log("acs2i-game-api is starting");

    // Database
    connectDB();
    ensureUploadsDir();

    // Server
    this.app = express();
    const port = Number(process.env.PORT as string);

    this.app.use(cors());
    this.app.use(express.json());

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

    socketUserService.initialize(httpServer);
    pokemonService.initialize();

    httpServer.listen(port, () => {
      console.log("Server is running on " + port);
      initPokemonConfigFromDb().catch((e) => console.error("[pokemon] init config error:", e));
      if (debugApiEnabled()) {
        debugApiLog("Mode debug API actif (HTTP). Désactiver: DEBUG_API=false.");
      }
    });

    httpServer.on("listening", () => {
      const addr = httpServer.address();
      if (addr && typeof addr === "object" && debugApiEnabled()) {
        debugApiLog(
          "Serveur HTTP à l'écoute",
          `port=${addr.port}`,
          `address=${addr.address}`,
        );
      }
    });
  }
}

new Main();
