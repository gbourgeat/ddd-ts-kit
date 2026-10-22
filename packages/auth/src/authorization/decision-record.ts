import type { MessageInfo } from '@ddd-ts-kit/kernel';
import type { Decision } from './decision';
import type { ResourceRef } from './resource-ref';

/** What the audit hook receives, for an allowed decision as for a refused one. */
export interface DecisionRecord {
  readonly actorId: string;
  readonly permissionId: string;
  readonly resource?: ResourceRef;
  readonly decision: Decision;
  /** The command or query, when the decision was taken by the bus middleware. */
  readonly useCase?: string;
  /** Whether that use case changes state or answers; absent with `useCase`, for a decision taken outside a bus. */
  readonly kind?: MessageInfo['kind'];
}
