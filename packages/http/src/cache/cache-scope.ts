/**
 * Who may keep an answer: `public`, every cache on the way (a CDN, Varnish, the browser);
 * `private`, the browser of the caller only; `no-store`, nobody.
 */
export const CacheScope = {
  public: 'public',
  private: 'private',
  noStore: 'no-store',
} as const;

export type CacheScope = (typeof CacheScope)[keyof typeof CacheScope];
