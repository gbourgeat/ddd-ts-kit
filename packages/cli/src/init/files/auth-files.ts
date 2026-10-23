import type { Config } from '../../config/index.js';
import type { PlatformFile } from '../../platform-layout/index.js';
import { familyOf } from './family-of.js';
import type { InitFile } from './init-file.js';
import { platformFile } from './platform-file.js';
import { when } from './when.js';

/** What each authorization model needs next to its adapter of the `Authorizer` port. */
const AUTHORIZATION_MODEL: Readonly<Record<string, readonly PlatformFile[]>> = {
  rbac: ['auth/authorization/role.ts', 'auth/roles/roles.ts'],
  abac: ['auth/authorization/role.ts', 'auth/attributes/attribute-policies.ts'],
  rebac: [
    'auth/relationships/relationship-schema.ts',
    'auth/relationships/create-tuple-store.ts',
    'auth/relationships/create-tuple-store.contract.spec.ts',
    'auth/relationships/relation-tuples.ts',
    'auth/relationships/relate-system-actors.ts',
    'auth/authorization/permissions.ts',
  ],
  custom: [
    'auth/custom/custom-authorizer.ts',
    'auth/custom/custom-authorizer.contract.spec.ts',
    'auth/authorization/permissions.ts',
  ],
};

/** Who is calling (at the HTTP boundary only) and what they may do (behind one port, whatever the model). */
export function authFiles(config: Config): InitFile[] {
  const { authz, audit } = config.stack;
  const file = (name: PlatformFile, variant?: string): InitFile => platformFile(config, name, variant);

  return [
    familyOf(config) === 'tsyringe'
      ? file('auth/authorization/authorization.ts', 'tsyringe')
      : file('auth/authorization/use-case-protection.ts'),
    file('auth/authorization/create-authorizer.ts', authz),
    file('auth/authorization/access-policies.ts'),
    ...when(audit !== 'on', [file('auth/authorization/log-decisions.ts')]),
    ...(AUTHORIZATION_MODEL[authz] ?? []).map((name) => file(name)),
    ...authenticationFiles(config),
  ];
}

/** Authentication happens at the HTTP boundary: without one there is nobody to identify. */
function authenticationFiles(config: Config): InitFile[] {
  const { http, authn } = config.stack;
  const file = (name: PlatformFile, variant?: string): InitFile => platformFile(config, name, variant);
  const credential = authn === 'none' ? 'none' : 'tokens';

  if (http === 'none') {
    return [];
  }

  return [
    file('auth/authentication/create-authenticator.ts', authn),
    file('auth/authentication/principal-of.ts', credential),
    file('auth/authentication/security-schemes.ts', credential),
    file('auth/authentication/offline-authenticator.ts'),
    file('auth/authentication/http-boundary.ts'),
    ...when(authn === 'none', [
      file('auth/authentication/development-actor-header.ts'),
      file('auth/authentication/development-header-authenticator.ts'),
    ]),
  ];
}
