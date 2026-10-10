import { createEventRegistry } from '@ddd-ts-kit/events';
// ddd-ts-kit:imports
import {
  calendarCreatedV1,
  appointmentBookedV1,
  appointmentConfirmedV1,
  appointmentRescheduledV1,
  appointmentCancelledV1,
  appointmentExpiredV1,
  appointmentCompletedV1,
  appointmentMarkedNoShowV1,
} from '../../contexts/scheduling/published-language/index.js';
import {
  personRegisteredV1,
  practiceOpenedV1,
  practiceMemberAddedV1,
  practiceMemberRemovedV1,
  delegationGrantedV1,
  delegationRevokedV1,
} from '../../contexts/identity/published-language/index.js';
// /ddd-ts-kit:imports

/** Every integration event the contexts declare: the audit trail records that each one occurred. `generate integration-event` adds to it. */
export const auditedEvents = createEventRegistry([
  // ddd-ts-kit:events
  calendarCreatedV1,
  personRegisteredV1,
  practiceOpenedV1,
  practiceMemberAddedV1,
  practiceMemberRemovedV1,
  delegationGrantedV1,
  delegationRevokedV1,
  appointmentBookedV1,
  appointmentConfirmedV1,
  appointmentRescheduledV1,
  appointmentCancelledV1,
  appointmentExpiredV1,
  appointmentCompletedV1,
  appointmentMarkedNoShowV1,
  // /ddd-ts-kit:events
]);
