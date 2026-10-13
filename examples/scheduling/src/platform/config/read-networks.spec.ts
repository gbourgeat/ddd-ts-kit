import { describe, expect, it } from 'vitest';
import { readNetworks } from '@/platform/config/read-networks';

describe('The networks a deployment serves (NETWORKS)', () => {
  it('are the tenant ids listed, once each, without the spaces around them', () => {
    const problems: string[] = [];

    expect(readNetworks({ NETWORKS: ' north, south ,north,' }, problems)).toEqual(['north', 'south']);
    expect(problems).toEqual([]);
  });

  it('are a problem when none is listed, or when one is not a tenant id', () => {
    const problems: string[] = [];

    readNetworks({}, problems);
    readNetworks({ NETWORKS: 'north,a:b' }, problems);

    expect(problems).toEqual([
      'NETWORKS must list the tenant ids of the networks served, separated by commas',
      'NETWORKS must list the tenant ids of the networks served, separated by commas',
    ]);
  });
});
