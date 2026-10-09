import { anonymousActor, isActor, systemActor, type Actor } from './actor.js';

/** The standard methods come first; any other string names a method of the project. */
export type AuthenticationMethod =
  | 'none'
  | 'password'
  | 'sso'
  | 'token'
  | 'api-key'
  | 'service'
  | (string & Record<never, never>);

export interface AuthenticationStrength {
  /** True when a second factor was verified for this session. */
  readonly mfa?: boolean;
  /** An assurance level in the vocabulary of the identity provider, for example `aal2`. */
  readonly assuranceLevel?: string;
}

/** Where the session is used from. Opaque strings: never parsed, never trusted. */
export interface SessionClient {
  readonly ip?: string;
  readonly userAgent?: string;
}

/**
 * What a project adds to every session, by declaration merging:
 *
 *     declare module '@ddd-ts-kit/kernel' {
 *       interface SessionExtensions { readonly plan: 'free' | 'team' }
 *     }
 */
export interface SessionExtensions {}

/** The extensions as a session carries them: each one optional. */
export type SessionExtensionValues = {
  readonly [Key in keyof SessionExtensions]?: SessionExtensions[Key];
};

/**
 * The authenticated session of an actor, as plain data: never the credential it came from.
 * Project fields live under `extensions`, so a standard field added later cannot collide with
 * them. They are all optional when read: the anonymous and system sessions carry none.
 */
export interface Session {
  readonly id: string;
  readonly actor: Actor;
  readonly issuedAt: Date;
  readonly expiresAt?: Date;
  readonly authenticationMethod: AuthenticationMethod;
  readonly authenticationStrength?: AuthenticationStrength;
  /** Id of the actor acting as `actor`, for support staff. Audit must record it. */
  readonly impersonatedBy?: string;
  /** BCP 47 language tag, for example `fr-FR`. */
  readonly locale?: string;
  /** IANA time zone, for example `Europe/Paris`. */
  readonly timeZone?: string;
  readonly client?: SessionClient;
  readonly extensions: SessionExtensionValues;
}

const NEVER_ISSUED = new Date(0);

const ANONYMOUS_SESSION: Session = Object.freeze({
  id: 'anonymous',
  actor: anonymousActor(),
  issuedAt: NEVER_ISSUED,
  authenticationMethod: 'none',
  extensions: Object.freeze({}),
});

/** The session of a caller that presented no credential. It never expires. */
export function anonymousSession(): Session {
  return ANONYMOUS_SESSION;
}

/** The session of the system acting on its own behalf: a scheduled job, a consumer. */
export function systemSession(name: string, issuedAt: Date = NEVER_ISSUED): Session {
  const actor = systemActor(name);
  return Object.freeze({
    id: actor.id,
    actor,
    issuedAt,
    authenticationMethod: 'service',
    extensions: Object.freeze({}),
  });
}

/** A session without `expiresAt` never expires; one expires at the instant it names. */
export function isExpired(session: Session, now: Date): boolean {
  return session.expiresAt !== undefined && session.expiresAt.getTime() <= now.getTime();
}

export function isImpersonated(session: Session): boolean {
  return session.impersonatedBy !== undefined;
}

type SessionKeys = Record<'id' | 'actor' | 'issuedAt' | 'authenticationMethod' | 'extensions', unknown>;

/** Structural: what a boundary received as a principal is a session when it has its shape. */
export function isSession(value: unknown): value is Session {
  return (
    hasSessionKeys(value) &&
    typeof value.id === 'string' &&
    isActor(value.actor) &&
    value.issuedAt instanceof Date &&
    typeof value.authenticationMethod === 'string' &&
    typeof value.extensions === 'object' &&
    value.extensions !== null
  );
}

function hasSessionKeys(value: unknown): value is SessionKeys {
  if (typeof value !== 'object' || value === null) return false;
  return ['id', 'actor', 'issuedAt', 'authenticationMethod', 'extensions'].every((key) => key in value);
}
