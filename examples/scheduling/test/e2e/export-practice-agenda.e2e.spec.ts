import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
import { eventually, expectProblem, expectStatus, type HttpClient } from '@ddd-ts-kit/testing/e2e';
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
import { bookAppointment } from '$test/e2e/support/book-appointment';
import { openStaffedPractice } from '$test/e2e/support/open-staffed-practice';
import { registerPeople } from '$test/e2e/support/register-people';
import { slotStarting } from '$test/e2e/support/slot-starting';
import type { StaffedPractice } from '$test/e2e/support/staffed-practice';
import { startApplication, type RunningApplication } from '$test/e2e/support/start-application';

const XML = 'application/xml';
const CSV = 'text/csv';

describe('The agenda of a practice, exported as CSV and answered in XML to a partner', () => {
  let application: RunningApplication;
  let practice: StaffedPractice;
  let paul: HttpClient;
  let manager: HttpClient;
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
    manager = await application.as({ id: practice.managerId });
  });

  reportSeedOnFailure({ beforeEach, onTestFailed });

  it('answers 401 to a caller who presents no credential', async () => {
    expectStatus(await application.client.get(`/practices/${practice.practiceId}/agenda/export`), 401);
  });

  it('streams the agenda of the practice as CSV, one row per appointment, to its manager', async () => {
    const appointmentId = expectStatus(await bookAppointment(paul, practice, { startsAt }), 201).body.id;
    const exportOfThePractice = `/practices/${practice.practiceId}/agenda/export`;

    const csv = await eventually(async () => {
      const response = expectStatus(await manager.get<string>(exportOfThePractice, { headers: { accept: CSV } }), 200);

      expect(response.body).toContain(appointmentId);

      return response;
    });

    const [header, row] = csv.body.trimEnd().split('\r\n');

    expect(csv.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(header?.split(',')).toEqual(expect.arrayContaining(['id', 'calendarId', 'startsAt', 'status']));
    expect(row).toContain(startsAt.toISOString());
  });

  it('refuses the export to a patient, who is no member of the practice', async () => {
    expectStatus(await paul.get(`/practices/${practice.practiceId}/agenda/export`, { headers: { accept: CSV } }), 403);
  });

  it('answers the agenda in XML to a partner who asks for it, and 406 to one who accepts nothing it writes', async () => {
    const appointmentId = expectStatus(await bookAppointment(paul, practice, { startsAt }), 201).body.id;
    const agenda = `/practices/${practice.practiceId}/agenda`;

    const xml = await eventually(async () => {
      const response = expectStatus(await manager.get<string>(agenda, { headers: { accept: XML } }), 200);

      expect(response.body).toContain(`<id>${appointmentId}</id>`);

      return response;
    });

    expect(xml.headers['content-type']).toBe('application/xml; charset=utf-8');
    expect(xml.headers['vary']).toBe('accept');
    expect(xml.body).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?><searchPracticeAgenda /);

    expectProblem(await manager.get(agenda, { headers: { accept: 'image/png' } }), {
      status: 406,
      code: 'NOT_ACCEPTABLE',
    });
  });
});

const meadow = { name: 'Meadow', managerId: 'mary', practitionerId: 'pierre', assistantId: 'anna' };
