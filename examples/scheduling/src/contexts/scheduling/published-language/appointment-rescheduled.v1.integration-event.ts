import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { AppointmentRescheduledV1Payload } from './appointment-rescheduled.v1.payload.js';

export const appointmentRescheduledV1 = defineIntegrationEvent({
  type: 'scheduling.appointment.rescheduled',
  version: 1,
  description:
    'An appointment moved to another slot of the same calendar, in one step; the previous slot is free again.',
  payload: classSchema(AppointmentRescheduledV1Payload),
});

export type AppointmentRescheduledV1 = IntegrationEvent<AppointmentRescheduledV1Payload>;
