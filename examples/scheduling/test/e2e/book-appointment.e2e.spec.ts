import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
import { eventually, expectProblem, expectStatus, type HttpClient } from '@ddd-ts-kit/testing/e2e';
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
import { openStaffedPractice } from '$test/e2e/support/open-staffed-practice';
import { registerPeople } from '$test/e2e/support/register-people';
import { slotStarting } from '$test/e2e/support/slot-starting';
import type { StaffedPractice } from '$test/e2e/support/staffed-practice';
import { startApplication, type RunningApplication } from '$test/e2e/support/start-application';

interface JsonForm {
  readonly schema: { readonly properties: Readonly<Record<string, { readonly readOnly?: boolean }>> };
  readonly uischema: unknown;
  readonly data: Readonly<Record<string, unknown>>;
}

interface AppointmentDetail {
  readonly id: string;
  readonly internalNote?: string;
}

const XML = 'application/xml';
const NOTE = 'Prefers the morning; hard of hearing on the left';

describe('Booking: in XML for a partner, and a form that differs by role around the internal note', () => {
  let application: RunningApplication;
  let practice: StaffedPractice;
  let paul: HttpClient;
  let practitioner: HttpClient;
  let assistant: HttpClient;
  const startsAt = slotStarting({ days: 9 });

  beforeAll(async () => {
    application = await startApplication();
  });

  afterAll(async () => {
    await application.close();
  });

  beforeEach(async () => {
    await application.reset();
    practice = await openStaffedPractice(application, meadow);
    await registerPeople(application, 'paul');
    paul = await application.as({ id: 'paul', roles: ['patient'] });
    practitioner = await application.as({ id: practice.practitionerId });
    assistant = await application.as({ id: practice.assistantId });
  });

  reportSeedOnFailure({ beforeEach, onTestFailed });

  it('takes a booking sent in XML, validated as the JSON one, and answers in XML', async () => {
    const booking = `<bookAppointment><calendarId>${practice.calendarId}</calendarId><appointmentTypeId>${practice.appointmentTypeId}</appointmentTypeId><startsAt>${startsAt.toISOString()}</startsAt></bookAppointment>`;
    const asXml = { headers: { 'content-type': XML, accept: XML } };

    const booked = expectStatus(await paul.post<string>('/appointments', booking, asXml), 201);
    const refused = await paul.post<string>('/appointments', '<bookAppointment><calendarId/></bookAppointment>', asXml);

    expect(booked.body).toMatch(/<bookAppointment [^>]*><id>[^<]+<\/id><\/bookAppointment>$/);
    expect(refused.status).toBe(422);
    expect(refused.headers['content-type']).toBe('application/problem+xml; charset=utf-8');
  });

  it('describes the booking form for each role: hidden from the patient, read-only for the assistant, editable by the practitioner', async () => {
    await deskDelegatedToTheAssistant();

    const formOfTheCalendar = `/forms/bookAppointment?calendarId=${practice.calendarId}`;

    const ofPaul = expectStatus(await paul.get<JsonForm>(formOfTheCalendar), 200).body;
    const ofTheAssistant = expectStatus(await assistant.get<JsonForm>(formOfTheCalendar), 200).body;
    const ofThePractitioner = expectStatus(await practitioner.get<JsonForm>(formOfTheCalendar), 200).body;

    expect(ofPaul.schema.properties).not.toHaveProperty('internalNote');
    expect(JSON.stringify(ofPaul.uischema)).not.toContain('internalNote');
    expect(ofTheAssistant.schema.properties['internalNote']).toMatchObject({ readOnly: true });
    expect(ofThePractitioner.schema.properties['internalNote']).toBeDefined();
    expect(ofThePractitioner.schema.properties['internalNote']?.readOnly).toBeUndefined();
    expect(ofThePractitioner.data).toEqual({ calendarId: practice.calendarId });
  });

  it('refuses the form to whoever may not book what it would describe: a patient for somebody else, an assistant without the desk', async () => {
    const formOfTheCalendar = `/forms/bookAppointment?calendarId=${practice.calendarId}`;
    const forSomebodyElse = await paul.get(`${formOfTheCalendar}&patientId=rosa`);
    const withoutTheDesk = await assistant.get(formOfTheCalendar);

    expect([forSomebodyElse.status, withoutTheDesk.status]).toEqual([403, 403]);
  });

  /** The practitioner hands their desk to the assistant, who may then book on it, and still not write a note. */
  async function deskDelegatedToTheAssistant(): Promise<void> {
    const delegations = `/practices/${practice.practiceId}/desks/${practice.practitionerId}/delegations`;
    const terms = { assistantId: practice.assistantId, availabilityIncluded: false };

    expectStatus(await practitioner.post(delegations, terms), 201);
  }

  it('describes the same form as a tree of blocks, and refuses it to whoever presents no credential', async () => {
    await deskDelegatedToTheAssistant();

    const blocks = expectStatus(
      await assistant.get<{ type: string; blocks: unknown[] }>(
        `/forms/bookAppointment?format=blocks&calendarId=${practice.calendarId}`,
      ),
      200,
    ).body;

    expect(blocks.type).toBe('form');
    expect(JSON.stringify(blocks.blocks)).toContain('"name":"internalNote","label":"bookAppointment.internalNote"');
    expect((await application.client.get('/forms/bookAppointment')).status).toBe(401);
  });

  it('keeps the internal note to the staff: written by the practitioner, refused from the patient, hidden from the patient', async () => {
    const booking = {
      calendarId: practice.calendarId,
      appointmentTypeId: practice.appointmentTypeId,
      startsAt: startsAt.toISOString(),
    };

    const refused = await paul.post('/appointments', { ...booking, internalNote: NOTE });

    const appointmentId = expectStatus(
      await practitioner.post<{ id: string }>('/appointments', { ...booking, patientId: 'paul', internalNote: NOTE }),
      201,
    ).body.id;

    const forTheStaff = await eventually(async () => {
      const detail = expectStatus(await practitioner.get<AppointmentDetail>(`/appointments/${appointmentId}`), 200);

      expect(detail.body.internalNote).toBe(NOTE);

      return detail;
    });

    const forPaul = expectStatus(await paul.get<AppointmentDetail>(`/appointments/${appointmentId}`), 200);

    expectProblem(refused, { status: 403, code: 'FORBIDDEN' });
    expect(forTheStaff.body.id).toBe(appointmentId);
    expect(forPaul.body).not.toHaveProperty('internalNote');
  });
});

const meadow = { name: 'Meadow', managerId: 'mary', practitionerId: 'pierre', assistantId: 'anna' };
