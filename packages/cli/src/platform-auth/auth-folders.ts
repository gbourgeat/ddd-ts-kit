/**
 * The folder of `<platformDir>/auth/` each file of the platform lives in, by the question it
 * answers: who is calling, what they may do whatever the model, then the model of the project,
 * one folder named after it.
 */
export const AUTH_FOLDERS = {
  authentication: [
    'create-authenticator.ts',
    'principal-of.ts',
    'security-schemes.ts',
    'http-boundary.ts',
    'offline-authenticator.ts',
    'development-actor-header.ts',
    'development-header-authenticator.ts',
  ],
  authorization: [
    'authorization.ts',
    'use-case-protection.ts',
    'create-authorizer.ts',
    'access-policies.ts',
    'permissions.ts',
    'signed-in-grants.ts',
    'log-decisions.ts',
    'role.ts',
  ],
  roles: ['roles.ts'],
  attributes: ['attribute-policies.ts'],
  relationships: [
    'relationship-schema.ts',
    'relation-tuples.ts',
    'create-tuple-store.ts',
    'create-tuple-store.contract.spec.ts',
    'relate-system-actors.ts',
    'permission-mapping.ts',
  ],
  custom: ['custom-authorizer.ts', 'custom-authorizer.contract.spec.ts'],
} as const;
