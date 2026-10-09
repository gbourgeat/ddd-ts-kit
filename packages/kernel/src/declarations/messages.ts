import type { Actored } from '../application/actor.js';
import { Command, Query, type Message, type MessageInfo, type MessageType } from '../application/bus.js';
import type { AuditedFieldHint, PermissionRef, ResourcePointer } from './declaration.js';
import { DeclarationError, record } from './registry.js';

export interface PublicOptions<Fields extends string = never> {
  /**
   * The fields of the message that go into its audit entry, as plain data for an audit trail to
   * read: `audited: ['startsAt', { field: 'patientEmail', masked: true }]`. The compiler checks
   * that the message has them.
   */
  readonly audited?: readonly AuditedFieldHint<Fields>[];
}

export interface ProtectedOptions<M, Fields extends string = never> extends PublicOptions<Fields> {
  /** The element the message is about, when the right depends on it. */
  readonly resource?: (message: M) => ResourcePointer;
  /** Facts of the message the authorizer may need, such as the tenant it targets. */
  readonly context?: (message: M) => Readonly<Record<string, unknown>>;
}

/**
 * A class decorator of a command or a query, for both decorator modes of the compiler: the
 * standard (TC39) call hands it a context, the legacy `experimentalDecorators` call does not.
 */
export type MessageDeclarator<M extends Message> = (target: MessageType<M>, context?: ClassDecoratorContext) => void;

/**
 * Only an actor holding the permission reaches the handler. Accepted on a message that carries
 * its actor (`AuthorizedCommand`, `AuthorizedQuery`): a right is always somebody's.
 */
export function Requires<M extends Message & Actored = Message & Actored, const Fields extends string = never>(
  permission: PermissionRef,
  options: ProtectedOptions<M, Fields> = {},
): MessageDeclarator<M & Record<NoInfer<Fields>, unknown>> {
  return (target) => {
    record(target, {
      role: 'message',
      kind: kindOf(target),
      access: 'protected',
      permission,
      resourceOf: (message) => (message instanceof target ? options.resource?.(message) : undefined),
      contextOf: (message) => (message instanceof target ? options.context?.(message) : undefined),
      audited: options.audited ?? [],
    });
  };
}

/** Anybody reaches the handler, the anonymous caller included. Said, never implied. */
export function Public<const Fields extends string = never>(
  options: PublicOptions<Fields> = {},
): MessageDeclarator<Message & Record<NoInfer<Fields>, unknown>> {
  return (target) => {
    record(target, { role: 'message', kind: kindOf(target), access: 'public', audited: options.audited ?? [] });
  };
}

function kindOf(target: MessageType<Message>): MessageInfo['kind'] {
  const prototype: unknown = target.prototype;
  if (prototype instanceof Command) return 'command';
  if (prototype instanceof Query) return 'query';
  throw new DeclarationError(
    `${target.name} declares who may send it and is neither a Command nor a Query of the kernel.`,
  );
}
