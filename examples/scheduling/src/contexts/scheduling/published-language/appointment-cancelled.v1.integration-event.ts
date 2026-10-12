import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { AppointmentCancelledV1Payload } from '@/contexts/scheduling/published-language/appointment-cancelled.v1.payload';

export const appointmentCancelledV1 = defineIntegrationEvent({
  type: 'scheduling.appointment.cancelled',
  version: 1,
  description:
    'An appointment was cancelled before taking place, by the patient or by the practice; its slot is free again. The reason given stays in scheduling.',
  payload: classSchema(AppointmentCancelledV1Payload),
});

export type AppointmentCancelledV1 = IntegrationEvent<AppointmentCancelledV1Payload>;
