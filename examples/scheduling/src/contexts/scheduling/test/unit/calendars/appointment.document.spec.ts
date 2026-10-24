import { describe, expect, it } from 'vitest';
import { Cancellation } from '@/contexts/scheduling/calendars/domain/value-objects/cancellation.vo';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';
import { anAttachedDocument } from '@/contexts/scheduling/test/builders/attached-document.builder';

const NOW = new Date('2026-03-02T09:10:00.000Z');
const LATER = new Date('2026-03-02T09:20:00.000Z');
const FIRST = 'appointment-documents/2026/03/document-1';
const SECOND = 'appointment-documents/2026/03/document-2';

describe('The document of an appointment', () => {
  it('is attached in place of the one it held, which is answered to be deleted, and announces nothing', () => {
    const appointment = anAppointment().build();

    appointment.pullEvents();

    expect(appointment.attachDocument(anAttachedDocument(FIRST), NOW)).toBeUndefined();
    expect(appointment.attachDocument(anAttachedDocument(SECOND), NOW)?.key).toBe(FIRST);
    expect([appointment.document?.file.key, appointment.changedAt]).toEqual([SECOND, NOW]);
    expect(appointment.pullEvents()).toEqual([]);
  });

  it('is removed, answering its file, and cannot be removed twice', () => {
    const appointment = anAppointment().build();

    appointment.attachDocument(anAttachedDocument(FIRST), NOW);

    expect(appointment.removeDocument(LATER).key).toBe(FIRST);
    expect(appointment.document).toBeUndefined();
    expect(() => appointment.removeDocument(LATER)).toThrow(expect.objectContaining({ code: 'NO_DOCUMENT' }));
  });

  it('leaves the appointment as it was once removed, the removal being its latest change', () => {
    const appointment = anAppointment().forPatient('patient-7').build();

    appointment.attachDocument(anAttachedDocument(FIRST), NOW);
    appointment.removeDocument(LATER);

    expect([appointment.status, appointment.patientId, appointment.changedAt]).toEqual(['booked', 'patient-7', LATER]);
  });

  it('stays with the appointment through every change of status, and may be attached once it has ended', () => {
    const confirmed = anAppointment().requestedUntil(new Date('2026-03-01T12:00:00.000Z')).build();
    const cancelled = anAppointment().build();

    confirmed.attachDocument(anAttachedDocument(FIRST), NOW);
    confirmed.confirm(NOW);
    cancelled.cancel(Cancellation.create('patient'), NOW);
    cancelled.attachDocument(anAttachedDocument(SECOND), NOW);

    expect([confirmed.status, confirmed.document?.file.key]).toEqual(['booked', FIRST]);
    expect([cancelled.status, cancelled.document?.file.key]).toEqual(['cancelled', SECOND]);
  });
});
