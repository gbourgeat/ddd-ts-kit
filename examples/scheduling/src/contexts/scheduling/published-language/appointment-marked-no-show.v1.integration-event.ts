import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { AppointmentMarkedNoShowV1Payload } from '@/contexts/scheduling/published-language/appointment-marked-no-show.v1.payload';

export const appointmentMarkedNoShowV1 = defineIntegrationEvent({
  type: 'scheduling.appointment.marked-no-show',
  version: 1,
  description: 'The patient did not come to the appointment.',
  payload: classSchema(AppointmentMarkedNoShowV1Payload),
});

export type AppointmentMarkedNoShowV1 = IntegrationEvent<AppointmentMarkedNoShowV1Payload>;
