import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '@ddd-ts-kit/kernel';
import { executeRoute, type RawRequest, type Route, type RouteResponse } from '../src';
import { generateOpenApi } from '../src/openapi';
import { decoratorModes, removeCompiled } from './support/decorator-modes';
import { frontDeskRoutes, manager, nurse, RecordingDesk, type FrontDesk } from './support/front-desk';

const FIXTURES = path.join(import.meta.dirname, 'fixtures/controllers');

interface Call {
  readonly params?: Record<string, string>;
  readonly body?: unknown;
  readonly as?: Actor;
}

function describeTheFrontDesk(label: string, load: () => Promise<FrontDesk>): void {
  describe(`controllers, ${label}`, () => {
    let routes: readonly Route[];
    let desk: RecordingDesk;
    let fixture: FrontDesk;

    beforeAll(async () => {
      fixture = await load();
      desk = new RecordingDesk();
      routes = frontDeskRoutes(fixture, desk);
    });

    const call = (operationId: string, { params = {}, body, as }: Call = {}): Promise<RouteResponse> => {
      const route = routes.find((candidate) => candidate.operationId === operationId);
      const request: RawRequest = { params, query: {}, headers: { 'x-api-key': 'k' }, body, raw: undefined };

      if (route === undefined) {
        throw new Error(`No route ${operationId}`);
      }

      return executeRoute(route, request, { validateResponses: true, resolvePrincipal: () => as });
    };

    it('each become one route: the path under the prefixes of its groups, the operation named after the class', () => {
      expect(routes.map((route) => `${route.method} ${route.path} ${route.operationId}`)).toEqual([
        'POST /visits bookVisit',
        'GET /visits/:visitId getVisit',
        'DELETE /visits/clinics/:clinicId/visits/:visitId cancelVisit',
        'GET /opening-hours readOpeningHours',
        'POST /alerts receiveAlert',
      ]);
    });

    it('document what their groups and guards say, without repeating it', () => {
      const [book, , cancel, hours] = routes;

      expect(book).toMatchObject({ tags: ['visits'], security: ['bearer'] });
      expect(book?.errors).toEqual(['FORBIDDEN', 'SLOT_TAKEN', 'UNAUTHORIZED']);
      expect(cancel?.errors).toEqual(['FORBIDDEN', 'UNAUTHORIZED']);
      expect(hours).toMatchObject({ tags: ['public'], security: false, errors: [], deprecated: true });
      expect(book?.responses[201]?.description).toBe('Booked; the body carries the identifier.');
      expect(cancel?.responses[204]).toEqual({ description: 'Done.' });
      expect(hours?.responses[200]?.description).toBe('The answer.');
    });

    it('carry the names of their group and of the groups above it, which a split contract selects by', () => {
      const [book, , cancel, hours] = routes;

      expect(book?.groups).toEqual(['VisitRoutes']);
      expect(cancel?.groups).toEqual(['ClinicVisitRoutes', 'VisitRoutes']);
      expect(hours?.groups).toBeUndefined();

      expect(JSON.stringify(generateOpenApi({ info: { title: 'Desk', version: '1' }, routes }))).not.toContain(
        'VisitRoutes',
      );
    });

    it('answer the declared status with what handle returned, through the mapper and the actor of the request', async () => {
      const response = await call('bookVisit', { body: { patientId: 'patient-7', day: '2026-03-02' }, as: nurse });

      expect(response).toMatchObject({
        status: 201,
        body: { id: 'visit-1' },
        headers: { location: '/visits/visit-1' },
      });

      expect(desk.booked).toEqual([{ patientId: 'patient-7', day: '2026-03-02', bookedBy: 'grace' }]);
    });

    it('validate with the declared schemas before anything runs', async () => {
      const response = await call('bookVisit', { body: { patientId: '' }, as: nurse });

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('answer through the serializer: what the contract does not declare stays inside', async () => {
      const response = await call('getVisit', { params: { visitId: 'visit-9' }, as: nurse });

      expect(response).toMatchObject({ status: 200 });
      expect(response.body).toEqual({ id: 'visit-9', patientId: 'patient-7', day: '2026-03-02' });
    });

    it('are held behind the guards of their groups, in order: 401 without a caller, 403 without the role', async () => {
      const anonymous = await call('bookVisit', { body: { patientId: 'patient-7', day: '2026-03-02' } });
      const withoutRole = await call('cancelVisit', { params: { clinicId: 'clinic-1', visitId: 'v' }, as: nurse });

      expect(anonymous.status).toBe(401);
      expect(anonymous.body).toMatchObject({ code: 'UNAUTHORIZED', detail: 'Authentication is required' });
      expect(withoutRole.status).toBe(403);
      expect(withoutRole.body).toMatchObject({ code: 'FORBIDDEN' });
      expect(fixture.CancelVisitController.cancelled).toEqual([]);
    });

    it('run a guard of the project built by the composition root, on the parameters of the path', async () => {
      const elsewhere = await call('cancelVisit', { params: { clinicId: 'clinic-2', visitId: 'v' }, as: manager });
      const here = await call('cancelVisit', { params: { clinicId: 'clinic-1', visitId: 'visit-3' }, as: manager });

      expect(elsewhere.body).toMatchObject({ status: 403, detail: 'The caller belongs to another clinic' });
      expect(here.status).toBe(204);
      expect(here.body).toBeUndefined();
      expect(fixture.CancelVisitController.cancelled).toEqual(['visit-3']);
    });

    it('let anybody through a route declared public', async () => {
      expect(await call('readOpeningHours')).toMatchObject({ status: 200, body: { opens: '08:00' } });
    });

    it('give the contract its security and its problem responses', () => {
      const document = generateOpenApi({ info: { title: 'Front desk', version: '1.0.0' }, routes });
      const book = document.paths['/visits']?.['post'];
      const hours = document.paths['/opening-hours']?.['get'];

      expect(book).toMatchObject({ operationId: 'bookVisit', security: [{ bearer: [] }], tags: ['visits'] });
      expect(Object.keys(book?.['responses'] ?? {})).toEqual(['201', '401', '403', '422']);

      expect(JSON.stringify(book?.['responses'])).toContain(
        '"Location":{"description":"The URL of the visit.","schema":{"type":"string"}}',
      );

      expect(hours).toMatchObject({ security: [], deprecated: true });
    });
  });
}

describeTheFrontDesk('as the test runner transforms them', () => import('./fixtures/controllers/front-desk'));

for (const mode of decoratorModes(FIXTURES)) {
  describeTheFrontDesk(`compiled by ${mode.label}`, async () => {
    const emitted = await mode.load('test/fixtures/controllers/front-desk.js');

    return emitted as FrontDesk;
  });
}

afterAll(() => {
  removeCompiled(FIXTURES);
});
