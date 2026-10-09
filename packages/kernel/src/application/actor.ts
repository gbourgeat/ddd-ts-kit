import { Command, Query } from './bus.js';

export type ActorType = 'user' | 'service' | 'system' | 'anonymous';

export type ActorAttribute = string | number | boolean | readonly string[];

/**
 * Who acts: the outcome of authentication, as plain data. It never holds the credential it
 * was derived from, so it can travel in a command, a log line or a queue message.
 */
export interface Actor {
  readonly id: string;
  readonly type: ActorType;
  readonly tenantId?: string;
  readonly roles: readonly string[];
  readonly attributes: Readonly<Record<string, ActorAttribute>> & KnownActorAttributes;
}

/**
 * The attributes a project gives a name and a type to, by declaration merging. They stay in
 * the `attributes` bag, where authorizers already read them, and are optional when read: the
 * anonymous and system actors carry none.
 *
 *     declare module '@ddd-ts-kit/kernel' {
 *       interface ActorExtensions { readonly department: string }
 *     }
 */
export interface ActorExtensions {}

/** An extension whose type is not an `ActorAttribute` reads as `never`: it could not be serialized. */
export type KnownActorAttributes = {
  readonly [Key in keyof ActorExtensions]?: ActorExtensions[Key] extends ActorAttribute
    ? ActorExtensions[Key]
    : never;
};

const ANONYMOUS: Actor = Object.freeze({
  id: 'anonymous',
  type: 'anonymous',
  roles: Object.freeze([]),
  attributes: Object.freeze({}),
});

/** The caller that presented no credential. */
export function anonymousActor(): Actor {
  return ANONYMOUS;
}

/** The system acting on its own behalf: a scheduled job, a consumer, a migration. */
export function systemActor(name: string): Actor {
  return Object.freeze({
    id: `system:${name}`,
    type: 'system',
    roles: Object.freeze([]),
    attributes: Object.freeze({}),
  });
}

export function isAnonymous(actor: Actor): boolean {
  return actor.type === 'anonymous';
}

export function isAuthenticated(actor: Actor): boolean {
  return actor.type !== 'anonymous';
}

export function isSystem(actor: Actor): boolean {
  return actor.type === 'system';
}

const ACTOR_TYPES: readonly string[] = ['user', 'service', 'system', 'anonymous'];

export function isActor(value: unknown): value is Actor {
  return (
    hasActorKeys(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    ACTOR_TYPES.includes(value.type) &&
    Array.isArray(value.roles) &&
    typeof value.attributes === 'object' &&
    value.attributes !== null
  );
}

type ActorKeys = Record<'id' | 'type' | 'roles' | 'attributes', unknown>;

function hasActorKeys(value: unknown): value is ActorKeys {
  if (typeof value !== 'object' || value === null) return false;
  return 'id' in value && 'type' in value && 'roles' in value && 'attributes' in value;
}

/** What a protected use case carries: the actor is data of the message, never ambient state. */
export interface Actored {
  readonly actor: Actor;
}

export function isActored(value: unknown): value is Actored {
  return typeof value === 'object' && value !== null && 'actor' in value && isActor(value.actor);
}

/**
 * A command that somebody must be allowed to send. The actor is the first constructor
 * argument, so a call site cannot forget it; `Command` stays for public use cases.
 */
export abstract class AuthorizedCommand<R = void> extends Command<R> implements Actored {
  constructor(readonly actor: Actor) {
    super();
  }
}

/** A question that somebody must be allowed to ask. */
export abstract class AuthorizedQuery<R> extends Query<R> implements Actored {
  constructor(readonly actor: Actor) {
    super();
  }
}

/**
 * The actor of the request or message being processed, for infrastructure that is not handed
 * it: audit columns, tenant scoping of every statement. Set once at the boundary with `run`.
 * Handlers and the domain take the actor from the command or query instead.
 */
export interface ActorContext {
  current(): Actor | undefined;
  /** Throws `NoCurrentActorError` outside of `run`. */
  require(): Actor;
  run<T>(actor: Actor, work: () => T): T;
}

/** A boundary forgot `ActorContext.run`: a wiring mistake, never a business failure. */
export class NoCurrentActorError extends Error {
  constructor() {
    super('No current actor: the boundary (route, consumer, job) must call ActorContext.run');
    this.name = 'NoCurrentActorError';
  }
}
