import express, { Request, Response } from "express";
import passport from "passport";

import * as passportConfig from "./config/passport";

import { Main } from "./index";

import { login } from "./controllers/auth/login";
import { loginRequest } from "./controllers/auth/loginRequest";
import { microsoftAuthorize } from "./controllers/auth/microsoftAuthorize";
import { microsoftCallback } from "./controllers/auth/microsoftCallback";
import { microsoftStatus } from "./controllers/auth/microsoftStatus";

import { getImage } from "./controllers/data/getImage";

import { getPokemonConfig } from "./controllers/pokemon/getPokemonConfig";
import { putPokemonConfig } from "./controllers/pokemon/putPokemonConfig";

import { getUsersAll } from "./controllers/user/getUsersAll";
import { getUserById } from "./controllers/user/getUserById";
import { getUserMe } from "./controllers/user/getUserMe";
import { patchUserById } from "./controllers/user/patchUserById";
import { postUserCreate } from "./controllers/user/postUserCreate";
import { postUserProfileImage } from "./controllers/user/postUserProfileImage";

import multer from "multer";

export type router_cons_type = {
  main: Main;
};

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

function runMemoryFileUpload(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  memoryUpload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const msg =
        err instanceof Error ? err.message : "Envoi de fichier rejeté.";
      res.status(400).json({ error: msg });
      return;
    }
    next();
  });
}

export class Router {
  public requireAuth: any;
  public apiRoutes: express.Router;

  constructor({ main }: router_cons_type) {
    passportConfig.basic();

    const requireLogin = passport.authenticate("local", {
      session: false,
    });

    this.requireAuth = passport.authenticate("jwt", {
      session: false,
    });

    this.apiRoutes = express.Router();

    const authRoutes = express.Router();
    const dataRoutes = express.Router();

    // Auth Routes
    this.apiRoutes.use("/auth", authRoutes);
    authRoutes.post("/loginRequest", loginRequest);
    authRoutes.post("/login", login);
    authRoutes.get("/microsoft/status", microsoftStatus);
    authRoutes.get("/microsoft/authorize", microsoftAuthorize);
    authRoutes.post("/microsoft/callback", microsoftCallback);

    // Data Routes
    this.apiRoutes.use("/data", dataRoutes);
    dataRoutes.get("/image/:file", getImage);

    // Pokemon
    const pokemonRoutes = express.Router();
    this.apiRoutes.use("/pokemon", pokemonRoutes);
    pokemonRoutes.get("/config", this.requireAuth, getPokemonConfig);
    pokemonRoutes.put("/config", this.requireAuth, putPokemonConfig);

    // Users
    const userRoutes = express.Router();
    this.apiRoutes.use("/user", userRoutes);
    userRoutes.get("/all", this.requireAuth, getUsersAll);
    userRoutes.get("/me", this.requireAuth, getUserMe);
    userRoutes.post("/create", this.requireAuth, postUserCreate);
    userRoutes.post("/profile-image", this.requireAuth, runMemoryFileUpload, postUserProfileImage);
    userRoutes.patch("/:id", this.requireAuth, patchUserById);
    userRoutes.get("/:id", this.requireAuth, getUserById);

    main.app.use("/", this.apiRoutes);
  }
}
