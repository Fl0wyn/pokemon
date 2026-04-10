# acs2i-test-agent

Node.js TypeScript agent that connects to the watcher Socket.IO server (localhost:3000), collects the PM2 process list, and sends updates so the watcher can keep a shared view of running processes.

## Setup

```bash
npm install
```

## Build

**Single JS file (bundled with esbuild):**

```bash
npm run build
```

Produces `dist/agent.cjs` — one file including the Socket.IO client and your code (no runtime `node_modules` needed for those).

**Single executable (Node.js SEA):**

Requires **Node.js >= 25.5.0** for the built-in `--build-sea` flow. On older Node versions, `npm run build:sea` will fail; use the single-file bundle (`dist/agent.cjs`) instead.

```bash
npm run build:sea
```

Produces `dist/agent` (or `dist/agent.exe` on Windows). Run it with:

```bash
./dist/agent
```

## Run (without SEA)

```bash
npm start
```

Or after a normal build:

```bash
node dist/agent.cjs
```

## Configuration

| Env var            | Default                 | Description                            |
| ------------------ | ----------------------- | -------------------------------------- |
| `WATCHER_URL`      | `http://localhost:3000` | Socket.IO watcher server URL           |
| `POLL_INTERVAL_MS` | `5000`                  | Interval (ms) between PM2 list updates |

## Behavior

- Connects to the watcher at `WATCHER_URL` (default localhost:3000).
- On connect and every `POLL_INTERVAL_MS`, runs `pm2 jlist` and emits `pm2:status` with a normalized process list (name, pm_id, pid, status, memory, cpu, restart_time, unstable_restarts).
- Reconnects automatically if the connection drops.

Ensure the [acs2i-test-watcher](https://github.com/...) server is running on port 3000 (or the URL you set) so the agent can connect.
