import type { Authenticator } from '@ddd-ts-kit/auth';
import type { HttpHeaders } from '@ddd-ts-kit/testing/e2e';
import { developmentActorHeader } from '{{alias.platform}}/auth/development-actor-header{{alias.ext}}';
import { DevelopmentHeaderAuthenticator } from '{{alias.platform}}/auth/development-header-authenticator{{alias.ext}}';

/** Who a test calls as: the identity, the roles and the tenant the development header carries. */
export interface TestActor {
  readonly id: string;
  readonly roles?: readonly string[];
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
