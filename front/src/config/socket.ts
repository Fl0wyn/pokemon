/**
 * Socket.IO must use the same origin as the API that signed the JWT.
 */
export function getSocketBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_WATCHER_URL?.replace(/\/$/, "");
  if (explicit) return explicit;

  const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
  if (api) {
    return api.replace(/\/api$/, "") || api;
  }

  return "https://toolbox.acs2i.fr";
}

export function getSocketPath(baseUrl: string): string {
  const isLocalDevSocket =
    baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");
  return isLocalDevSocket ? "/socket.io" : "/api/socket.io";
}
