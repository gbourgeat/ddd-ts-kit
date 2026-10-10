import type { Message, MessageType } from '@ddd-ts-kit/kernel';
import type { AuditProjection } from './audit-projection.js';
import type { AuditedMessage } from './audited-message.js';

/**
 * The same declaration for a message whose audited values are not its own fields: the
 * projector picks them, and names the ones to mask.
 * `auditedProjection(ExportCommand, (command) => ({ plain: { format: command.options.format } }))`.
 */
export function auditedProjection<M extends Message>(
  type: MessageType<M>,
  project: (message: M) => AuditProjection,
): AuditedMessage {
  return { type, masks: false, project: (message) => (message instanceof type ? project(message) : {}) };
}
