import { createEventRegistry } from '@ddd-ts-kit/events';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

/** Every integration event the contexts declare: the audit trail records that each one occurred. `generate integration-event` adds to it. */
export const auditedEvents = createEventRegistry([
  // ddd-ts-kit:events
  // /ddd-ts-kit:events
]);
