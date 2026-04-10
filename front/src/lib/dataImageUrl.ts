/** Public URL for a file served by `GET /data/image/:file` on the API. */
export function dataImageUrl(previewStorageKey: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  if (!base) return `/data/image/${encodeURIComponent(previewStorageKey)}`;
  return `${base}/data/image/${encodeURIComponent(previewStorageKey)}`;
}
