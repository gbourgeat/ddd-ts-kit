import type { OnDecision } from '@ddd-ts-kit/auth';

/** The audit trail of authorization: one structured line per decision, identifiers and codes only, never data. */
export const auditDecision: OnDecision = (record) => {
  const { decision, resource } = record;
  const entry = {
    level: decision.allowed ? 'info' : 'warn',
    message: 'authorization decision',
    actorId: record.actorId,
    permissionId: record.permissionId,
    allowed: decision.allowed,
    ...(decision.allowed ? {} : { reason: decision.reason }),
    ...(resource === undefined ? {} : { resourceType: resource.type, resourceId: resource.id }),
    ...(record.useCase === undefined ? {} : { useCase: record.useCase }),
  };
  console.log(JSON.stringify(entry));
};
