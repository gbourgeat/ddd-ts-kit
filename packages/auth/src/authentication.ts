import { anonymousActor, isActor, type Actor, type ActorContext } from '@ddd-ts-kit/kernel';
import { InvalidCredentialError } from './errors.js';

/**
 * Who is calling. A platform concern at the boundary: an adapter verifies the credential and
 * produces an actor. Answers the anonymous actor when there is no credential, and raises
 * `InvalidCredentialError` when one is presented and not acceptable.
 */
export interface Authenticator {
  authenticate(credential: string | undefined): Promise<Actor>;
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
 * actor, which routes then read with `actorOf(context.principal)`.
 */
export function principalResolver(authenticator: Authenticator): (raw: unknown) => Promise<Actor> {
  return (raw) => authenticator.authenticate(bearerCredential(headersOf(raw)));
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

/** The actor a boundary received as `principal`, anonymous when there is none. */
export function actorOf(principal: unknown): Actor {
  return isActor(principal) ? principal : anonymousActor();
}

interface WithPrincipal {
  readonly context: { readonly principal?: unknown };
}

/**
 * Wraps a route handler so that everything it calls sees the actor through `ActorContext`:
 * repositories stamping audit columns, tenant scoping. Use cases still get it in the message.
 */
export function inActorContext<Input extends WithPrincipal, Output>(
  actorContext: ActorContext,
  handle: (input: Input) => Output,
): (input: Input) => Output {
  return (input) => actorContext.run(actorOf(input.context.principal), () => handle(input));
}
