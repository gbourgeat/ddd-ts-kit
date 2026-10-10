import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { DelegationGrantedV1Payload } from './delegation-granted.v1.payload.js';

export const delegationGrantedV1 = defineIntegrationEvent({
  type: 'identity.delegation.granted',
  version: 1,
  description: 'A practitioner let an assistant of the same practice manage their calendars, with or without their availability, until an optional end.',
  payload: classSchema(DelegationGrantedV1Payload),
});

export type DelegationGrantedV1 = IntegrationEvent<DelegationGrantedV1Payload>;
