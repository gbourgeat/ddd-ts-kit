import type { ActorAttribute } from './actor-attribute';
import type { ActorType } from './actor-type';
import type { KnownActorAttributes } from './known-actor-attributes';

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
