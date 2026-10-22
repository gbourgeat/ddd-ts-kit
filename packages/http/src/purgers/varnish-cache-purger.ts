import type { CachePurger } from '@ddd-ts-kit/kernel';
import { chunksOf } from './chunks-of';
import { sendPurge } from './send-purge';
import { VarnishPurgeMode } from './varnish-purge-mode';

export interface VarnishCachePurgerOptions {
  /** Varnish as the application reaches it, `http://varnish:80`. */
  readonly url: string;
  /**
   * The key Varnish was started with (`VARNISH_PURGE_KEY`), sent in `x-purge-key`: the VCL lets
   * a request purge from another address than its own machine only with it.
   */
  readonly key?: string;
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
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

/** Purges Varnish over HTTP, through the VCL `ddd-ts-kit init --http-cache varnish` writes. */
export class VarnishCachePurger implements CachePurger {
  private readonly timeoutMs: number;
  private readonly authorization: Readonly<Record<string, string>>;

  constructor(private readonly options: VarnishCachePurgerOptions) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.authorization = options.key === undefined ? {} : { 'x-purge-key': options.key };
  }

  async purge(tags: readonly string[]): Promise<void> {
    if ((this.options.mode ?? VarnishPurgeMode.xkey) === VarnishPurgeMode.ban) {
      for (const tag of tags) {
        // The VCL writes the tag into a regular expression: its special characters stand for themselves.
        await this.send({ 'x-ban-tag': tag.replace(REGEX_SPECIAL, '\\$&') });
      }

      return;
    }

    for (const chunk of chunksOf(tags, TAGS_PER_REQUEST)) {
      await this.send({ [this.options.soft === true ? 'xkey-softpurge' : 'xkey-purge']: chunk.join(' ') });
    }
  }

  private async send(headers: Readonly<Record<string, string>>): Promise<void> {
    await sendPurge(
      { url: this.options.url, method: 'PURGE', headers: { ...this.authorization, ...headers } },
      this.timeoutMs,
    );
  }
}
