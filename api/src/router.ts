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
import { getPm2Agent, getPm2AgentDirect } from "./controllers/data/getPm2Agent";
import { generateAgentToken } from "./controllers/data/generateAgentToken";
import { getInstallScript } from "./controllers/data/getInstallScript";
import { getUninstallScript } from "./controllers/data/getUninstallScript";
import { getTaskAll } from "./controllers/task/getTaskAll";
import { getTaskById } from "./controllers/task/getTaskById";
import { postSignature } from "./controllers/task/postSignature";
import { updateNotionFromJira } from "./controllers/task/updateNotionFromJira";
import { getVacationAll } from "./controllers/vacation/getVacationAll";

import { getOrderAll } from "./controllers/order/getOrderAll";
import { orderToNotion } from "./controllers/order/orderToNotion";

import { getMonitoringServers } from "./controllers/monitoring/getMonitoringServers";
import { createMonitoringServer } from "./controllers/monitoring/createMonitoringServer";
import { updateMonitoringServer } from "./controllers/monitoring/updateMonitoringServer";
import { deleteMonitoringServer } from "./controllers/monitoring/deleteMonitoringServer";
import { getMonitoringClients } from "./controllers/monitoring/getMonitoringClients";
import { createMonitoringClient } from "./controllers/monitoring/createMonitoringClient";
import { updateMonitoringClient } from "./controllers/monitoring/updateMonitoringClient";
import { deleteMonitoringClient } from "./controllers/monitoring/deleteMonitoringClient";
import { generateServerInstallToken } from "./controllers/monitoring/generateServerInstallToken";
import { linkAgent } from "./controllers/monitoring/linkAgent";
import { getMonitoringAlerts } from "./controllers/monitoring/getMonitoringAlerts";
import { acknowledgeMonitoringAlert } from "./controllers/monitoring/acknowledgeMonitoringAlert";
import { deleteMonitoringAlert } from "./controllers/monitoring/deleteMonitoringAlert";
import { getMonitoringEvents } from "./controllers/monitoring/getMonitoringEvents";
import { getMonitoringPackages } from "./controllers/monitoring/getMonitoringPackages";
import { getCommitCheck } from "./controllers/monitoring/getCommitCheck";
import { getDeployments } from "./controllers/deployments/getDeployments";
import { postGithubWebhook } from "./controllers/deployments/postGithubWebhook";
import { syncDeployments } from "./controllers/deployments/syncDeployments";
import { getDeploymentDetail } from "./controllers/deployments/getDeploymentDetail";
import { refreshDeploymentDetail } from "./controllers/deployments/refreshDeploymentDetail";
import { getPackageVersions } from "./controllers/deployments/getPackageVersions";
import { postPackageAudit } from "./controllers/deployments/postPackageAudit";
import { getUsersAll } from "./controllers/user/getUsersAll";
import { getUserById } from "./controllers/user/getUserById";
import { getUserMe } from "./controllers/user/getUserMe";
import { patchUserById } from "./controllers/user/patchUserById";
import { postUserCreate } from "./controllers/user/postUserCreate";
import { getFilesList } from "./controllers/file/getFilesList";
import { postFileUpload } from "./controllers/file/postFileUpload";
import { postUserProfileImage } from "./controllers/user/postUserProfileImage";
import { postTeamsMessages } from "./controllers/bot/postTeamsMessages";
import { getEmails } from "./controllers/email/getEmails";
import { getTaskDefinitions } from "./controllers/tasks/getTaskDefinitions";
import { createTaskDefinition } from "./controllers/tasks/createTaskDefinition";
import { updateTaskDefinition } from "./controllers/tasks/updateTaskDefinition";
import { deleteTaskDefinition } from "./controllers/tasks/deleteTaskDefinition";
import { runTask } from "./controllers/tasks/runTask";
import { getTaskRuns } from "./controllers/tasks/getTaskRuns";
import { getTaskRunById } from "./controllers/tasks/getTaskRunById";
import { getSecurityResults } from "./controllers/security/getSecurityResults";
import { getSandboxConfig } from "./controllers/sandbox/getSandboxConfig";
import { putSandboxConfig } from "./controllers/sandbox/putSandboxConfig";
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

    //app.use(passport.initialize());
    //app.use(passport.session());

    const requireLogin = passport.authenticate("local", {
      session: false,
    });

    this.requireAuth = passport.authenticate("jwt", {
      session: false,
    });

    let getServices = (req: Request, res: Response, next: any) => {
      (req as any).services = {
        notion: main.serviceNotion,
        jira: main.serviceJira,
      };
      next();
    };

    this.apiRoutes = express.Router();

    const authRoutes = express.Router();
    const dataRoutes = express.Router();
    const taskRoutes = express.Router();
    const orderRoutes = express.Router();
    const vacationRoutes = express.Router();

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
    dataRoutes.get("/pm2-agent/generate", this.requireAuth, generateAgentToken);
    dataRoutes.get("/acs2i-agent-direct", getPm2AgentDirect);
    dataRoutes.get("/install-:token", getInstallScript);
    dataRoutes.get("/acs2i-agent-:token", getPm2Agent);
    dataRoutes.get("/uninstall", getUninstallScript);

    // Tasks Routes
    this.apiRoutes.use("/task", taskRoutes);
    taskRoutes.get("/all", this.requireAuth, getServices, getTaskAll);
    taskRoutes.get(
      "/updateFromJira",
      /*this.requireAuth, */ getServices,
      updateNotionFromJira,
    );
    taskRoutes.post("/sign/:id", this.requireAuth, getServices, postSignature);
    taskRoutes.get("/:id", this.requireAuth, getServices, getTaskById);

    // Orders Routes
    this.apiRoutes.use("/order", orderRoutes);
    orderRoutes.get("/all", this.requireAuth, getOrderAll);
    orderRoutes.post("/toNotion", this.requireAuth, getServices, orderToNotion);

    // Monitoring Server Routes
    const monitoringRoutes = express.Router();
    this.apiRoutes.use("/monitoring", monitoringRoutes);
    monitoringRoutes.get("/server", this.requireAuth, getMonitoringServers);
    monitoringRoutes.post("/server", this.requireAuth, createMonitoringServer);
    monitoringRoutes.put("/server/:id", this.requireAuth, updateMonitoringServer);
    monitoringRoutes.delete("/server/:id", this.requireAuth, deleteMonitoringServer);
    monitoringRoutes.post("/server/:id/install-token", this.requireAuth, generateServerInstallToken);
    monitoringRoutes.post("/agent/:socketId/link", this.requireAuth, linkAgent);
    monitoringRoutes.get("/client", this.requireAuth, getMonitoringClients);
    monitoringRoutes.post("/client", this.requireAuth, createMonitoringClient);
    monitoringRoutes.put("/client/:id", this.requireAuth, updateMonitoringClient);
    monitoringRoutes.delete("/client/:id", this.requireAuth, deleteMonitoringClient);
    monitoringRoutes.get("/alert", this.requireAuth, getMonitoringAlerts);
    monitoringRoutes.patch("/alert/:id/acknowledge", this.requireAuth, acknowledgeMonitoringAlert);
    monitoringRoutes.delete("/alert/:id", this.requireAuth, deleteMonitoringAlert);
    monitoringRoutes.get("/event", this.requireAuth, getMonitoringEvents);
    monitoringRoutes.get("/packages", this.requireAuth, getMonitoringPackages);
    monitoringRoutes.get("/commit-check", this.requireAuth, getCommitCheck);

    // Scheduled Tasks (admin)
    const scheduledTaskRoutes = express.Router();
    this.apiRoutes.use("/tasks", scheduledTaskRoutes);
    scheduledTaskRoutes.get("/", this.requireAuth, getTaskDefinitions);
    scheduledTaskRoutes.post("/", this.requireAuth, createTaskDefinition);
    scheduledTaskRoutes.put("/:id", this.requireAuth, updateTaskDefinition);
    scheduledTaskRoutes.delete("/:id", this.requireAuth, deleteTaskDefinition);
    scheduledTaskRoutes.post("/:id/run", this.requireAuth, runTask);
    scheduledTaskRoutes.get("/runs", this.requireAuth, getTaskRuns);
    scheduledTaskRoutes.get("/runs/:id", this.requireAuth, getTaskRunById);

    // Security
    const securityRoutes = express.Router();
    this.apiRoutes.use("/security", securityRoutes);
    securityRoutes.get("/results", this.requireAuth, getSecurityResults);

    // Sandbox
    const sandboxRoutes = express.Router();
    this.apiRoutes.use("/sandbox", sandboxRoutes);
    sandboxRoutes.get("/config", this.requireAuth, getSandboxConfig);
    sandboxRoutes.put("/config", this.requireAuth, putSandboxConfig);

    // Vacations Routes
    this.apiRoutes.use("/vacation", vacationRoutes);
    vacationRoutes.get("/all", this.requireAuth, getServices, getVacationAll);

    // Users
    const userRoutes = express.Router();
    this.apiRoutes.use("/user", userRoutes);
    userRoutes.get("/all", this.requireAuth, getUsersAll);
    userRoutes.get("/me", this.requireAuth, getUserMe);
    userRoutes.post("/create", this.requireAuth, postUserCreate);
    userRoutes.post("/profile-image", this.requireAuth, postUserProfileImage);
    userRoutes.patch("/:id", this.requireAuth, patchUserById);
    userRoutes.get("/:id", this.requireAuth, getUserById);

    const fileRoutes = express.Router();
    this.apiRoutes.use("/file", fileRoutes);
    fileRoutes.get("/list", this.requireAuth, getFilesList);
    fileRoutes.post("/upload", this.requireAuth, runMemoryFileUpload, postFileUpload);

    // Deployments (GitHub)
    const deploymentRoutes = express.Router();
    this.apiRoutes.use("/deployment", deploymentRoutes);
    deploymentRoutes.get("/all", this.requireAuth, getDeployments);
    deploymentRoutes.get("/packages", this.requireAuth, getPackageVersions);
    deploymentRoutes.post("/packages/audit", this.requireAuth, postPackageAudit);
    deploymentRoutes.get("/detail", this.requireAuth, getDeploymentDetail);
    deploymentRoutes.post("/detail/refresh", this.requireAuth, refreshDeploymentDetail);
    deploymentRoutes.post("/sync", this.requireAuth, syncDeployments);
    deploymentRoutes.post("/github-webhook", postGithubWebhook);

    // Email
    const emailRoutes = express.Router();
    this.apiRoutes.use("/email", emailRoutes);
    emailRoutes.get("/list", this.requireAuth, getEmails);

    // Tests
    main.app.get("/email", async (req: Request, res: Response) => {
      //sendMail("email@acs2i.fr", "Hello", "Oui");
      res.send("email sent");
    });

    /** Microsoft Teams / Azure Bot — pas d’auth JWT (validation Bot Framework sur la requête). */
    const teamsRoutes = express.Router();
    teamsRoutes.post("/messages", postTeamsMessages);
    main.app.use("/teams", teamsRoutes);

    main.app.use("/", this.apiRoutes);
  }
}
