// Real tokens from the local Keycloak of docker compose. The password of a demo user is its user
// name: local development only.
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { URL, URLSearchParams } from 'node:url';

const keycloak =
  (process.env.KEYCLOAK_URL ?? 'http://127.0.0.1:54080') + '/realms/' + (process.env.KEYCLOAK_REALM ?? 'scheduling');
const admin = keycloak.replace('/realms/', '/admin/realms/');
const client = 'scheduling-local';
const callback = 'http://127.0.0.1/callback';

/** The direct grant of the local client: a user name and a password for a token. */
export async function signIn(username) {
  return personOf(await tokenFor({ grant_type: 'password', client_id: client, username, password: username }));
}

/**
 * What support staff do from the admin console, scripted: the impersonation endpoint opens a
 * session of the user, and the standard flow turns that session into a token. The token is the
 * user's; the realm writes who impersonates in the claim `impersonator_id`.
 */
export async function impersonate(supportUsername, userId) {
  const support = await signIn(supportUsername);
  const session = await globalThis.fetch(`${admin}/users/${userId}/impersonation`, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + support.token },
  });
  const cookies = session.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
  const authorize = await globalThis.fetch(
    `${keycloak}/protocol/openid-connect/auth?client_id=${client}&response_type=code&scope=openid&redirect_uri=${encodeURIComponent(callback)}`,
    { headers: { cookie: cookies }, redirect: 'manual' },
  );
  const code = new URL(authorize.headers.get('location') ?? callback).searchParams.get('code');

  return personOf(
    await tokenFor({ grant_type: 'authorization_code', client_id: client, code: code ?? '', redirect_uri: callback }),
  );
}

async function tokenFor(form) {
  const response = await globalThis.fetch(keycloak + '/protocol/openid-connect/token', {
    method: 'POST',
    body: new URLSearchParams(form),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error('Keycloak refused the grant ' + form.grant_type + ': ' + body.error);
  }

  return body.access_token;
}

function personOf(token) {
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));

  return {
    token,
    id: claims.sub,
    displayName: claims.given_name ?? claims.preferred_username,
    roles: claims.realm_access?.roles ?? [],
    impersonatedBy: claims.impersonator_id,
  };
}
