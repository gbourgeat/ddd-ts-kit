import type { CachePurger } from '@ddd-ts-kit/kernel';
import { chunksOf } from './chunks-of.js';
import { sendPurge } from './send-purge.js';
import { VarnishPurgeMode } from './varnish-purge-mode.js';

export interface VarnishCachePurgerOptions {
  /** Varnish as the application reaches it, `http://varnish:80`: its VCL lets this address purge. */
  readonly url: string;
  /** `xkey` by default. */
  readonly mode?: VarnishPurgeMode;
  /** With xkey, marks the answers stale instead of removing them: served within their grace while the application answers again. */
  readonly soft?: boolean;
  /** How long a purge may take before it counts as failed. Default 5000. */
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;
// Varnish bounds a request header at 8 KB by default (http_req_hdr_len): 100 tags stay well below.
const TAGS_PER_REQUEST = 100;

/** Purges Varnish over HTTP, through the VCL `ddd-ts-kit init --http-cache varnish` writes. */
export class VarnishCachePurger implements CachePurger {
  private readonly timeoutMs: number;

  constructor(private readonly options: VarnishCachePurgerOptions) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async purge(tags: readonly string[]): Promise<void> {
    if ((this.options.mode ?? VarnishPurgeMode.xkey) === VarnishPurgeMode.ban) {
      for (const tag of tags) {
        await sendPurge({ url: this.options.url, method: 'PURGE', headers: { 'x-ban-tag': tag } }, this.timeoutMs);
      }

      return;
    }

    for (const chunk of chunksOf(tags, TAGS_PER_REQUEST)) {
      const header = this.options.soft === true ? 'xkey-softpurge' : 'xkey-purge';

      await sendPurge(
        { url: this.options.url, method: 'PURGE', headers: { [header]: chunk.join(' ') } },
        this.timeoutMs,
      );
    }
  }
}
