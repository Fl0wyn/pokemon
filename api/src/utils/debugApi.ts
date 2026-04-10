/**
 * Logs de debug dans le terminal API (connexions, requêtes, Teams, Mongo).
 *
 * - `DEBUG_API=true` ou `1` : activé
 * - `DEBUG_API=false` ou `0` : désactivé
 * - Si absent : activé hors `NODE_ENV=production`
 */
export function debugApiEnabled(): boolean {
  const v = process.env.DEBUG_API?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "off" || v === "no") return false;
  if (v === "true" || v === "1" || v === "on" || v === "yes") return true;
  return process.env.NODE_ENV !== "production";
}

export function debugApiLog(...args: unknown[]): void {
  if (debugApiEnabled()) {
    console.log("[debug-api]", ...args);
  }
}
