import type { Scope } from '../generate/scope';
import { platformPath } from '../generate/platform-path';

const KEYCLOAK_CALL =
  'return keycloakAuthenticator({ baseUrl, realm, audience, ...(clientId === undefined ? {} : { clientId }) });';

const READS_ORGANISATIONS = "tenantClaim: 'organization'";

const READING = [
  'return keycloakAuthenticator({',
  '    baseUrl,',
  '    realm,',
  '    audience,',
  `    ${READS_ORGANISATIONS},`,
  '    ...(clientId === undefined ? {} : { clientId }),',
  '  });',
].join('\n');

const TENANT_DOC = ' * tenant from the `tenant_id` claim; the session keeps nothing of the token. The realm needs an\n';

const ORGANISATIONS_DOC = [
  ' * tenants from the `organization` claim (one names the tenant of every request; several are the',
  ' * `tenants` a request names one of); the session keeps nothing of the token. The realm needs an',
  '',
].join('\n');

/** What the HTTP boundary is given, after the session of a request: the organisation it works in. */
const RESOLVING = {
  anchor: 'readonly resolvePrincipal: (raw: unknown) => Promise<Session>;',
  field: [
    '  /**',
    '   * The organisation a request works in: the one it names in `x-tenant-id`, refused with 403',
    '   * when the person is not a member of it, else the one of the token. A person of several',
    '   * organisations names one on each request to the data of a tenant.',
    '   */',
    '  readonly resolveTenant: TenantResolver;',
  ].join('\n'),
  given: 'resolvePrincipal: principalOf(authenticator),',
  resolver: 'resolveTenant: firstTenantOf(tenantFromHeader(), tenantFromClaim()),',
  firstImport: "import type { Authenticator } from '@ddd-ts-kit/auth';",
  imported: "import { firstTenantOf, tenantFromClaim, tenantFromHeader, type TenantResolver } from '@ddd-ts-kit/http';",
};

/**
 * With tenants, the organisations a token names are the tenants of the person: the authenticator
 * of a Keycloak project reads the `organization` claim, which the preset's provider adapter keeps
 * in line, and each request names the one it works in. Another authenticator, or one the team
 * rewrote, is left alone with a step saying what to map.
 */
export function organisationsAsTenants(scope: Scope): void {
  if (scope.config.stack.tenancy === 'none' || scope.config.stack.authn === 'none') {
    return;
  }

  requestsNameTheirOrganisation(scope);

  const file = platformPath(scope, 'auth/authentication/create-authenticator.ts');
  const source = scope.ws.read(file);

  if (source?.includes(READS_ORGANISATIONS) === true) {
    return;
  }

  if (scope.config.stack.authn === 'keycloak' && source?.includes(KEYCLOAK_CALL) === true) {
    scope.ws.update(file, source.replace(KEYCLOAK_CALL, READING).replace(TENANT_DOC, ORGANISATIONS_DOC));

    return;
  }

  scope.ws.step({
    file,
    anchor: 'export function createAuthenticator',
    text: `map the organisations of the token to the tenants of the actor (\`tenantClaim\`, or \`toActor\` filling \`tenantId\` and the \`tenants\` attribute): every organisation of ${scope.context.kebab} is a tenant.`,
  });
}

/**
 * The boundary resolves the tenant of each request from `x-tenant-id`, then from the token: a person
 * of one organisation works in it, a person of several names one, and the pipeline holds them to
 * those they belong to. A boundary that resolves its tenant already, or that the team rewrote, is
 * left alone, with a step when it names none.
 */
function requestsNameTheirOrganisation(scope: Scope): void {
  const file = platformPath(scope, 'auth/authentication/http-boundary.ts');
  const source = scope.ws.read(file);

  if (source === undefined || source.includes('resolveTenant')) {
    return;
  }

  const { anchor, field, given, resolver, firstImport, imported } = RESOLVING;

  if ([anchor, given, firstImport].every((line) => source.includes(line))) {
    const boundary = source
      .replace(firstImport, `${firstImport}\n${imported}`)
      .replace(anchor, `${anchor}\n${field}`)
      .replace(given, `${given}\n    ${resolver}`);

    scope.ws.update(file, boundary);

    return;
  }

  scope.ws.step({
    file,
    anchor: 'export function httpBoundary',
    text: `name the organisation each request works in: \`${resolver}\` among the options of the boundary, so that a person of several organisations names one with \`x-tenant-id\`.`,
  });
}
