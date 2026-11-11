import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config';
import { contextLayout } from '../src/context-layout';
import { moveToModule } from '../src/move-to-module';
import { Workspace } from '../src/workspace';
import { exists, tempDir, write } from './helpers';

const BILLING = 'src/contexts/billing';
const DIVIDED = { contexts: { billing: { classification: 'core', modules: { invoices: {}, reminders: {} } } } };
const CONFIG = parseConfig(DIVIDED);

/** A project holding billing as `files` lay it out, under `config`. */
function projectWith(files: readonly string[], config: object = DIVIDED): string {
  const root = tempDir('move-to-module-shared');

  write(root, 'ddd-ts-kit.config.json', JSON.stringify(config));
  files.forEach((file) => write(root, `${BILLING}/${file}`, ''));

  return root;
}

/** What `move-to-module billing <module> <paths>` moves, relative to billing, written to disk. */
function moved(root: string, module: string, ...paths: string[]): Record<string, string> {
  const ws = new Workspace(root, false);
  const outcome = moveToModule(ws, CONFIG, { context: 'billing', module, paths });

  ws.commit(false);

  return Object.fromEntries(
    outcome.moved.map(({ from, to }) => [from.slice(BILLING.length + 1), to.slice(BILLING.length + 1)]),
  );
}

describe('move-to-module, on a context whose modules hold their tests', () => {
  it('moves a file out of shared into a module, its specs of shared with it, in the test folder of the module', () => {
    const root = projectWith([
      'invoices/domain/aggregates/invoice.aggregate.ts',
      'shared/infrastructure/persistence/knex-invoice.repository.ts',
      'shared/test/integration/knex-invoice.repository.contract.spec.ts',
      'shared/test/unit/tenant.guard.spec.ts',
    ]);

    expect(moved(root, 'invoices', 'shared/infrastructure/persistence/knex-invoice.repository.ts')).toEqual({
      'shared/infrastructure/persistence/knex-invoice.repository.ts':
        'invoices/infrastructure/persistence/knex-invoice.repository.ts',
      'shared/test/integration/knex-invoice.repository.contract.spec.ts':
        'invoices/test/integration/knex-invoice.repository.contract.spec.ts',
    });

    expect(exists(root, `${BILLING}/shared/test/unit/tenant.guard.spec.ts`)).toBe(true);
  });

  it('moves a file left at the level of the context with its spec, of the context or of shared, into the test folder of the module', () => {
    const root = projectWith([
      'shared/test/worlds/billing.world.ts',
      'application/ports/ledger.port.ts',
      'test/unit/ledger.port.spec.ts',
      'shared/test/unit/ledger.port.contract.spec.ts',
    ]);

    expect(moved(root, 'reminders', 'application/ports/ledger.port.ts')).toEqual({
      'application/ports/ledger.port.ts': 'reminders/application/ports/ledger.port.ts',
      'test/unit/ledger.port.spec.ts': 'reminders/test/unit/ledger.port.spec.ts',
      'shared/test/unit/ledger.port.contract.spec.ts': 'reminders/test/unit/ledger.port.contract.spec.ts',
    });
  });

  it('moves a file from a module to another with the specs of the module it leaves, and no spec of shared', () => {
    const root = projectWith([
      'invoices/domain/services/rounding.service.ts',
      'invoices/test/unit/domain/rounding.service.spec.ts',
      'shared/test/unit/rounding.service.spec.ts',
    ]);

    expect(moved(root, 'reminders', 'invoices/domain/services/rounding.service.ts')).toEqual({
      'invoices/domain/services/rounding.service.ts': 'reminders/domain/services/rounding.service.ts',
      'invoices/test/unit/domain/rounding.service.spec.ts': 'reminders/test/unit/domain/rounding.service.spec.ts',
    });
  });

  it('takes a fake and a builder of shared into the test folder of a module, and leaves a schema of the context', () => {
    const root = projectWith([
      'shared/test/fakes/clock.fake.ts',
      'shared/test/builders/invoice.builder.ts',
      'shared/infrastructure/persistence/billing.schema.ts',
    ]);

    expect(
      moved(
        root,
        'invoices',
        'shared/test/fakes/clock.fake.ts',
        'shared/test/builders',
        'shared/infrastructure/persistence/billing.schema.ts',
      ),
    ).toEqual({
      'shared/test/fakes/clock.fake.ts': 'invoices/test/fakes/clock.fake.ts',
      'shared/test/builders/invoice.builder.ts': 'invoices/test/builders/invoice.builder.ts',
    });
  });

  it('refuses a world, which stays at the level of the context', () => {
    const root = projectWith(['shared/test/worlds/billing.world.ts']);

    expect(() => moved(root, 'invoices', 'shared/test/worlds/billing.world.ts')).toThrow(
      /is in no role folder of a layer of "billing"/,
    );
  });
});

describe('move-to-module, on a context laid out as today', () => {
  it('still moves a spec to the folder of the context named after the module, and refuses a fake', () => {
    const root = projectWith([
      'application/ports/ledger.port.ts',
      'test/unit/ledger.port.spec.ts',
      'test/fakes/ledger.fake.ts',
    ]);

    expect(() => moved(root, 'reminders', 'test/fakes/ledger.fake.ts')).toThrow(
      /is in no role folder of a layer of "billing"/,
    );

    expect(moved(root, 'reminders', 'application/ports/ledger.port.ts')).toEqual({
      'application/ports/ledger.port.ts': 'reminders/application/ports/ledger.port.ts',
      'test/unit/ledger.port.spec.ts': 'test/unit/reminders/ledger.port.spec.ts',
    });
  });
});

describe('context-layout, on a declared context whose layers hold generated declarations', () => {
  it('deletes the declarations of a layer of the context that holds no role file any more, and writes those of the module', () => {
    const declared = { ...DIVIDED, stack: { style: 'declared' } };

    const root = projectWith(
      [
        'application/application.declarations.ts',
        'domain/invoices/aggregates/invoice.aggregate.ts',
        'application/invoices/commands/issue-invoice/issue-invoice.handler.ts',
      ],
      declared,
    );

    const ws = new Workspace(root, false);

    contextLayout(ws, parseConfig(declared), []);
    ws.commit(false);

    expect(exists(root, `${BILLING}/application/application.declarations.ts`)).toBe(false);
    expect(exists(root, `${BILLING}/invoices/application/application.declarations.ts`)).toBe(true);
  });
});
