import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { Clock } from '@ddd-ts-kit/kernel';
import { Edge, injected } from '@ddd-ts-kit/kernel/declarations';
import { DeclaredEdges, contextModule, kernelModule } from '../src';
import { createApplication } from './support/on-container';
import { discoverContext } from '../src/discovery';
import { wiringRejection } from './support/rejection';

class InvoiceMapper {
  readonly name = 'mapper';
}

class IssueInvoiceController {
  constructor(
    readonly clock: Clock,
    readonly mapper: InvoiceMapper,
  ) {}
}

class OfficeHoursGuard {
  constructor(readonly clock: Clock) {}
}

Edge('mapper')(InvoiceMapper);
Edge('controller')(IssueInvoiceController);
Edge('guard', [Clock])(OfficeHoursGuard);
injected(IssueInvoiceController, [Clock, InvoiceMapper]);

const workspace = mkdtempSync(path.join(os.tmpdir(), 'edges-'));

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

function contextWith(files: readonly string[]): string {
  const directory = mkdtempSync(path.join(workspace, 'context-'));

  for (const relative of files) {
    mkdirSync(path.dirname(path.join(directory, relative)), { recursive: true });
    writeFileSync(path.join(directory, relative), '');
  }

  return directory;
}

describe('the declared classes of the edge', () => {
  it('are bound under themselves, built from their constructor, and listed by the word they declared', () => {
    const module = contextModule('billing', [InvoiceMapper, IssueInvoiceController, OfficeHoursGuard]);
    const app = createApplication({ modules: [kernelModule(), module] });
    const edges = app.resolve(DeclaredEdges);
    const controller = app.resolve(IssueInvoiceController);

    expect(edges.of('controller')).toEqual([IssueInvoiceController]);
    expect(edges.of('guard')).toEqual([OfficeHoursGuard]);
    expect(edges.of('serializer')).toEqual([]);

    expect(edges.list.map((edge) => `${edge.module} ${edge.part}`)).toEqual([
      'billing mapper',
      'billing controller',
      'billing guard',
    ]);

    expect(controller.mapper).toBe(app.resolve(InvoiceMapper));
    expect(controller.clock).toBe(app.resolve(Clock));
    expect(app.resolve(OfficeHoursGuard).clock).toBe(app.resolve(Clock));
  });

  it('are refused a part that is not a lower-case word', () => {
    expect(() => Edge('Controller')).toThrow(/An edge part is named in lower-case words, and "Controller" is not/);
  });

  it('are discovered under presentation/, by the suffixes of the edge only', async () => {
    const CONTROLLER = 'presentation/http/invoices/issue-invoice/issue-invoice.controller.mjs';
    const MAPPER = 'presentation/http/invoices/issue-invoice/issue-invoice.mapper.mjs';
    const loaded: string[] = [];

    const directory = contextWith([
      CONTROLLER,
      MAPPER,
      'presentation/http/invoices/issue-invoice/issue-invoice.body.mjs',
      'presentation/http/invoice.handler.mjs',
      'presentation/http/invoice.routes.mjs',
      'infrastructure/persistence/invoice.mapper.mjs',
    ]);

    const module = await discoverContext('billing', directory, {
      load: async (file) => {
        loaded.push(path.relative(directory, file.pathname));

        return file.pathname.endsWith('.controller.mjs') ? { IssueInvoiceController } : { InvoiceMapper };
      },
    });

    const app = createApplication({ modules: [kernelModule(), module] });

    expect(loaded).toEqual([CONTROLLER, MAPPER]);
    expect(app.resolve(DeclaredEdges).of('controller')).toEqual([IssueInvoiceController]);

    expect(app.describe().bindings.find((binding) => binding.token === 'IssueInvoiceController')).toMatchObject({
      file: path.join(directory, CONTROLLER),
      dependencies: ['Clock', 'InvoiceMapper'],
    });
  });

  it('are refused in a file of the edge that declares another role', async () => {
    const directory = contextWith(['presentation/http/office-hours.guard.mjs']);

    const failure = await wiringRejection(
      discoverContext('billing', directory, { load: async () => ({ Clock, nothing: 1 }) }),
    );

    expect(failure.code).toBe('NOTHING_DECLARED');
  });
});
