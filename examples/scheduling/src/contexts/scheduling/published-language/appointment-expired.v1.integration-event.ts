import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { AppointmentExpiredV1Payload } from './appointment-expired.v1.payload.js';

export const appointmentExpiredV1 = defineIntegrationEvent({
  type: 'scheduling.appointment.expired',
  version: 1,
  description: 'A requested appointment was not confirmed in time; its slot is free again.',
  payload: classSchema(AppointmentExpiredV1Payload),
});

export type AppointmentExpiredV1 = IntegrationEvent<AppointmentExpiredV1Payload>;
