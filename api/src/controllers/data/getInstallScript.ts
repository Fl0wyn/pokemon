import { Request, Response } from "express";
import { AgentToken } from "../../models/AgentToken";

export async function getInstallScript(req: Request, res: Response) {
  const { token } = req.params;

  const record = await AgentToken.findOne({ token });
  if (!record) {
    res.status(401).send("echo 'Erreur : token invalide'");
    return;
  }
  if (record.usedAt) {
    res.status(410).send("echo 'Erreur : token déjà utilisé'");
    return;
  }

  const serverId = record.serverId ?? "";

  record.usedAt = new Date();
  await record.save();

  const agentUrl = `${process.env.API_PUBLIC_URL || "https://toolbox.acs2i.fr/api"}/data/acs2i-agent-direct`;

  const script = `#!/bin/bash

# Vérification root
if [ "$EUID" -ne 0 ]; then
  echo "Erreur : ce script doit être exécuté en root (sudo bash)"
  exit 1
fi

# Arrêt si déjà installé
if systemctl is-active --quiet acs2i-agent 2>/dev/null; then
  echo "[0/4] Service existant détecté, arrêt en cours..."
  systemctl stop acs2i-agent
fi

echo "[1/4] Téléchargement de l'agent..."
curl -fsSL "${agentUrl}" -o /usr/local/bin/acs2i-agent || { echo "Erreur : téléchargement échoué"; exit 1; }
chmod +x /usr/local/bin/acs2i-agent

# Recherche node et pm2 : PATH courant, emplacements standards, nvm/fnm/n dans tous les homes
find_bin() {
  local name="$1"

  # 1. PATH courant
  if command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
    return 0
  fi

  # 2. Emplacements standards
  for candidate in /usr/bin/"$name" /usr/local/bin/"$name" /opt/bin/"$name"; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done

  # 3. Recherche dans les homes — priorité aux chemins nvm/fnm/bin, exclusion des sous-modules pm2
  local result
  result=$(find /root /home -maxdepth 8 -name "$name" 2>/dev/null \
    | grep -v '/.pm2/modules/' \
    | grep -v '/node_modules/' \
    | grep -v '_alpine/' \
    | grep -v '_musl/' \
    | sort -r)
  for candidate in $result; do
    if [ -f "$candidate" ] && [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

NODE_BIN=$(find_bin node)
if [ -z "$NODE_BIN" ]; then
  echo "Erreur : node introuvable dans le PATH, /usr/local/bin, ni dans les homes (/root, /home/*)"
  echo "Installez node puis relancez ce script."
  exit 1
fi
echo "Node détecté : $NODE_BIN"

PM2_BIN=$(find_bin pm2)
if [ -z "$PM2_BIN" ]; then
  echo "Erreur : pm2 introuvable dans le PATH, /usr/local/bin, ni dans les homes (/root, /home/*)"
  echo "Installez pm2 (npm install -g pm2) puis relancez ce script."
  exit 1
fi
echo "PM2 détecté : $PM2_BIN"

# Conserver le PATH courant + répertoire de pm2 dans le service
PM2_DIR=$(dirname "$PM2_BIN")
CURRENT_PATH="$PM2_DIR:$PATH"

# Détecter le daemon PM2 actif et son répertoire .pm2
# Priorité : daemon d'un utilisateur non-root (les process applicatifs y sont en général)
PM2_HOME=""
PM2_DAEMON_USER=$(ps aux 2>/dev/null | grep 'PM2.*God Daemon' | grep -v grep | grep -v '^root' | awk '{print $1}' | head -1 || true)
if [ -n "$PM2_DAEMON_USER" ]; then
  PM2_HOME=$(getent passwd "$PM2_DAEMON_USER" | cut -d: -f6)
fi
# Fallback : daemon root
if [ -z "$PM2_HOME" ]; then
  PM2_DAEMON_USER=$(ps aux 2>/dev/null | grep 'PM2.*God Daemon' | grep -v grep | awk '{print $1}' | head -1 || true)
  if [ -n "$PM2_DAEMON_USER" ]; then
    PM2_HOME=$(getent passwd "$PM2_DAEMON_USER" | cut -d: -f6)
  fi
fi
# Fallback final : owner du binaire pm2
if [ -z "$PM2_HOME" ]; then
  PM2_OWNER=$(stat -c '%U' "$PM2_BIN" 2>/dev/null || true)
  if [ -n "$PM2_OWNER" ] && [ "$PM2_OWNER" != "root" ]; then
    PM2_HOME=$(getent passwd "$PM2_OWNER" | cut -d: -f6)
  else
    PM2_HOME="$HOME"
  fi
fi
echo "PM2 HOME : $PM2_HOME"
echo "PM2 USER : $PM2_DAEMON_USER"

echo "[2/4] Création du service systemd..."
cat > /etc/systemd/system/acs2i-agent.service << EOF
[Unit]
Description=Acs2i PM2 Agent
After=network.target

[Service]
ExecStart=$NODE_BIN /usr/local/bin/acs2i-agent
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PATH=$CURRENT_PATH
Environment=HOME=$PM2_HOME
Environment=PM2_HOME=$PM2_HOME/.pm2
Environment=PM2_BIN=$PM2_BIN
Environment=PM2_USER=$PM2_DAEMON_USER
Environment=SERVER_ID=${serverId}

[Install]
WantedBy=multi-user.target
EOF

echo "[3/4] Activation du service..."
systemctl daemon-reload
systemctl enable acs2i-agent
systemctl restart acs2i-agent

echo "[4/4] Agent installé et démarré."
systemctl status acs2i-agent --no-pager
`;

  res.setHeader("Content-Type", "text/plain");
  res.send(script);
}
