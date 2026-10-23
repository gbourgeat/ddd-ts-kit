import { describe, expect, it } from 'vitest';
import { Environment } from '@/platform/config/environment';
import { readNetworks } from '@/platform/config/read-networks';

describe('The networks a deployment serves (NETWORKS)', () => {
  it('are the tenant ids listed, once each, without the spaces around them', () => {
    const env = new Environment({ NETWORKS: ' north, south ,north,' });

    expect(readNetworks(env)).toEqual(['north', 'south']);
    expect(env.problems).toEqual([]);
  });

  it('are a problem when none is listed, or when one is not a tenant id', () => {
    const missing = new Environment({});
    const malformed = new Environment({ NETWORKS: 'north,a:b' });

    readNetworks(missing);
    readNetworks(malformed);

    expect([...missing.problems, ...malformed.problems]).toEqual([
      'NETWORKS must list the tenant ids of the networks served, separated by commas',
      'NETWORKS must list the tenant ids of the networks served, separated by commas',
    ]);
  });
});
