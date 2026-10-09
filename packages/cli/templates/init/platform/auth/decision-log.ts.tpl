import type { OnDecision } from '@ddd-ts-kit/auth';
import type { Logger } from '@ddd-ts-kit/kernel';

/**
 * Without the audit trail (`stack.audit` is off), every authorization decision still leaves one
 * log entry: identifiers and codes only, never data. A log is sampled, rotated and lost; turn the
 * audit trail on for what an auditor must be able to rely on.
 */
export function logDecisions(logger: Logger): OnDecision {
  return (record) => {
    const { decision, resource } = record;
    const fields = {
      actorId: record.actorId,
      permissionId: record.permissionId,
      allowed: decision.allowed,
      ...(decision.allowed ? {} : { reason: decision.reason }),
      ...(resource === undefined ? {} : { resourceType: resource.type, resourceId: resource.id }),
      ...(record.useCase === undefined ? {} : { useCase: record.useCase }),
    };
    if (decision.allowed) logger.info('authorization decision', fields);
    else logger.warn('authorization decision', fields);
  };
}
