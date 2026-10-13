import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '{{tests.module}}';
import type { IdentityProviderConnection } from '{{alias.context}}/application/ports/identity-provider-connection.port{{alias.ext}}';
import { KeycloakIdentityProviderAdmin } from '{{alias.context}}/infrastructure/external/keycloak-identity-provider-admin.adapter{{alias.ext}}';

/** What the realm was asked, as `<method> <path>` and the body it received. */
interface Asked {
  readonly call: string;
  readonly body: string;
}

/** As many organizations as one read of the adapter lists. */
const PAGE = 100;

const asked: Asked[] = [];
let server: Server;
let admin: KeycloakIdentityProviderAdmin;

beforeAll(async () => {
  server = createServer((request, response) => void answer(request, response));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  const connection: IdentityProviderConnection = {
    settings: async () => ({
      baseUrl: `http://127.0.0.1:${port}`,
      realm: 'acme',
      clientId: 'admin',
      clientSecret: 'secret',
    }),
  };

  admin = new KeycloakIdentityProviderAdmin(connection);
});

beforeEach(() => {
  asked.length = 0;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('KeycloakIdentityProviderAdmin, against a realm of Keycloak 26', () => {
  it('opens an organisation under its slug as alias, and an organisation already there is done', async () => {
    await admin.openOrganisation({ id: 'acme', name: 'Acme' });
    await admin.openOrganisation({ id: 'taken', name: 'Taken' });

    expect(asked.filter((one) => one.call.startsWith('POST /admin'))).toEqual([
      { call: 'POST /admin/realms/acme/organizations', body: '{"name":"Acme","alias":"acme","enabled":true}' },
      { call: 'POST /admin/realms/acme/organizations', body: '{"name":"Taken","alias":"taken","enabled":true}' },
    ]);
  });

  it('adds and removes a member by the id the realm gives the organisation, found by its alias on any page', async () => {
    await admin.addMember('acme', 'subject-ada');
    await admin.removeMember('acme', 'subject-ada');

    expect(asked.map((one) => one.call).filter((call) => !call.includes('token'))).toEqual([
      'GET /admin/realms/acme/organizations?briefRepresentation=true&first=0&max=100',
      'GET /admin/realms/acme/organizations?briefRepresentation=true&first=100&max=100',
      'POST /admin/realms/acme/organizations/org-acme/members',
      'GET /admin/realms/acme/organizations?briefRepresentation=true&first=0&max=100',
      'GET /admin/realms/acme/organizations?briefRepresentation=true&first=100&max=100',
      'DELETE /admin/realms/acme/organizations/org-acme/members/subject-ada',
    ]);
  });

  it('disables a user, with a token of the client credentials grant', async () => {
    await admin.disableAccount('subject-ada');

    expect(asked).toEqual([
      {
        call: 'POST /realms/acme/protocol/openid-connect/token',
        body: 'grant_type=client_credentials&client_id=admin&client_secret=secret',
      },
      { call: 'PUT /admin/realms/acme/users/subject-ada', body: '{"enabled":false}' },
    ]);
  });

  it('fails when the realm knows no organisation under the slug, or refuses a call', async () => {
    await expect(admin.addMember('unknown', 'subject-ada')).rejects.toThrow('no organization under the alias unknown');
    await expect(admin.disableAccount('refused')).rejects.toThrow('Keycloak answered 403 to PUT users/refused');
  });
});

/** The few answers of a realm these calls need. */
async function answer(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  const call = `${request.method ?? ''} ${request.url ?? ''}`;

  asked.push({ call, body: Buffer.concat(chunks).toString('utf8') });
  response.setHeader('content-type', 'application/json');

  if (call.endsWith('/token')) {
    response.end(JSON.stringify({ access_token: 'token-of-the-client' }));
  } else if (call.startsWith('GET') && call.includes('first=0&')) {
    // A full first page of other organizations, named like the one searched: Keycloak searches by name, never by alias.
    response.end(JSON.stringify(Array.from({ length: PAGE }, (_, index) => ({ id: `org-${index}`, name: 'acme', alias: `other-${index}` }))));
  } else if (call.startsWith('GET') && call.includes('first=100&')) {
    response.end(JSON.stringify([{ id: 'org-acme', name: 'Acme', alias: 'acme' }]));
  } else if (call.startsWith('GET')) {
    response.end('[]');
  } else {
    response.statusCode = statusOf(call);
    response.end();
  }
}

function statusOf(call: string): number {
  if (call.includes('/users/refused')) {
    return 403;
  }

  return call.startsWith('POST') && asked.some((one) => one.body.includes('"alias":"taken"')) ? 409 : 204;
}
