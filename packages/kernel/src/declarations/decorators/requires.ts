import type { Actored } from '../../application/actor/actored';
import type { Message } from '../../application/messaging/message';
import type { PermissionRef } from '../model/permission-ref';
import type { ResourcePointer } from '../model/resource-pointer';
import { record } from '../registry/record';
import { kindOf } from './kind-of';
import type { MessageDeclarator } from './message-declarator';
import type { PublicOptions } from './public';

export interface ProtectedOptions<M, Fields extends string = never> extends PublicOptions<Fields> {
  /** The element the message is about, when the right depends on it. */
  readonly resource?: (message: M) => ResourcePointer;
  /** Facts of the message the authorizer may need, such as the tenant it targets. */
  readonly context?: (message: M) => Readonly<Record<string, unknown>>;
}

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
