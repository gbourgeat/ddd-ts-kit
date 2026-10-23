import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

    it('validates the parameters of the path with the schema of the controller', async () => {
      const response = await call('GET', '/visits/visit-9', 'nurse');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: 'visit-9', patientId: 'patient-7', day: '2026-03-02' });
    });
  });
}
