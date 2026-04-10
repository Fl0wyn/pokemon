import { Request, Response } from "express";

export function getUninstallScript(req: Request, res: Response) {
  const script = `#!/bin/bash
set -e

if [ "$EUID" -ne 0 ]; then
  echo "Erreur : ce script doit être exécuté en root (sudo bash)"
  exit 1
fi

if systemctl is-active --quiet acs2i-agent; then
  echo "[1/3] Arrêt du service..."
  systemctl stop acs2i-agent
fi

echo "[2/3] Désactivation et suppression du service..."
systemctl disable acs2i-agent 2>/dev/null || true
rm -f /etc/systemd/system/acs2i-agent.service
systemctl daemon-reload

echo "[3/3] Suppression de l'agent..."
rm -f /usr/local/bin/acs2i-agent

echo "Agent désinstallé."
`;

  res.setHeader("Content-Type", "text/plain");
  res.send(script);
}
