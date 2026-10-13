import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cachePurgerContract } from '@ddd-ts-kit/testing/contracts';
import { CachePurgeError, VarnishCachePurger, VarnishPurgeMode } from '../src/purgers.js';
import { startTaggedOrigin, type TaggedOrigin } from './support/tagged-origin.js';

/*
 * Varnish started by pipeline/github/scripts/start-varnish.sh with the VCL `init --http-cache varnish`
 * writes, in front of the origin this spec starts on the backend port:
 *   sh pipeline/github/scripts/start-varnish.sh packages/cli/templates/init/docker/varnish.vcl.tpl 18089 16081
 *   DDD_TS_KIT_TEST_VARNISH_URL=http://127.0.0.1:16081 npx vitest run packages/http/test/varnish-cache-purger.spec.ts
 */
const VARNISH_URL = process.env['DDD_TS_KIT_TEST_VARNISH_URL'];
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
        purger: new VarnishCachePurger({ url, mode, soft }),
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

  it('fails when no Varnish answers, so the relay retries the purge', async () => {
    const unreachable = new VarnishCachePurger({ url: 'http://127.0.0.1:1', timeoutMs: 2_000 });

    await expect(unreachable.purge(['calendar'])).rejects.toThrow(CachePurgeError);
  });
});
