import type { Config } from '../../config/index.js';
import { familyOf } from './family-of.js';
import type { InitFile } from './init-file.js';
import { platformFile } from './platform-file.js';
import { when } from './when.js';

/** What each authorization model needs next to its adapter of the `Authorizer` port. */
const AUTHORIZATION_MODEL: Readonly<Record<string, readonly string[]>> = {
  rbac: ['role.ts', 'roles.ts'],
  abac: ['role.ts', 'attribute-policies.ts'],
  rebac: [
    'relationship-schema.ts',
    'create-tuple-store.ts',
    'create-tuple-store.contract.spec.ts',
    'relation-tuples.ts',
    'relate-system-actors.ts',
    'permission-mapping.ts',
    'permissions.ts',
  ],
  custom: ['custom-authorizer.ts', 'custom-authorizer.contract.spec.ts', 'permissions.ts'],
};

/** Who is calling (at the HTTP boundary only) and what they may do (behind one port, whatever the model). */
export function authFiles(config: Config): InitFile[] {
  const { authz, audit } = config.stack;
  const file = (name: string, variant?: string): InitFile => platformFile(config, `auth/${name}`, variant);

  return [
    familyOf(config) === 'tsyringe' ? file('authorization.ts', 'tsyringe') : file('use-case-protection.ts'),
    file('create-authorizer.ts', authz),
    file('access-policies.ts'),
    ...when(audit !== 'on', [file('log-decisions.ts')]),
    ...(AUTHORIZATION_MODEL[authz] ?? []).map((name) => file(name)),
    ...authenticationFiles(config),
  ];
}

/** Authentication happens at the HTTP boundary: without one there is nobody to identify. */
function authenticationFiles(config: Config): InitFile[] {
  const { http, authn } = config.stack;
  const file = (name: string, variant?: string): InitFile => platformFile(config, `auth/${name}`, variant);
  const credential = authn === 'none' ? 'none' : 'tokens';

  if (http === 'none') {
    return [];
  }

  return [
    file('create-authenticator.ts', authn),
    file('principal-of.ts', credential),
    file('security-schemes.ts', credential),
    file('offline-authenticator.ts'),
    file('http-boundary.ts'),
    ...when(authn === 'none', [file('development-actor-header.ts'), file('development-header-authenticator.ts')]),
  ];
}
