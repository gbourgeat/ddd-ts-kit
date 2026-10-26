import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import * as fixture from '../fixtures/controllers/front-desk';
import { frontDeskRoutes, manager, nurse, RecordingDesk } from './front-desk';
import type { ReadAuthorization, RunningServer, StartServer } from './running-server';

const CALLERS = new Map([
  ['Bearer manager', manager],
  ['Bearer nurse', nurse],
]);

/** Controllers are routes for an adapter: the same suite on each proves the framework changes nothing. */
export function mountsControllers(start: StartServer, readAuthorization: ReadAuthorization): void {
  describe('controllers', () => {
    let server: RunningServer;
    const desk = new RecordingDesk();

    beforeAll(async () => {
      server = await start(frontDeskRoutes(fixture, desk), {
        validateResponses: true,
        resolvePrincipal: (raw) => CALLERS.get(readAuthorization(raw) ?? ''),
      });
    });

    afterAll(async () => {
      await server.close();
    });

    const call = (method: string, path: string, caller?: string, body?: unknown): Promise<Response> =>
      fetch(`${server.url}${path}`, {
        method,
        headers: {
          ...(caller === undefined ? {} : { authorization: `Bearer ${caller}` }),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });

    it('answers a controller with its declared status and body', async () => {
      const response = await call('POST', '/visits', 'nurse', { patientId: 'patient-7', day: '2026-03-02' });

      expect(response.status).toBe(201);
      expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
      expect(await response.json()).toEqual({ id: `visit-${desk.booked.length}` });
      expect(desk.booked.at(-1)).toMatchObject({ bookedBy: 'grace' });
    });

    it('writes the headers a controller declares beside its body', async () => {
      const response = await call('POST', '/visits', 'nurse', { patientId: 'patient-7', day: '2026-03-02' });

      expect(response.status).toBe(201);
      expect(response.headers.get('location')).toBe(`/visits/visit-${desk.booked.length}`);
    });

    it('answers the problem of a guard that refuses, and lets a public controller through', async () => {
      const anonymous = await call('POST', '/visits', undefined, { patientId: 'patient-7', day: '2026-03-02' });
      const withoutRole = await call('DELETE', '/visits/clinics/clinic-1/visits/visit-1', 'nurse');
      const allowed = await call('DELETE', '/visits/clinics/clinic-1/visits/visit-1', 'manager');
      const open = await call('GET', '/opening-hours');

      expect(anonymous.status).toBe(401);
      expect(anonymous.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
      expect(await anonymous.json()).toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
      expect(withoutRole.status).toBe(403);
      expect(allowed.status).toBe(204);
      expect(await open.json()).toEqual({ opens: '08:00' });
    });

    it('hands a controller that declares rawBody the bytes as they were sent, to verify a signature over them', async () => {
      // Spaces and key order that a parse and a stringify would not give back.
      const payload = '{ "title":  "Disk full",   "severity": "high" }';
      const sign = (body: string): string => createHmac('sha256', fixture.WEBHOOK_SECRET).update(body).digest('hex');

      const send = (body: string, signature: string): Promise<Response> =>
        fetch(`${server.url}/alerts`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-signature': signature },
          body,
        });

      const signed = await send(payload, sign(payload));
      const forged = await send(payload, sign('{}'));

      expect(signed.status).toBe(200);
      expect(await signed.json()).toEqual({ title: 'Disk full' });
      expect(forged.status).toBe(422);
      expect(await forged.json()).toMatchObject({ code: 'BAD_SIGNATURE' });
    });

    it('validates the parameters of the path with the schema of the controller', async () => {
      const response = await call('GET', '/visits/visit-9', 'nurse');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: 'visit-9', patientId: 'patient-7', day: '2026-03-02' });
    });
  });
}
