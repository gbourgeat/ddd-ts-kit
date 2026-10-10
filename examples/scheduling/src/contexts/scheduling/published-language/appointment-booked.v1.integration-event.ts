import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { AppointmentBookedV1Payload } from '#src/contexts/scheduling/published-language/appointment-booked.v1.payload.js';

export const appointmentBookedV1 = defineIntegrationEvent({
  type: 'scheduling.appointment.booked',
  version: 1,
  description:
    'A slot is now held for a patient: booked, or requested when the patient must still confirm before a deadline.',
  payload: classSchema(AppointmentBookedV1Payload),
});

export type AppointmentBookedV1 = IntegrationEvent<AppointmentBookedV1Payload>;
