import type { ResourceRef } from '@ddd-ts-kit/auth';
import { Appointment } from '@/contexts/scheduling/calendars/domain/aggregates/appointment.aggregate';

/**
 * How an element a handler hands to `Access.authorize` is named in the relationship schema. A
 * plain `{ type, id }` is already a reference; an aggregate is named here, so that the handlers
 * and the policies speak of the appointment and only the platform knows the model.
 */
export function resourceOf(subject: unknown): ResourceRef | undefined {
  if (subject instanceof Appointment) {
    return { type: 'appointment', id: subject.id };
  }

  return isReference(subject) ? { type: subject.type, id: subject.id } : undefined;
}

function isReference(subject: unknown): subject is ResourceRef {
  return (
    typeof subject === 'object' &&
    subject !== null &&
    'type' in subject &&
    'id' in subject &&
    typeof subject.type === 'string' &&
    typeof subject.id === 'string'
  );
}
