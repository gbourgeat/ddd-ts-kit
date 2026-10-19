import type { Scope } from '../generate/scope.js';
import { platformPath } from '../generate/platform-path.js';

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

/**
 * With tenants, the organisations a token names are the tenants of the person: the authenticator
 * of a Keycloak project reads the `organization` claim, which the preset's provider adapter keeps
 * in line. Another authenticator, or one the team rewrote, is left alone with a step saying what
 * to map.
 */
export function organisationsAsTenants(scope: Scope): void {
  if (scope.config.stack.tenancy === 'none' || scope.config.stack.authn === 'none') {
    return;
  }

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
