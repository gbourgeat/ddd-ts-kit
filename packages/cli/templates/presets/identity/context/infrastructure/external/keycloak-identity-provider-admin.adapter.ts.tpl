import { Adapter } from '@ddd-ts-kit/kernel/declarations';
import { IdentityProviderAdmin } from '{{alias.context}}/application/ports/identity-provider-admin.port{{alias.ext}}';
import type { IdentityProviderConnection } from '{{alias.context}}/application/ports/identity-provider-connection.port{{alias.ext}}';

const CONFLICT = 409;
const NOT_FOUND = 404;

interface Call {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly body?: unknown;
  /** Statuses that mean the change is already there: a retry finds it done. */
  readonly done?: readonly number[];
}

interface KeycloakOrganisation {
  readonly id: string;
  readonly alias: string;
}

/**
 * The administration REST API of Keycloak (26 and later, which has organizations): the client of
 * `IdentityProviderConnection` takes a token by the client credentials grant, then asks. An
 * organisation is known there under its slug as alias, so that the `organization` claim of a
 * token names it; every change is idempotent, so that the retries of the platform are safe.
 */
@Adapter(IdentityProviderAdmin, { kind: 'external' })
export class KeycloakIdentityProviderAdmin implements IdentityProviderAdmin {
  constructor(private readonly connection: IdentityProviderConnection) {}

  async openOrganisation(organisation: { readonly id: string; readonly name: string }): Promise<void> {
    const body = { name: organisation.name, alias: organisation.id, enabled: true };

    await this.send({ method: 'POST', path: 'organizations', body, done: [CONFLICT] });
  }

  async addMember(organisationId: string, accountId: string): Promise<void> {
    const keycloakId = await this.organisationNamed(organisationId);

    await this.send({ method: 'POST', path: `organizations/${keycloakId}/members`, body: accountId, done: [CONFLICT] });
  }

  async removeMember(organisationId: string, accountId: string): Promise<void> {
    const keycloakId = await this.organisationNamed(organisationId);
    const path = `organizations/${keycloakId}/members/${encodeURIComponent(accountId)}`;

    await this.send({ method: 'DELETE', path, done: [NOT_FOUND] });
  }

  async disableAccount(accountId: string): Promise<void> {
    await this.send({ method: 'PUT', path: `users/${encodeURIComponent(accountId)}`, body: { enabled: false } });
  }

  private async organisationNamed(alias: string): Promise<string> {
    const answer = await this.send({
      method: 'GET',
      path: `organizations?search=${encodeURIComponent(alias)}&exact=true`,
    });

    const found: unknown = await answer.json();
    const organisation = Array.isArray(found) ? found.find((candidate) => isOrganisation(candidate, alias)) : undefined;

    if (organisation === undefined) {
      throw new Error(`Keycloak knows no organization under the alias ${alias}.`);
    }

    return organisation.id;
  }

  private async send(call: Call): Promise<Response> {
    const { baseUrl, realm } = await this.connection.settings();
    const headers = { authorization: `Bearer ${await this.token()}`, 'content-type': 'application/json' };
    const body = call.body === undefined ? {} : { body: JSON.stringify(call.body) };

    const answer = await fetch(`${baseUrl}/admin/realms/${realm}/${call.path}`, {
      method: call.method,
      headers,
      ...body,
    });

    if (!answer.ok && !(call.done ?? []).includes(answer.status)) {
      throw new Error(`Keycloak answered ${answer.status} to ${call.method} ${call.path.split('?')[0] ?? ''}.`);
    }

    return answer;
  }

  private async token(): Promise<string> {
    const { baseUrl, realm, clientId, clientSecret } = await this.connection.settings();
    const grant = { grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret };

    const answer = await fetch(`${baseUrl}/realms/${realm}/protocol/openid-connect/token`, {
      method: 'POST',
      body: new URLSearchParams(grant),
    });

    const granted: unknown = await answer.json();

    if (!answer.ok || !isToken(granted)) {
      throw new Error(`Keycloak refused a token to the client ${clientId} (${answer.status}).`);
    }

    return granted.access_token;
  }
}

function isOrganisation(candidate: unknown, alias: string): candidate is KeycloakOrganisation {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'id' in candidate &&
    typeof candidate.id === 'string' &&
    'alias' in candidate &&
    candidate.alias === alias
  );
}

function isToken(granted: unknown): granted is { readonly access_token: string } {
  return (
    typeof granted === 'object' &&
    granted !== null &&
    'access_token' in granted &&
    typeof granted.access_token === 'string'
  );
}
