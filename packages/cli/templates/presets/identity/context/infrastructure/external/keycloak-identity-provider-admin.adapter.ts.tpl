{{#if style.declared}}
import { Adapter } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { IdentityProviderAdmin } from '{{alias.context}}/application/ports/identity-provider-admin.port{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { IdentityProviderAdmin } from '{{alias.context}}/application/ports/identity-provider-admin.port{{alias.ext}}';
{{/unless}}
import type { IdentityProviderConnection } from '{{alias.context}}/application/ports/identity-provider-connection.port{{alias.ext}}';

const CONFLICT = 409;
const NOT_FOUND = 404;

/** How many organizations one read of the realm lists. */
const PAGE = 100;

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

/** One page of the organizations of the realm: the one under the alias if it is there, and whether more may follow. */
interface SearchedPage {
  readonly found: KeycloakOrganisation | undefined;
  readonly full: boolean;
}

/**
 * A recipe for the administration REST API of Keycloak (26 and later, which has organizations):
 * the client of `IdentityProviderConnection` takes a token by the client credentials grant, then
 * asks. An organisation is known there under its slug as alias, so that the `organization` claim
 * of a token names it. Every change is idempotent, since the consumers that call it are delivered
 * at least once (`application/integration/handlers/`). Its spec runs it against a local server
 * that answers as Keycloak does, not against Keycloak itself: run it once against your realm
 * before relying on it (docs/guides/bootstrap-with-well-designed-contexts.md says how).
 */
{{#if style.declared}}
@Adapter(IdentityProviderAdmin, { kind: 'external' })
{{/if}}
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

  /** Keycloak searches organizations by name, not by alias: its pages are read until the alias is found. */
  private async organisationNamed(alias: string): Promise<string> {
    let first = 0;
    let page = await this.searchPage(alias, first);

    while (page.found === undefined && page.full) {
      first += PAGE;
      page = await this.searchPage(alias, first);
    }

    if (page.found === undefined) {
      throw new Error(`Keycloak knows no organization under the alias ${alias}.`);
    }

    return page.found.id;
  }

  private async searchPage(alias: string, first: number): Promise<SearchedPage> {
    const answer = await this.send({ method: 'GET', path: `organizations?briefRepresentation=true&first=${first}&max=${PAGE}` });
    const listed: unknown = await answer.json();

    if (!Array.isArray(listed)) {
      return { found: undefined, full: false };
    }

    return { found: listed.find((candidate) => isOrganisation(candidate, alias)), full: listed.length === PAGE };
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
