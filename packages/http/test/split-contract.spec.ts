import { describe, expect, it } from 'vitest';
import { executeRoute, type RawRequest, type Route } from '../src/index.js';
import { generateOpenApi, routesByDocument } from '../src/openapi.js';
import { openApiDocumentsRoutes } from '../src/docs.js';

const request: RawRequest = { params: {}, query: {}, headers: {}, body: undefined, raw: undefined };

function route(operationId: string, path: string, extra: Partial<Route> = {}): Route {
  return {
    method: 'GET',
    path,
    operationId,
    summary: operationId,
    responses: { 204: { description: 'Done.' } },
    security: false,
    handle: () => ({ status: 204 }),
    ...extra,
  };
}

const ROUTES = [
  route('searchVisits', '/visits', { groups: ['VisitRoutes'], tags: ['visits'] }),
  route('cancelVisit', '/visits/:visitId', { groups: ['ClinicVisitRoutes', 'VisitRoutes'], tags: ['visits'] }),
  route('readOpeningHours', '/opening-hours', { tags: ['public'] }),
  route('searchAuditEntries', '/audit/entries', { tags: ['audit'] }),
];

const names = (routes: readonly Route[]): string[] => routes.map((each) => each.operationId);

describe('routesByDocument', () => {
  it('keeps every route in one document named openapi when the contract is not split', () => {
    expect(routesByDocument(ROUTES, [])).toEqual([{ name: 'openapi', routes: ROUTES }]);
  });

  it('gives each document the routes of its groups, at any depth, of its tags and of its operations, a route in several on purpose', () => {
    const documents = routesByDocument(ROUTES, [
      { name: 'clinics', title: 'Clinics', groups: ['ClinicVisitRoutes'] },
      { name: 'visits', groups: ['VisitRoutes'] },
      { name: 'public', tags: ['public'], operations: ['searchVisits'] },
      { name: 'back-office', tags: ['audit'] },
    ]);

    expect(documents.map(({ name, title, routes }) => [name, title, names(routes)])).toEqual([
      ['clinics', 'Clinics', ['cancelVisit']],
      ['visits', undefined, ['searchVisits', 'cancelVisit']],
      ['public', undefined, ['searchVisits', 'readOpeningHours']],
      ['back-office', undefined, ['searchAuditEntries']],
    ]);
  });

  it('refuses a route that no document holds, naming it and what to do', () => {
    expect(() => routesByDocument(ROUTES, [{ name: 'visits', groups: ['VisitRoutes'] }])).toThrow(
      'No document of "openapi.documents" holds GET /opening-hours (readOpeningHours), GET /audit/entries (searchAuditEntries). Name its route group, its context or one of its tags in a document of ddd-ts-kit.config.json, then run `ddd-ts-kit docs`.',
    );
  });
});

describe('openApiDocumentsRoutes', () => {
  const documentOf = (title: string, routes: readonly Route[]) =>
    generateOpenApi({ info: { title, version: '1.0.0' }, routes });

  const split = [
    { name: 'visits', document: documentOf('Visits', ROUTES.slice(0, 2)) },
    { name: 'back-office', document: documentOf('Back <office>', ROUTES.slice(3)) },
  ];

  const answer = async (routes: readonly Route[], path: string): Promise<string> => {
    const found = routes.find((candidate) => candidate.path === path);

    return found === undefined ? `no route at ${path}` : String((await executeRoute(found, request)).body);
  };

  it('serves one document as before, at /openapi.json and /docs', async () => {
    const routes = openApiDocumentsRoutes(split.slice(0, 1));

    expect(routes.map((each) => each.path)).toEqual(['/openapi.json', '/docs']);
    expect(JSON.parse(await answer(routes, '/openapi.json')).info.title).toBe('Visits');
  });

  it('serves each document of a split contract, and a Swagger UI page that selects between them', async () => {
    const routes = openApiDocumentsRoutes(split, { title: 'Clinic <API>' });
    const page = await answer(routes, '/docs');

    expect(routes.map((each) => each.path)).toEqual([
      '/openapi/visits.json',
      '/docs/visits',
      '/openapi/back-office.json',
      '/docs/back-office',
      '/docs',
    ]);

    expect(JSON.parse(await answer(routes, '/openapi/back-office.json')).paths).toHaveProperty(['/audit/entries']);

    expect(page).toContain(
      'urls: [{"url":"/openapi/visits.json","name":"Visits"},{"url":"/openapi/back-office.json","name":"Back \\u003coffice>"}]',
    );

    expect(page).toContain("layout: 'StandaloneLayout'");
    expect(page).toContain('Clinic &#60;API&#62;');
    expect(await answer(routes, '/docs/visits')).toContain('/openapi/visits.json');
  });

  it.each(['scalar', 'redoc'] as const)(
    'lists the page of each document under %s, which shows one at a time',
    async (ui) => {
      const routes = openApiDocumentsRoutes(split, { ui, contractsPath: '/api/openapi', uiPath: '/api/docs' });

      expect(await answer(routes, '/api/docs')).toContain('<li><a href="/api/docs/visits">Visits</a></li>');
      expect(await answer(routes, '/api/docs/back-office')).toContain('/api/openapi/back-office.json');
    },
  );
});
