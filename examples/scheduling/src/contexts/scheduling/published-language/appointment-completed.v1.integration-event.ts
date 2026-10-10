import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { AppointmentCompletedV1Payload } from './appointment-completed.v1.payload.js';

export const appointmentCompletedV1 = defineIntegrationEvent({
  type: 'scheduling.appointment.completed',
  version: 1,
  description: 'The appointment took place.',
  payload: classSchema(AppointmentCompletedV1Payload),
});

export type AppointmentCompletedV1 = IntegrationEvent<AppointmentCompletedV1Payload>;
