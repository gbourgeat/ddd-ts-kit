import type { Config } from './config';

/** The context is declared the control plane of the tenants: its tables belong to no tenant, under a recorded deviation. */
export function isControlPlane(config: Config, context: string): boolean {
  return config.contexts[context]?.tenancy === 'control-plane';
}
