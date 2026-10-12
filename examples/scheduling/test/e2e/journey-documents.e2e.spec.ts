import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expectProblem, expectStatus, type HttpClient } from '@ddd-ts-kit/testing/e2e';
import { bookAppointment } from '$test/e2e/support/book-appointment';
import { openStaffedPractice } from '$test/e2e/support/open-staffed-practice';
import { registerPeople } from '$test/e2e/support/register-people';
import { slotStarting } from '$test/e2e/support/slot-starting';
import type { StaffedPractice } from '$test/e2e/support/staffed-practice';
import { startApplication, type RunningApplication } from '$test/e2e/support/start-application';

interface DocumentLink {
  readonly url: string;
  readonly expiresAt: string;
  readonly name: string;
  readonly mediaType: string;
  readonly size: number;
}

const PDF = '%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n';
const riverside = { name: 'Riverside', managerId: 'ada', practitionerId: 'grace', assistantId: 'linus' };

describe('A document attached to an appointment: sent as it streams, fetched through a short link, removed', () => {
  let application: RunningApplication;
  let practice: StaffedPractice;
  let paul: HttpClient;
  let rosa: HttpClient;
  let appointmentId: string;

  beforeAll(async () => {
    application = await startApplication();
  });

  afterAll(async () => {
    await application.close();
  });

  beforeEach(async () => {
    await application.reset();
    practice = await openStaffedPractice(application, riverside);
    await registerPeople(application, 'paul', 'rosa');
    paul = await application.as({ id: 'paul', roles: ['patient'] });
    rosa = await application.as({ id: 'rosa', roles: ['patient'] });

    appointmentId = expectStatus(await bookAppointment(paul, practice, { startsAt: slotStarting({ days: 7 }) }), 201)
      .body.id;
  });

  it('keeps the document of the patient, serves it through a link that names it, and forgets it once removed', async () => {
    expect((await send('paul', PDF, 'application/pdf')).status).toBe(201);

    const link = expectStatus(await paul.get<DocumentLink>(`/appointments/${appointmentId}/document`), 200).body;
    const file = await fetch(onServer(link.url));

    expect(link).toMatchObject({ name: 'referral.pdf', mediaType: 'application/pdf', size: PDF.length });
    expect(Date.parse(link.expiresAt) - Date.now()).toBeLessThanOrEqual(300_000);
    expect([file.status, await file.text()]).toEqual([200, PDF]);
    expect(file.headers.get('content-disposition')).toContain('filename="referral.pdf"');

    expectStatus(await paul.delete(`/appointments/${appointmentId}/document`), 200);

    expectProblem(await paul.get(`/appointments/${appointmentId}/document`), { status: 404, code: 'NO_DOCUMENT' });
    expect((await fetch(onServer(link.url))).status).toBe(403);
  });

  it('refuses a file whose bytes are not what it declares, and keeps the document from another patient', async () => {
    const disguised = await send('paul', '<html><script>alert(1)</script></html>', 'application/pdf');

    expect([disguised.status, await codeOf(disguised)]).toEqual([415, 'UNSUPPORTED_MEDIA_TYPE']);
    expectProblem(await paul.get(`/appointments/${appointmentId}/document`), { status: 404, code: 'NO_DOCUMENT' });

    expect((await send('paul', PDF, 'application/pdf')).status).toBe(201);
    expect((await rosa.get(`/appointments/${appointmentId}/document`)).status).toBe(403);
  });

  async function send(actor: string, content: string, type: string): Promise<Response> {
    const form = new FormData();

    form.set('document', new Blob([content], { type }), 'referral.pdf');

    return fetch(`${application.url}/appointments/${appointmentId}/document`, {
      method: 'POST',
      headers: await application.headersOf({ id: actor, roles: ['patient'] }),
      body: form,
    });
  }

  /** The link of the storage of the tests names the default address of the application: the same path, on the server of the test. */
  function onServer(url: string): string {
    const link = new URL(url);

    return `${application.url}${link.pathname}${link.search}`;
  }
});

async function codeOf(response: Response): Promise<unknown> {
  const problem: unknown = await response.json();

  return typeof problem === 'object' && problem !== null && 'code' in problem ? problem.code : undefined;
}
