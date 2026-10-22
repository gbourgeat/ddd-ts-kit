import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CachePurgeError,
  CloudflareCachePurger,
  FastlyCachePurger,
  VarnishCachePurger,
  VarnishPurgeMode,
} from '../src/purgers';
import { startRecordingCacheApi, type RecordingCacheApi } from './support/recording-cache-api';

let api: RecordingCacheApi;

beforeEach(async () => {
  api = await startRecordingCacheApi();
});

afterEach(() => api.close());

const tagsUpTo = (count: number): string[] => Array.from({ length: count }, (_, index) => `calendar:c-${index}`);

describe('VarnishCachePurger', () => {
  it('purges through xkey, a hundred tags a request, softly when asked', async () => {
    await new VarnishCachePurger({ url: api.url }).purge(tagsUpTo(150));
    await new VarnishCachePurger({ url: api.url, soft: true }).purge(['calendar']);

    expect(api.received.map(({ method }) => method)).toEqual(['PURGE', 'PURGE', 'PURGE']);
    expect(String(api.received[0]?.headers['xkey-purge']).split(' ')).toHaveLength(100);
    expect(String(api.received[1]?.headers['xkey-purge']).split(' ')).toHaveLength(50);
    expect(api.received[2]?.headers['xkey-softpurge']).toBe('calendar');
  });

  it('bans each tag in turn, its characters of a pattern escaped, with the key when it has one', async () => {
    const purger = new VarnishCachePurger({ url: api.url, mode: VarnishPurgeMode.ban, key: 'secret' });

    await purger.purge(['calendar:c-1', 'calendar:c.1(a)*']);

    expect(api.received.map(({ method, headers }) => `${method} ${String(headers['x-ban-tag'])}`)).toEqual([
      'PURGE calendar:c-1',
      'PURGE calendar:c\\.1\\(a\\)\\*',
    ]);

    expect(api.received[0]?.headers['x-purge-key']).toBe('secret');
  });

  it('sends nothing for no tag', async () => {
    await new VarnishCachePurger({ url: api.url }).purge([]);

    expect(api.received).toEqual([]);
  });

  it('fails with the status Varnish answered, so the relay retries', async () => {
    api.answerWith(403);

    await expect(new VarnishCachePurger({ url: api.url }).purge(['calendar'])).rejects.toThrow(
      expect.objectContaining({ name: 'CachePurgeError', status: 403 }),
    );
  });
});

describe('FastlyCachePurger', () => {
  it('purges the surrogate keys of the service, 256 a request, with its token, softly when asked', async () => {
    const purger = new FastlyCachePurger({ serviceId: 'svc 1', token: 'secret', soft: true, endpoint: api.url });

    await purger.purge(tagsUpTo(300));

    expect(api.received.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /service/svc%201/purge',
      'POST /service/svc%201/purge',
    ]);

    expect(api.received[0]?.headers).toMatchObject({ 'fastly-key': 'secret', 'fastly-soft-purge': '1' });
    expect(JSON.parse(api.received[0]?.body ?? '{}')).toEqual({ surrogate_keys: tagsUpTo(256) });
    expect(JSON.parse(api.received[1]?.body ?? '{}').surrogate_keys).toHaveLength(44);
  });

  it('fails when the API refuses the token', async () => {
    api.answerWith(401);

    await expect(
      new FastlyCachePurger({ serviceId: 's', token: 'wrong', endpoint: api.url }).purge(['calendar']),
    ).rejects.toThrow(CachePurgeError);
  });
});

describe('CloudflareCachePurger', () => {
  it('purges the cache tags of the zone, 100 a request, with its token', async () => {
    await new CloudflareCachePurger({ zoneId: 'zone-1', token: 'secret', endpoint: api.url }).purge(tagsUpTo(101));

    expect(api.received.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /zones/zone-1/purge_cache',
      'POST /zones/zone-1/purge_cache',
    ]);

    expect(api.received[0]?.headers['authorization']).toBe('Bearer secret');
    expect(JSON.parse(api.received[1]?.body ?? '{}')).toEqual({ tags: ['calendar:c-100'] });
  });

  it('fails when the account is over its rate of purges', async () => {
    api.answerWith(429);

    await expect(
      new CloudflareCachePurger({ zoneId: 'z', token: 't', endpoint: api.url }).purge(['calendar']),
    ).rejects.toThrow('answered 429');
  });
});
