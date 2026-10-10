import type { AuditTrail } from '@ddd-ts-kit/kernel';
import type { AllowedReads } from './allowed-reads.js';
import { auditRecordOf } from './audit-record-of.js';
import type { AuditSource } from './audit-source.js';
import type { AuthorizationDecision } from './authorization-decision.js';

export interface AuditDecisionsOptions extends AuditSource {
  /** Says that a decision concerns a read. Default: its `kind` is `query`, as the bus that carried it says. */
  readonly isRead?: (decision: AuthorizationDecision) => boolean;

  /** Ids of the permissions whose allowed reads are always recorded. */
  readonly sensitivePermissions?: readonly string[];

  /** Default `sensitive`. */
  readonly allowedReads?: AllowedReads;
}

/**
 * The `onDecision` hook of the authorization middleware. A refusal is always recorded, and so
 * is an allowed decision about anything that is not a read. An allowed read is recorded when
 * its permission is sensitive: recording every list and every page view drowns the trail.
 */
export function auditDecisions(
  trail: AuditTrail,
  options: AuditDecisionsOptions,
): (decision: AuthorizationDecision) => Promise<void> {
  return async (decision) => {
    if (!isRecorded(decision, options)) return;

    const record = auditRecordOf(options, {
      category: 'authorization',
      action: decision.permissionId,
      outcome: decision.decision.allowed ? 'allowed' : 'denied',
      ...(decision.decision.allowed ? {} : { reason: decision.decision.reason }),
      ...(decision.resource === undefined ? {} : { resource: decision.resource }),
      ...contextOf(decision.permissionId),
    });

    const itself = record.actor.id === decision.actorId;

    await trail.record(itself ? record : { ...record, actor: { id: decision.actorId, type: 'unknown' } });
  };
}

function isRecorded(decision: AuthorizationDecision, options: AuditDecisionsOptions): boolean {
  if (!decision.decision.allowed) return true;

  if (!(options.isRead ?? isAboutAQuery)(decision)) return true;

  if (options.sensitivePermissions?.includes(decision.permissionId) === true) return true;

  const allowedReads = options.allowedReads ?? 'sensitive';

  if (typeof allowedReads === 'string') return allowedReads === 'all';

  return (allowedReads.random ?? Math.random)() < allowedReads.sample;
}

function isAboutAQuery(decision: AuthorizationDecision): boolean {
  return decision.kind === 'query';
}

/** A permission id is `<context>:<name>`. */
function contextOf(permissionId: string): { readonly context?: string } {
  const separator = permissionId.indexOf(':');

  return separator > 0 ? { context: permissionId.slice(0, separator) } : {};
}
