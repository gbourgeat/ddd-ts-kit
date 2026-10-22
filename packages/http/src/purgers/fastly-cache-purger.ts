import type { CachePurger } from '@ddd-ts-kit/kernel';
import { chunksOf } from './chunks-of';
import { sendPurge } from './send-purge';

export interface FastlyCachePurgerOptions {
  readonly serviceId: string;
  /** An API token allowed to purge the service (`purge_select` scope). */
  readonly token: string;
  /** Marks the answers stale instead of removing them (`Fastly-Soft-Purge`). */
  readonly soft?: boolean;
  /** Default `https://api.fastly.com`. */
  readonly endpoint?: string;
  /** Default 5000. */
  readonly timeoutMs?: number;
}

const DEFAULT_ENDPOINT = 'https://api.fastly.com';
const DEFAULT_TIMEOUT_MS = 5_000;
// The documented bound of one purge request: 256 surrogate keys.
const KEYS_PER_REQUEST = 256;

/** Purges the surrogate keys of a Fastly service through its API; answers carry them in `Surrogate-Key`. */
export class FastlyCachePurger implements CachePurger {
  constructor(private readonly options: FastlyCachePurgerOptions) {}

  async purge(tags: readonly string[]): Promise<void> {
    const { serviceId, token, soft, endpoint = DEFAULT_ENDPOINT, timeoutMs = DEFAULT_TIMEOUT_MS } = this.options;

    for (const chunk of chunksOf(tags, KEYS_PER_REQUEST)) {
      await sendPurge(
        {
          url: `${endpoint}/service/${encodeURIComponent(serviceId)}/purge`,
          method: 'POST',
          headers: {
            'fastly-key': token,
            'content-type': 'application/json',
            ...(soft === true ? { 'fastly-soft-purge': '1' } : {}),
          },
          body: JSON.stringify({ surrogate_keys: chunk }),
        },
        timeoutMs,
      );
    }
  }
}
