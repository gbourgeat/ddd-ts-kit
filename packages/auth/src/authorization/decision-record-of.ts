import type { MessageInfo } from '@ddd-ts-kit/kernel';
import type { CheckRequest } from './check-request.js';
import type { Decision } from './decision.js';
import type { DecisionRecord } from './decision-record.js';

/** `info` is the message the bus is handling, for a decision taken by the bus middleware. */
export function decisionRecordOf(request: CheckRequest, decision: Decision, info?: MessageInfo): DecisionRecord {
  return {
    actorId: request.actor.id,
    permissionId: request.permission.id,
    ...(request.resource === undefined ? {} : { resource: request.resource }),
    decision,
    ...(info === undefined ? {} : { useCase: info.name, kind: info.kind }),
  };
}
