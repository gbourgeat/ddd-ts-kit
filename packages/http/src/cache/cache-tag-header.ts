/**
 * The response header a shared cache reads the tags of an answer from: `surrogate-key` (Fastly,
 * Varnish with xkey), `xkey` (Varnish), `cache-tag` (Cloudflare), `cdn-tag` (Bunny).
 */
export const CacheTagHeader = {
  surrogateKey: 'surrogate-key',
  xkey: 'xkey',
  cacheTag: 'cache-tag',
  cdnTag: 'cdn-tag',
} as const;

export type CacheTagHeader = (typeof CacheTagHeader)[keyof typeof CacheTagHeader];
