import type { MessageInfo } from '@ddd-ts-kit/kernel';
import type { CheckRequest } from './check-request';
import type { Decision } from './decision';
import type { DecisionRecord } from './decision-record';

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
