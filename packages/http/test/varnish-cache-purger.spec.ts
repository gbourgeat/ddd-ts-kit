import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cachePurgerContract } from '@ddd-ts-kit/testing/contracts';
import { CachePurgeError, VarnishCachePurger, VarnishPurgeMode } from '../src/purgers.js';
import { startTaggedOrigin, type TaggedOrigin } from './support/tagged-origin.js';

/*
 * Varnish started by pipeline/github/scripts/start-varnish.sh with the VCL `init --http-cache varnish`
 * writes, in front of the origin this spec starts on the backend port, with the purge key of
 * VARNISH_PURGE_KEY (a purge reaches a container from another address than its own machine):
 *   VARNISH_PURGE_KEY=k sh pipeline/github/scripts/start-varnish.sh packages/cli/templates/init/docker/varnish.vcl.tpl 18089 16081
 *   DDD_TS_KIT_TEST_VARNISH_URL=http://127.0.0.1:16081 DDD_TS_KIT_TEST_VARNISH_PURGE_KEY=k npx vitest run packages/http/test/varnish-cache-purger.spec.ts
 */
const VARNISH_URL = process.env['DDD_TS_KIT_TEST_VARNISH_URL'];
const PURGE_KEY = process.env['DDD_TS_KIT_TEST_VARNISH_PURGE_KEY'];
const BACKEND_PORT = Number(process.env['DDD_TS_KIT_TEST_VARNISH_BACKEND_PORT'] ?? '18089');
const runner = { describe, it, expect, beforeEach };

describe.skipIf(VARNISH_URL === undefined)('VarnishCachePurger on Varnish', () => {
  const url = VARNISH_URL ?? '';
  let origin: TaggedOrigin;
  let run = 0;

  beforeAll(async () => {
    origin = await startTaggedOrigin(BACKEND_PORT);
  });

  afterAll(() => origin.close());

  const cacheIn =
    (mode: VarnishPurgeMode, soft = false) =>
    () => {
      run += 1;
      const namespace = `/${Date.now()}-${run}`;

      return {
        purger: new VarnishCachePurger({ url, mode, soft, ...(PURGE_KEY === undefined ? {} : { key: PURGE_KEY }) }),
        store: async (key: string, tags: readonly string[]): Promise<void> => {
          origin.answerUnder(`${namespace}${key}`, tags);
          await fetch(`${url}${namespace}${key}`).then((answer) => answer.text());
        },
        holds: async (key: string): Promise<boolean> => {
          const answer = await fetch(`${url}${namespace}${key}`);

          await answer.text();

          return answer.headers.get('x-cache') === 'HIT';
        },
      };
    };

  cachePurgerContract(runner, { name: 'VarnishCachePurger, xkey', createCache: cacheIn(VarnishPurgeMode.xkey) });
  cachePurgerContract(runner, { name: 'VarnishCachePurger, ban', createCache: cacheIn(VarnishPurgeMode.ban) });

  it('keeps nothing an answer did not allow by name, whatever the default TTL of Varnish', async () => {
    const path = `/${Date.now()}-without-policy`;

    origin.answerWithoutPolicy(path);
    await fetch(`${url}${path}`).then((answer) => answer.text());

    const again = await fetch(`${url}${path}`);

    await again.text();

    expect(again.headers.get('x-cache')).toBe('MISS');
  });

  // From another address than the machine of Varnish only: a container reached through its published port.
  it.runIf(PURGE_KEY !== undefined)('refuses a purge without its key, which the relay retries', async () => {
    await expect(new VarnishCachePurger({ url }).purge(['calendar'])).rejects.toThrow(
      expect.objectContaining({ name: 'CachePurgeError', status: 403 }),
    );

    await expect(new VarnishCachePurger({ url, key: 'not-the-key' }).purge(['calendar'])).rejects.toThrow(
      CachePurgeError,
    );
  });

  it('fails when no Varnish answers, so the relay retries the purge', async () => {
    const unreachable = new VarnishCachePurger({ url: 'http://127.0.0.1:1', timeoutMs: 2_000 });

    await expect(unreachable.purge(['calendar'])).rejects.toThrow(CachePurgeError);
  });
});
