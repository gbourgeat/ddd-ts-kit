import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { CalendarCreatedV1Payload } from '@/contexts/scheduling/published-language/calendar-created.v1.payload.js';

export const calendarCreatedV1 = defineIntegrationEvent({
  type: 'scheduling.calendar.created',
  version: 1,
  description: 'A practitioner has a new calendar in a practice, in the time zone of that practice.',
  payload: classSchema(CalendarCreatedV1Payload),
});

export type CalendarCreatedV1 = IntegrationEvent<CalendarCreatedV1Payload>;
