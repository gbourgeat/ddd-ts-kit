import {
  anonymousSession,
  isActor,
  isAnonymous,
  isSession,
  type Actor,
  type ActorContext,
  type Session,
} from '@ddd-ts-kit/kernel';
import { InvalidCredentialError } from './errors.js';

/**
 * Who is calling. A platform concern at the boundary: an adapter verifies the credential and
 * produces an actor. Answers the anonymous actor when there is no credential, and raises
 * `InvalidCredentialError` when one is presented and not acceptable.
 */
export interface Authenticator {
  authenticate(credential: string | undefined): Promise<Actor>;
}

/**
 * An authenticator that also knows the session the credential stands for: since when, until
 * when, how it was authenticated, on whose behalf. Answers the anonymous session without
 * credential. `resolveSession` works with either port, so an adapter implements this one only
 * when its credential carries that knowledge.
 */
export interface SessionAuthenticator extends Authenticator {
  authenticateSession(credential: string | undefined): Promise<Session>;
}

/**
 * The session of a credential, whatever the authenticator: its own when it is a
 * `SessionAuthenticator`, otherwise one derived from the actor (see `sessionOf`).
 */
export async function resolveSession(
  authenticator: Authenticator | SessionAuthenticator,
  credential: string | undefined,
): Promise<Session> {
  if ('authenticateSession' in authenticator) return authenticator.authenticateSession(credential);
  return sessionOf(await authenticator.authenticate(credential));
}

export type HeaderValues = Readonly<Record<string, string | readonly string[] | undefined>>;

const BEARER = /^Bearer +([A-Za-z0-9._~+/-]+=*)$/i;

/**
 * The token of `Authorization: Bearer <token>`, or `undefined` without the header. A header
 * that is there and is not a well-formed bearer credential is refused, never ignored.
 */
export function bearerCredential(headers: HeaderValues): string | undefined {
  const name = Object.keys(headers).find((header) => header.toLowerCase() === 'authorization');
  const value = name === undefined ? undefined : headers[name];
  if (value === undefined) return undefined;
  const token = typeof value === 'string' ? BEARER.exec(value)?.[1] : undefined;
  if (token === undefined) throw new InvalidCredentialError('MALFORMED_AUTHORIZATION_HEADER');
  return token;
}

/**
 * The `resolvePrincipal` option of @ddd-ts-kit/http: takes the framework request, answers the
 * session. The pipeline puts it, with its actor, in the execution context of the request;
 * routes read `actorOf(context.principal)` and `sessionOf(context)`.
 */
export function principalResolver(
  authenticator: Authenticator | SessionAuthenticator,
): (raw: unknown) => Promise<Session> {
  return (raw) => resolveSession(authenticator, bearerCredential(headersOf(raw)));
}

function headersOf(raw: unknown): HeaderValues {
  if (typeof raw !== 'object' || raw === null || !('headers' in raw)) return {};
  const { headers } = raw;
  if (typeof headers !== 'object' || headers === null) return {};
  return Object.fromEntries(Object.entries(headers).filter(isHeader));
}

function isHeader(entry: [string, unknown]): entry is [string, string | readonly string[]] {
  const [, value] = entry;
  return typeof value === 'string' || (Array.isArray(value) && value.every((item) => typeof item === 'string'));
}

/**
 * The actor a boundary received, anonymous when there is none. Takes the principal (a session
 * or an actor) or the request context that holds it.
 */
export function actorOf(source: unknown): Actor {
  return sessionOf(source).actor;
}

const NEVER_ISSUED = new Date(0);

/**
 * The session a boundary received, anonymous when there is none. Takes the request context
 * (`sessionOf(context)`), or a principal: a session is answered as it is, and an actor alone
 * gets a session that says only what is known, its id as session id, no issue instant, no
 * expiry, authenticated by `token`.
 */
export function sessionOf(source: unknown): Session {
  if (isSession(source)) return source;
  if (isActor(source)) return sessionOfActor(source);
  return hasPrincipal(source) ? sessionOf(source.principal) : anonymousSession();
}

function sessionOfActor(actor: Actor): Session {
  if (isAnonymous(actor)) return anonymousSession();
  return { id: actor.id, actor, issuedAt: NEVER_ISSUED, authenticationMethod: 'token', extensions: {} };
}

function hasPrincipal(source: unknown): source is { readonly principal: unknown } {
  return typeof source === 'object' && source !== null && 'principal' in source;
}

interface WithPrincipal {
  readonly context: { readonly principal?: unknown };
}

/**
 * Wraps a route handler so that everything it calls sees the actor through `ActorContext`:
 * repositories stamping audit columns, tenant scoping. Use cases still get it in the message.
 * Not needed when the adapter of @ddd-ts-kit/http is given an `executionScope` and the actor
 * context is a `ScopedActorContext` over it, as `kernelModule()` binds them.
 */
export function inActorContext<Input extends WithPrincipal, Output>(
  actorContext: ActorContext,
  handle: (input: Input) => Output,
): (input: Input) => Output {
  return (input) => actorContext.run(actorOf(input.context.principal), () => handle(input));
}
