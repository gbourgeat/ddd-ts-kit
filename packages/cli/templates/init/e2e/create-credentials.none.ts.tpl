import type { Authenticator } from '@ddd-ts-kit/auth';
import type { HttpHeaders } from '@ddd-ts-kit/testing/e2e';
import { developmentActorHeader } from '{{alias.platform}}/auth/authentication/development-actor-header{{alias.ext}}';
import { DevelopmentHeaderAuthenticator } from '{{alias.platform}}/auth/authentication/development-header-authenticator{{alias.ext}}';
{{#if authz.roles}}
import type { Role } from '{{alias.platform}}/auth/authorization/role{{alias.ext}}';
{{/if}}

{{#if authz.roles}}
/** Who a test calls as: the identity, the roles and the tenant the development header carries. A role is one the platform declares (`Role.Admin`): another does not compile. */
{{/if}}
{{#unless authz.roles}}
/** Who a test calls as: the identity, the roles and the tenant the development header carries. */
{{/unless}}
export interface TestActor {
  readonly id: string;
{{#if authz.roles}}
  readonly roles?: readonly Role[];
{{/if}}
{{#unless authz.roles}}
  readonly roles?: readonly string[];
{{/unless}}
  readonly tenantId?: string;
}

export interface Credentials {
  readonly authenticator: Authenticator;

  headersOf(actor: TestActor): Promise<HttpHeaders>;
}

export async function createCredentials(): Promise<Credentials> {
  return {
    authenticator: new DevelopmentHeaderAuthenticator('test'),
    headersOf: async (actor) => ({ [developmentActorHeader]: headerOf(actor) }),
  };
}

function headerOf(actor: TestActor): string {
  const tenant = actor.tenantId === undefined ? [] : ['tenant=' + actor.tenantId];

  return [actor.id, 'roles=' + (actor.roles ?? []).join(','), ...tenant].join(';');
}
