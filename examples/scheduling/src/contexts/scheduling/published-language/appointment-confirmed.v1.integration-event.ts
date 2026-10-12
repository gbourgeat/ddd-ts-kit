import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { AppointmentConfirmedV1Payload } from '@/contexts/scheduling/published-language/appointment-confirmed.v1.payload';

export const appointmentConfirmedV1 = defineIntegrationEvent({
  type: 'scheduling.appointment.confirmed',
  version: 1,
  description: 'The patient confirmed a requested appointment: it will be honoured.',
  payload: classSchema(AppointmentConfirmedV1Payload),
});

export type AppointmentConfirmedV1 = IntegrationEvent<AppointmentConfirmedV1Payload>;
