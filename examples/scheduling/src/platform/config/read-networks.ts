import { isTenantId } from '@ddd-ts-kit/kernel';
import type { Environment } from '@/platform/config/environment';

/**
 * `NETWORKS`: the networks of practices this deployment serves, by tenant id, separated by commas.
 * Each one is a tenant (ADR-0003): a scheduled job runs once for each, in its scope. A tenant id
 * is letters, digits, `_` and `-`, at most 63 characters.
 */
export function readNetworks(env: Environment): readonly string[] {
  const networks = (env.optional('NETWORKS') ?? '')
    .split(',')
    .map((network) => network.trim())
    .filter((network) => network !== '');

  if (networks.length === 0 || !networks.every(isTenantId)) {
    env.problem('NETWORKS must list the tenant ids of the networks served, separated by commas');
  }

  return [...new Set(networks)];
}
