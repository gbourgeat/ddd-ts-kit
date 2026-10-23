import { z } from 'zod';
import type { Actor } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineForm, defineRoute, formRoutes, withFieldAccess, type FieldDecider, type RawRequest } from '../../src';

export const AppointmentKind = { consultation: 'consultation', followUp: 'follow-up' } as const;

const bookingBody = z.object({
  calendarId: z.string().min(1),
  appointmentTypeId: z.string(),
  kind: z.enum([AppointmentKind.consultation, AppointmentKind.followUp]),
  startsAt: z.iso.datetime(),
  reason: z.string().max(500).optional(),
  patient: z.object({ name: z.string(), phone: z.string().optional() }),
  tags: z.array(z.enum(['urgent', 'first-visit'])).optional(),
  internalNote: z.string().optional(),
});

type BookingBody = z.infer<typeof bookingBody>;

export const notes = { read: { id: 'scheduling:note.read' }, write: { id: 'scheduling:note.write' } };

const body = withFieldAccess(zodSchema(bookingBody), {
  internalNote: {
    read: { permission: notes.read },
    write: { permission: notes.write },
    subject: (values) => ({ type: 'calendar', id: values.calendarId }),
  },
});

const form = defineForm<BookingBody>({
  groups: [{ name: 'when', fields: ['startsAt', 'kind'] }],
  fields: {
    appointmentTypeId: { lookup: 'searchAppointmentTypes' },
    reason: {
      widget: 'textarea',
      visibleWhen: { field: 'kind', equals: AppointmentKind.consultation },
      requiredWhen: { field: 'kind', in: [AppointmentKind.consultation] },
    },
  },
});

export const book = defineRoute(
  {
    method: 'POST',
    path: '/appointments',
    operationId: 'bookAppointment',
    summary: 'Book appointment',
    tags: ['scheduling'],
    request: { body },
    responses: { 201: { description: 'Booked.' } },
    security: ['bearer'],
    form,
  },
  () => ({ status: 201 }),
);

export const types = defineRoute(
  {
    method: 'GET',
    path: '/appointment-types',
    operationId: 'searchAppointmentTypes',
    summary: 'Appointment types',
    responses: { 200: { description: 'ok' } },
    security: ['bearer'],
  },
  () => ({ status: 200 }),
);

/** What the relationships of the calendar `c-1` would answer: the practitioner reads and writes notes, the assistant reads them. */
const decide: FieldDecider = async ({ actor, requirement, subject }) => {
  const onCalendar = typeof subject === 'object' && subject !== null && 'id' in subject && subject.id === 'c-1';
  const allowed = { pia: [notes.read.id, notes.write.id], ana: [notes.read.id] }[actor.id] ?? [];

  return onCalendar && 'permission' in requirement && allowed.includes(requirement.permission.id);
};

export const [bookingForm] = formRoutes([book, types], { fieldAccess: decide });

/** A request for the form of booking, about the calendar `c-1` unless the query says otherwise. */
export function as(id: string | undefined, query: Record<string, string> = {}): RawRequest {
  const actor: Actor | undefined = id === undefined ? undefined : { id, type: 'user', roles: [], attributes: {} };

  return { params: {}, query: { calendarId: 'c-1', ...query }, headers: {}, body: undefined, raw: actor };
}
