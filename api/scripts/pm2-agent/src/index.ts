import { execSync, spawn, ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import { io } from "socket.io-client";

const WATCHER_URL = process.env.WATCHER_URL ?? "https://toolbox.acs2i.fr";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 5000;
let SERVER_ID: string | null = process.env.SERVER_ID ?? null;
const AGENT_VERSION = "1.3.0";

interface Pm2ProcessDescription {
  name?: string;
  pm_id?: number;
  pid?: number;
  monit?: { memory: number; cpu: number };
  pm2_env?: {
    status?: string;
    restart_time?: number;
    unstable_restarts?: number;
    pm_uptime?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface DiskInfo {
  path: string;
  total: number;
  used: number;
  free: number;
}

function getDiskInfo(): DiskInfo[] {
  try {
    const isWindows = os.platform() === "win32";
    if (isWindows) {
      const out = execSync("wmic logicaldisk get DeviceID,Size,FreeSpace /format:csv", {
        encoding: "utf-8",
      });
      return out
        .trim()
        .split("\n")
        .slice(2)
        .map((line) => line.trim().split(","))
        .filter((parts) => parts.length >= 4 && parts[2] && parts[3])
        .map((parts) => {
          const free = Number(parts[2]);
          const total = Number(parts[3]);
          return { path: parts[1], total, used: total - free, free };
        });
    } else {
      const out = execSync("df -Pk / 2>/dev/null || df -Pk", { encoding: "utf-8" });
      return out
        .trim()
        .split("\n")
        .slice(1)
        .map((line) => line.split(/\s+/))
        .filter((p) => p.length >= 6)
        .map((p) => ({
          path: p[5],
          total: Number(p[1]) * 1024,
          used: Number(p[2]) * 1024,
          free: Number(p[3]) * 1024,
        }));
    }
  } catch {
    return [];
  }
}

function getOsName(): string {
  try {
    const platform = os.platform();
    if (platform === "win32") {
      const out = execSync("wmic os get Caption /value", { encoding: "utf-8" });
      const match = out.match(/Caption=(.+)/);
      return match ? match[1].trim() : "Windows";
    }
    // Linux: parse /etc/os-release
    const raw = require("fs").readFileSync("/etc/os-release", "utf-8") as string;
    const name = raw.match(/^PRETTY_NAME="?([^"\n]+)"?/m)?.[1];
    if (name) {
      // Shorten: "Ubuntu 24.04.1 LTS" -> "Ubuntu 24.04", "Debian GNU/Linux 12 (bookworm)" -> "Debian 12"
      const ubuntu = name.match(/Ubuntu (\d+\.\d+)/);
      if (ubuntu) return `Ubuntu ${ubuntu[1]}`;
      const debian = name.match(/Debian[^\d]*(\d+)/);
      if (debian) return `Debian ${debian[1]}`;
      // Generic: first two words
      return name.split(" ").slice(0, 2).join(" ");
    }
  } catch { /* fallback */ }
  return `${os.platform()} ${os.release()}`;
}

function getServerInfo() {
  const ifaces = os.networkInterfaces();
  const ips = Object.values(ifaces)
    .flat()
    .filter((i) => i && !i.internal && i.family === "IPv4")
    .map((i) => i!.address);

  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  let nodeVersion: string | null = null;
  try {
    nodeVersion = execSync("node --version", { encoding: "utf-8" }).trim();
  } catch { /* not available */ }

  return {
    hostname: os.hostname(),
    ips,
    os: getOsName(),
    nodeVersion,
    memory: { total: totalMem, used: totalMem - freeMem, free: freeMem },
    disks: getDiskInfo(),
    bootTime: new Date(Date.now() - os.uptime() * 1000).toISOString(),
  };
}

const PM2_BIN = process.env.PM2_BIN ?? "pm2";
const PM2_USER = process.env.PM2_USER ?? "";

function getPm2List(): Pm2ProcessDescription[] {
  try {
    // Si l'agent tourne en root mais que PM2 appartient à un autre user, utiliser su
    const isRoot = process.getuid?.() === 0;
    const cmd = isRoot && PM2_USER && PM2_USER !== "root"
      ? `su - "${PM2_USER}" -c '"${PM2_BIN}" jlist'`
      : `"${PM2_BIN}" jlist`;
    const out = execSync(cmd, {
      encoding: "utf-8",
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env },
    });
    // pm2 may print startup messages before the JSON — extract the JSON array
    const jsonStart = out.indexOf("[");
    const jsonEnd = out.lastIndexOf("]");
    if (jsonStart === -1 || jsonEnd === -1) {
      console.error("[agent] pm2 jlist: no JSON found in output:", out.slice(0, 200));
      return [];
    }
    const list = JSON.parse(out.slice(jsonStart, jsonEnd + 1)) as Pm2ProcessDescription[];
    return Array.isArray(list) ? list : [];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stderr = (err as any).stderr?.toString?.() ?? "";
    console.error("[agent] pm2 jlist failed:", message, stderr ? `| stderr: ${stderr}` : "");
    console.error("[agent] PM2_HOME env:", process.env.PM2_HOME ?? "(not set)");
    console.error("[agent] HOME env:", process.env.HOME ?? "(not set)");
    return [];
  }
}

function readPackageJson(cwd: string | undefined): Record<string, unknown> | null {
  if (!cwd) return null;
  try {
    const pkgPath = path.join(cwd, "package.json");
    if (!fs.existsSync(pkgPath)) return null;
    const raw = fs.readFileSync(pkgPath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readGitCommit(cwd: string | undefined): string | null {
  if (!cwd) return null;
  try {
    return execSync("git rev-parse HEAD", {
      cwd,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function readGitRemote(cwd: string | undefined): string | null {
  if (!cwd) return null;
  try {
    const remote = execSync("git remote get-url origin", {
      cwd,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    // Normalize SSH and HTTPS GitHub URLs to "owner/repo"
    // e.g. git@github.com:acs2i/my-repo.git -> acs2i/my-repo
    //      https://github.com/acs2i/my-repo.git -> acs2i/my-repo
    const sshMatch = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (sshMatch) return sshMatch[1];
    return null;
  } catch {
    return null;
  }
}

function sendPm2Status(socket: ReturnType<typeof io>): void {
  const list = getPm2List();
  const payload = {
    at: new Date().toISOString(),
    agentVersion: AGENT_VERSION,
    serverId: SERVER_ID,
    server: getServerInfo(),
    processes: list.map((p) => {
      const cwd = p.pm2_env?.pm_cwd as string | undefined;
      const pkg = readPackageJson(cwd);
      const gitCommit = readGitCommit(cwd);
      const gitRemote = readGitRemote(cwd);
      return {
        name: p.name ?? p.pm2_env?.name,
        pm_id: p.pm_id,
        pid: p.pid,
        status: p.pm2_env?.status,
        memory: p.monit?.memory,
        cpu: p.monit?.cpu,
        restart_time: p.pm2_env?.restart_time,
        unstable_restarts: p.pm2_env?.unstable_restarts,
        uptime: p.pm2_env?.pm_uptime ?? null,
        cwd: cwd ?? null,
        gitCommit,
        gitRemote,
        packageJson: pkg ? {
          name: pkg.name ?? null,
          version: pkg.version ?? null,
          dependencies: pkg.dependencies ?? {},
          devDependencies: pkg.devDependencies ?? {},
        } : null,
      };
    }),
  };
  socket.emit("pm2:status", payload);
}

// Active log streams: key = processName, value = spawned pm2 logs process
const logStreams: Map<string, ChildProcess> = new Map();

function startLogStream(socket: ReturnType<typeof io>, processName: string): void {
  if (logStreams.has(processName)) return;

  const isRoot = process.getuid?.() === 0;
  const spawnArgs = isRoot && PM2_USER && PM2_USER !== "root"
    ? { cmd: "su", args: ["-", PM2_USER, "-c", `"${PM2_BIN}" logs "${processName}" --raw --lines 50`] }
    : { cmd: PM2_BIN, args: ["logs", processName, "--raw", "--lines", "50"] };

  const child = spawn(spawnArgs.cmd, spawnArgs.args, {
    env: { ...process.env },
  });

  logStreams.set(processName, child);

  const emitLine = (line: string) => {
    socket.emit("pm2:log:line", { processName, line: line.trimEnd() });
  };

  let stdoutBuf = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    stdoutBuf += chunk.toString();
    const lines = stdoutBuf.split("\n");
    stdoutBuf = lines.pop() ?? "";
    lines.forEach(emitLine);
  });

  let stderrBuf = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderrBuf += chunk.toString();
    const lines = stderrBuf.split("\n");
    stderrBuf = lines.pop() ?? "";
    lines.forEach(emitLine);
  });

  child.on("close", () => {
    logStreams.delete(processName);
  });
}

function stopLogStream(processName: string): void {
  const child = logStreams.get(processName);
  if (child) {
    child.kill();
    logStreams.delete(processName);
  }
}

function main(): void {
  let intervalRef: ReturnType<typeof setInterval> | null = null;

  const isLocal = WATCHER_URL.includes("localhost");
  const socket = io(WATCHER_URL, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    path: isLocal ? "/agent/socket.io" : "/api/agent/socket.io",
    forceNew: true,
  });

  socket.on("connect", () => {
    console.log("[agent] Connected to watcher at", WATCHER_URL);
    sendPm2Status(socket);
  });

  socket.on("disconnect", (reason) => {
    console.log("[agent] Disconnected:", reason);
    // Stop all active log streams on disconnect
    logStreams.forEach((_, name) => stopLogStream(name));
  });

  socket.on("connect_error", (err) => {
    console.error("[agent] Connection error:", err.message);
  });

  socket.on("pm2:logs:subscribe", ({ processName }: { processName: string }) => {
    console.log("[agent] Log subscribe:", processName);
    startLogStream(socket, processName);
  });

  socket.on("pm2:logs:unsubscribe", ({ processName }: { processName: string }) => {
    console.log("[agent] Log unsubscribe:", processName);
    stopLogStream(processName);
  });

  socket.on("agent:uninstall", () => {
    console.log("[agent] Uninstall requested — scheduling uninstall and exiting");
    logStreams.forEach((_, name) => stopLogStream(name));
    if (intervalRef) clearInterval(intervalRef);
    socket.close();
    // Lancer la désinstallation en arrière-plan après un délai pour que le process ait le temps de se terminer
    spawn("bash", ["-c", "sleep 2 && systemctl disable acs2i-agent && rm -f /etc/systemd/system/acs2i-agent.service && systemctl daemon-reload && rm -f /usr/local/bin/acs2i-agent"], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    }).unref();
    process.exit(0);
  });

  socket.on("task:run", ({ taskRunId, script }: { taskRunId: string; script: string }) => {
    console.log("[agent] Exécution de tâche:", taskRunId);
    const child = require("child_process").spawn("bash", ["-c", script], {
      env: { ...process.env },
      shell: false,
    });

    const emitLine = (line: string) => {
      socket.emit("task:log:line", { taskRunId, line: line.trimEnd() });
    };

    let stdoutBuf = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() ?? "";
      lines.forEach(emitLine);
    });

    let stderrBuf = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      const lines = stderrBuf.split("\n");
      stderrBuf = lines.pop() ?? "";
      lines.forEach((l) => emitLine(`[stderr] ${l}`));
    });

    child.on("close", (exitCode: number) => {
      if (stdoutBuf) emitLine(stdoutBuf);
      if (stderrBuf) emitLine(`[stderr] ${stderrBuf}`);
      socket.emit("task:done", { taskRunId, exitCode: exitCode ?? 1 });
      console.log("[agent] Tâche terminée:", taskRunId, "code:", exitCode);
    });

    child.on("error", (err: Error) => {
      socket.emit("task:error", { taskRunId, message: err.message });
    });
  });

  socket.on("pm2:restart", ({ processName }: { processName: string }) => {
    console.log("[agent] Restart:", processName);
    try {
      const isRoot = process.getuid?.() === 0;
      const cmd = isRoot && PM2_USER && PM2_USER !== "root"
        ? `su - "${PM2_USER}" -c '"${PM2_BIN}" restart "${processName}"'`
        : `"${PM2_BIN}" restart "${processName}"`;
      execSync(cmd, {
        env: { ...process.env },
        stdio: "ignore",
      });
      console.log("[agent] Restarted:", processName);
    } catch (err) {
      console.error("[agent] Restart failed:", processName, err instanceof Error ? err.message : err);
    }
  });

  socket.on("agent:set-server-id", ({ serverId }: { serverId: string }) => {
    console.log("[agent] Linking to server:", serverId);
    SERVER_ID = serverId;
    // Persist in systemd service file
    const SERVICE_FILE = "/etc/systemd/system/acs2i-agent.service";
    try {
      if (fs.existsSync(SERVICE_FILE)) {
        let content = fs.readFileSync(SERVICE_FILE, "utf-8");
        if (/^Environment=SERVER_ID=/m.test(content)) {
          content = content.replace(/^Environment=SERVER_ID=.*$/m, `Environment=SERVER_ID=${serverId}`);
        } else {
          // Insert after [Service] section
          content = content.replace(/(\[Service\])/m, `$1\nEnvironment=SERVER_ID=${serverId}`);
        }
        fs.writeFileSync(SERVICE_FILE, content, "utf-8");
        execSync("systemctl daemon-reload", { stdio: "ignore" });
        console.log("[agent] SERVER_ID persisted in systemd and daemon reloaded");
      }
    } catch (err) {
      console.error("[agent] Failed to persist SERVER_ID:", err);
    }
    // Send updated status immediately
    sendPm2Status(socket);
  });

  // Periodic update of PM2 list
  intervalRef = setInterval(() => {
    if (socket.connected) {
      sendPm2Status(socket);
    }
  }, POLL_INTERVAL_MS);

  process.on("SIGINT", () => {
    logStreams.forEach((_, name) => stopLogStream(name));
    if (intervalRef) clearInterval(intervalRef);
    socket.close();
    process.exit(0);
  });
}

main();
