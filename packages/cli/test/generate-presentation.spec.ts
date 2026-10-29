import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, scaffoldEverything, tempDir, write } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { readJson } from './support/read-json';
import { commitAll } from './support/commit-all';

const HTTP = 'src/contexts/billing/presentation/http';
const ISSUE = `${HTTP}/invoices/issue-invoice/issue-invoice.controller.ts`;
const SEARCH = `${HTTP}/invoices/search-invoices/search-invoices.controller.ts`;

describe('the presentation of a new project', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('presentation');
    scaffoldEverything(root);
  });

  it('negotiates its representations and serves its forms, as init records it', () => {
    const config = readJson(root, 'ddd-ts-kit.config.json');

    expect(jsonAt(config, 'stack', 'representations')).toBe('negotiated');
    expect(jsonAt(config, 'stack', 'forms')).toBe('on');

    expect(read(root, 'src/platform/http/presentation-of.ts')).toContain(
      'representations: Representations.standard(),',
    );

    expect(read(root, 'src/platform/http/with-forms.ts')).toContain('formRoutes(routes, { fieldAccess })');

    expect(read(root, 'src/platform/auth/authentication/http-boundary.ts')).toContain(
      'export interface HttpBoundary extends Presentation {',
    );

    expect(read(root, 'src/platform/composition/compose-application.ts')).toContain(
      'routes: withForms(routesOf(container, contexts), presentation),',
    );

    expect(read(root, 'scripts/openapi.ts')).toContain('representations: application.boundary.representations,');
    expect(read(root, 'scripts/openapi.ts')).toContain('...(await formDocumentsOf(application.routes))');
  });

  it('makes a controller answer in XML and CSV, and read XML when it receives a body', () => {
    const issued = cli(root, 'generate', 'representation', 'billing', 'IssueInvoice', 'xml,text/csv', '--json');
    const searched = cli(root, 'generate', 'representation', 'billing', 'SearchInvoices', 'csv', '--json');

    expect(issued.code).toBe(0);
    expect(searched.code).toBe(0);

    expect(read(root, ISSUE)).toMatch(
      /summary: '[^']+',\n {2}consumes: \['application\/xml'\],\n {2}produces: \['application\/xml', 'text\/csv'\],\n/,
    );

    expect(read(root, SEARCH)).toContain("produces: ['text/csv'],");
    expect(read(root, SEARCH)).not.toContain('consumes');
    expect(issued.stdout).toContain('CSV writes a list of flat rows');
    expect(issued.stdout).toContain('also reads its body in XML');
    expect(searched.stdout).not.toContain('also reads its body in XML');
  });

  it('refuses a second declaration of what a controller produces, and a media type that says nothing new', () => {
    expect(cli(root, 'generate', 'representation', 'billing', 'SearchInvoices', 'xml').code).not.toBe(0);

    expect(cli(root, 'generate', 'representation', 'billing', 'PayInvoice', 'constructor').stderr).toContain(
      'names no media type',
    );

    expect(cli(root, 'generate', 'representation', 'billing', 'CancelInvoice', 'application/json').stderr).toContain(
      'names no media type besides JSON',
    );
  });

  it('gives a controller that receives a body its form, typed by the body', () => {
    const result = cli(root, 'generate', 'form', 'billing', 'IssueInvoice', '--json');
    const controller = read(root, ISSUE);

    expect(result.code).toBe(0);

    expect(controller).toContain(
      'const form = defineForm<Infer<typeof body>>({\n  // TODO(domain): name the permission of the use case',
    );

    expect(controller).toContain('// TODO(domain): group the fields');
    expect(controller).toMatch(/import \{ [^}]*\bdefineForm\b[^}]*\} from '@ddd-ts-kit\/http';/);
    expect(controller).toContain("import type { Infer } from '@ddd-ts-kit/validation';");
    expect(controller).toMatch(/summary: '[^']+',\n {2}form,\n/);
  });

  it('refuses a form for a controller without a body, a second one, and one for a use case without a controller', () => {
    expect(cli(root, 'generate', 'form', 'billing', 'SearchInvoices').stderr).toContain('receives no body');
    expect(cli(root, 'generate', 'form', 'billing', 'IssueInvoice').stderr).toContain('already declares its form');
    expect(cli(root, 'generate', 'form', 'billing', 'PayInvoice').stderr).toContain('has no controller for');
  });

  it('describes what each route answers and reads in, and where its form is', () => {
    const routes = jsonAt(cli(root, 'describe', 'billing', '--json').json(), 'routes');
    const text = cli(root, 'describe', 'billing').stdout;

    expect(routes).toContainEqual(
      expect.objectContaining({
        operationId: 'issueInvoice',
        produces: ['application/xml', 'text/csv'],
        consumes: ['application/xml'],
        form: 'GET /forms/issueInvoice',
      }),
    );

    expect(text).toContain(
      '; answers also application/xml, text/csv; reads also application/xml; form: GET /forms/issueInvoice',
    );
  });
});

describe('a project initialised before representations and forms', () => {
  it('keeps answering JSON alone, with no form, through init --force', () => {
    const root = initProject('--http', 'express');
    const config = readJson(root, 'ddd-ts-kit.config.json');
    const stack = jsonAt(config, 'stack');
    const { representations: _representations, forms: _forms, ...before } = stack as Record<string, unknown>;

    write(root, 'ddd-ts-kit.config.json', `${JSON.stringify({ ...(config as object), stack: before }, null, 2)}\n`);
    commitAll(root);

    expect(cli(root, 'init', '--force').code).toBe(0);
    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'stack', 'representations')).toBe('json');
    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'stack', 'forms')).toBe('off');
    expect(read(root, 'src/platform/auth/authentication/http-boundary.ts')).not.toContain('Presentation');
    expect(read(root, 'scripts/openapi.ts')).not.toContain('formDocumentsOf');
  });

  it('is told how to turn them on when it asks for a form or a representation', () => {
    const root = initProject('--representations', 'json', '--forms', 'off');

    expect(exists(root, 'src/platform/http/presentation-of.ts')).toBe(false);
    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'stack', 'forms')).toBe('off');
  });

  it('has neither without an HTTP stack', () => {
    const root = initProject('--http', 'none');

    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'stack', 'representations')).toBe('json');
    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'stack', 'forms')).toBe('off');
  });
});
