import type { CachePurger } from '@ddd-ts-kit/kernel';
import { chunksOf } from './chunks-of';
import { sendPurge } from './send-purge';

export interface CloudflareCachePurgerOptions {
  readonly zoneId: string;
  /** An API token with the `Cache Purge` permission on the zone. */
  readonly token: string;
  /** Default `https://api.cloudflare.com/client/v4`. */
  readonly endpoint?: string;
  /** Default 5000. */
  readonly timeoutMs?: number;
}

const DEFAULT_ENDPOINT = 'https://api.cloudflare.com/client/v4';
const DEFAULT_TIMEOUT_MS = 5_000;
// The documented bound of one purge request, on every plan: 100 operations.
const TAGS_PER_REQUEST = 100;

/**
 * Purges the cache tags of a Cloudflare zone through its API, on every plan; answers carry them
 * in `Cache-Tag`. The account is held to a rate of purge requests (5 a minute on the free plan).
 */
export class CloudflareCachePurger implements CachePurger {
  constructor(private readonly options: CloudflareCachePurgerOptions) {}

  async purge(tags: readonly string[]): Promise<void> {
    const { zoneId, token, endpoint = DEFAULT_ENDPOINT, timeoutMs = DEFAULT_TIMEOUT_MS } = this.options;

    for (const chunk of chunksOf(tags, TAGS_PER_REQUEST)) {
      await sendPurge(
        {
          url: `${endpoint}/zones/${encodeURIComponent(zoneId)}/purge_cache`,
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ tags: chunk }),
        },
        timeoutMs,
      );
    }
  }
}
