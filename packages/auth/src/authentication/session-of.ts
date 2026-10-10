import { anonymousSession, isActor, isAnonymous, isSession, type Actor, type Session } from '@ddd-ts-kit/kernel';

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
