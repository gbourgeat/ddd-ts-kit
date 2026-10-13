/**
 * The roles a credential carries, each written once: a grant or a guard names one as
 * `Role.PlatformAdmin`, never as a string.
 */
export const Role = {
  NetworkAdmin: 'network-admin',
  PlatformAdmin: 'platform-admin',
  Patient: 'patient',
  Support: 'support',
} as const;

export type Role = (typeof Role)[keyof typeof Role];
