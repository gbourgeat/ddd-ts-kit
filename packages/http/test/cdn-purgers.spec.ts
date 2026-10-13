import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cachePurgerContract } from '@ddd-ts-kit/testing/contracts';
import { CloudflareCachePurger, FastlyCachePurger } from '../src/purgers.js';
import { CDN_TOKEN, CLOUDFLARE, FASTLY, startFakeCdnApi, type FakeCdnApi } from './support/fake-cdn-api.js';

const runner = { describe, it, expect, beforeEach };
const opened: FakeCdnApi[] = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((api) => api.close()));
});

async function opening(dialect: typeof FASTLY): Promise<FakeCdnApi> {
  const api = await startFakeCdnApi(dialect);

  opened.push(api);

  return api;
}

cachePurgerContract(runner, {
  name: 'FastlyCachePurger, on the purge API Fastly documents',
  createCache: async () => {
    const api = await opening(FASTLY);
    const purger = new FastlyCachePurger({ serviceId: 'svc-1', token: CDN_TOKEN, endpoint: api.url });

    return { purger, store: api.store, holds: api.holds };
  },
});

cachePurgerContract(runner, {
  name: 'CloudflareCachePurger, on the purge API Cloudflare documents',
  createCache: async () => {
    const api = await opening(CLOUDFLARE);
    const purger = new CloudflareCachePurger({ zoneId: 'zone-1', token: CDN_TOKEN, endpoint: api.url });

    return { purger, store: api.store, holds: api.holds };
  },
});
