import { beforeAll, describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config';
import { contextLayout, type ContextLayout } from '../src/context-layout';
import { Workspace } from '../src/workspace';
import { exists, read, tempDir, walk, write } from './helpers';

const BILLING = 'src/contexts/billing';
const CONFIG = { contexts: { billing: { classification: 'core', modules: { invoices: {}, reminders: {} } } } };
const INDEX = 'src/platform/database/schema.ts';
const MIGRATION = 'migrations/20260101120000_add-notes.js';
const from = (file: string): string => `import '@/contexts/billing/${file}';\n`;

/** Billing as it is laid out today, one file per rule of the move; each is named by what it proves. */
const TODAY: Readonly<Record<string, string>> = {
  // The modules.
  'invoices/domain/aggregates/invoice.aggregate.ts': '',
  'invoices/domain/repositories/invoice.repository.ts': '',
  'reminders/domain/aggregates/reminder.aggregate.ts': '',
  'reminders/application/ports/payment-gateway.port.ts': '',
  // What the context keeps at its own level.
  'infrastructure/persistence/billing.schema.ts': '',
  'presentation/http/invoices.routes.ts': '',
  'presentation/http/guards/tenant.guard.ts': '',
  'presentation/http/shared/money.schema.ts': '',
  'test/worlds/billing.world.ts': '',
  // The specs of a module, in the test folders of the context.
  'test/unit/invoices/invoice.aggregate.spec.ts': '',
  'test/integration/reminders/domain/reminder.reader.spec.ts': '',
  // Fakes and builders: by their subject, then by their imports, else of no module.
  'test/builders/invoice.builder.ts': from('reminders/domain/aggregates/reminder.aggregate'),
  'test/fakes/payment-gateway.fake.ts': '',
  'test/fakes/invoice.repository.fake.ts': '',
  'test/fakes/recording-mailer.fake.ts': from('reminders/domain/aggregates/reminder.aggregate'),
  'test/fakes/clock.fake.ts': '',
  // Specs of no module yet: by the file they are named after, then by their imports, else of no module.
  'test/unit/reminder.aggregate.spec.ts': '',
  'test/unit/overdue.spec.ts': from('reminders/domain/aggregates/reminder.aggregate'),
  'test/unit/tenant.guard.spec.ts': from('presentation/http/guards/tenant.guard'),
  'test/integration/billing-flow.spec.ts': `${from('invoices/domain/aggregates/invoice.aggregate')}${from('reminders/domain/aggregates/reminder.aggregate')}`,
  // A file of a layer whose imports name two modules.
  'application/ports/ledger.port.ts': `${from('invoices/domain/aggregates/invoice.aggregate')}${from('reminders/domain/aggregates/reminder.aggregate')}`,
  // A row schema is of a module: the one its imports name.
  'infrastructure/persistence/invoice-row.schema.ts': from('invoices/domain/aggregates/invoice.aggregate'),
};

/** Where each file of `TODAY` is once the context is laid out. */
const TO_COME: Readonly<Record<string, string>> = {
  'infrastructure/persistence/billing.schema.ts': 'shared/infrastructure/persistence/billing.schema.ts',
  'presentation/http/invoices.routes.ts': 'shared/presentation/http/invoices.routes.ts',
  'presentation/http/guards/tenant.guard.ts': 'shared/presentation/http/guards/tenant.guard.ts',
  'presentation/http/shared/money.schema.ts': 'shared/presentation/http/shared/money.schema.ts',
  'test/worlds/billing.world.ts': 'shared/test/worlds/billing.world.ts',
  'test/unit/invoices/invoice.aggregate.spec.ts': 'invoices/test/unit/invoice.aggregate.spec.ts',
  'test/integration/reminders/domain/reminder.reader.spec.ts':
    'reminders/test/integration/domain/reminder.reader.spec.ts',
  'test/builders/invoice.builder.ts': 'invoices/test/builders/invoice.builder.ts',
  'test/fakes/payment-gateway.fake.ts': 'reminders/test/fakes/payment-gateway.fake.ts',
  'test/fakes/invoice.repository.fake.ts': 'invoices/test/fakes/invoice.repository.fake.ts',
  'test/fakes/recording-mailer.fake.ts': 'reminders/test/fakes/recording-mailer.fake.ts',
  'test/fakes/clock.fake.ts': 'shared/test/fakes/clock.fake.ts',
  'test/unit/reminder.aggregate.spec.ts': 'reminders/test/unit/reminder.aggregate.spec.ts',
  'test/unit/overdue.spec.ts': 'reminders/test/unit/overdue.spec.ts',
  'test/unit/tenant.guard.spec.ts': 'shared/test/unit/tenant.guard.spec.ts',
  'test/integration/billing-flow.spec.ts': 'shared/test/integration/billing-flow.spec.ts',
  'infrastructure/persistence/invoice-row.schema.ts': 'invoices/infrastructure/persistence/invoice-row.schema.ts',
};

/** A project holding billing as `files` lay it out, and `others` from its root. */
function projectWith(files: Readonly<Record<string, string>>, others: Readonly<Record<string, string>> = {}): string {
  const root = tempDir('context-layout-shared');

  write(root, 'ddd-ts-kit.config.json', JSON.stringify(CONFIG));
  Object.entries(files).forEach(([file, content]) => write(root, `${BILLING}/${file}`, content));
  Object.entries(others).forEach(([file, content]) => write(root, file, content));

  return root;
}

/** Lays the project out, written to disk. */
function laidOut(root: string): ContextLayout {
  const ws = new Workspace(root, false);
  const layout = contextLayout(ws, parseConfig(CONFIG), []);

  ws.pruneEmptiedFolders();
  ws.commit(false);

  return layout;
}

describe('context-layout, on a context divided into modules laid out as today', () => {
  let root: string;
  let layout: ContextLayout;

  beforeAll(() => {
    root = projectWith(TODAY);
    layout = laidOut(root);
  });

  it.each(Object.entries(TO_COME))('moves %s to %s', (today, toCome) => {
    expect(layout.moved).toContainEqual({ from: `${BILLING}/${today}`, to: `${BILLING}/${toCome}` });
    expect(exists(root, `${BILLING}/${toCome}`)).toBe(true);
    expect(exists(root, `${BILLING}/${today}`)).toBe(false);
  });

  it('moves nothing else, and leaves no test folder at the level of the context', () => {
    expect(layout.moved).toHaveLength(Object.keys(TO_COME).length);
    expect(walk(root, BILLING).filter((file) => file.startsWith(`${BILLING}/test/`))).toEqual([]);
  });

  it('leaves a file of a layer whose imports name two modules where it is, and names the command that moves it', () => {
    expect(exists(root, `${BILLING}/application/ports/ledger.port.ts`)).toBe(true);

    expect(layout.manual).toEqual([
      `${BILLING}/application/ports/ledger.port.ts names no module, or two, by what it imports: it stays where it is. Move it with \`ddd-ts-kit move-to-module billing <module> application/ports/ledger.port.ts\`.`,
    ]);
  });

  it('rewrites the imports of what moved, in a file that moved and in one that stayed', () => {
    expect(read(root, `${BILLING}/shared/test/unit/tenant.guard.spec.ts`)).toBe(
      from('shared/presentation/http/guards/tenant.guard'),
    );

    expect(read(root, `${BILLING}/application/ports/ledger.port.ts`)).toContain(
      'invoices/domain/aggregates/invoice.aggregate',
    );
  });

  it('moves nothing on a second run', () => {
    const again = laidOut(root);

    expect(again.moved).toEqual([]);
    expect(again.rewritten).toEqual([]);
    expect(again.manual).toHaveLength(1);
  });
});

describe('context-layout, what it never does', () => {
  it('overwrites no file already at its target: both stay, and the pair is listed', () => {
    const root = projectWith({
      'invoices/domain/aggregates/invoice.aggregate.ts': '',
      'invoices/test/builders/invoice.builder.ts': 'export const kept = 1;\n',
      'test/builders/invoice.builder.ts': 'export const left = 1;\n',
    });

    const layout = laidOut(root);

    expect(layout.moved).toEqual([]);
    expect(read(root, `${BILLING}/invoices/test/builders/invoice.builder.ts`)).toBe('export const kept = 1;\n');
    expect(read(root, `${BILLING}/test/builders/invoice.builder.ts`)).toBe('export const left = 1;\n');

    expect(layout.manual).toEqual([
      expect.stringContaining(
        `${BILLING}/test/builders/invoice.builder.ts and ${BILLING}/invoices/test/builders/invoice.builder.ts both exist`,
      ),
    ]);
  });

  it('moves nothing of a context that declares no module', () => {
    const root = tempDir('context-layout-no-module');
    const config = { contexts: { billing: { classification: 'core' } } };

    write(root, 'ddd-ts-kit.config.json', JSON.stringify(config));
    write(root, `${BILLING}/infrastructure/persistence/billing.schema.ts`, '');
    write(root, `${BILLING}/test/fakes/clock.fake.ts`, '');

    expect(contextLayout(new Workspace(root, false), parseConfig(config), []).moved).toEqual([]);
  });
});

describe('context-layout, what names the tables of a context from outside it', () => {
  const SCHEMA = {
    'infrastructure/persistence/billing.schema.ts': '',
    'invoices/domain/events/invoice-issued.event.ts': '',
  };

  const KNEX = { 'infrastructure/persistence/create-billing-tables.schema.ts': '', ...SCHEMA };

  it.each([
    ['drizzle', "export * from '@/contexts/billing/infrastructure/persistence/billing.schema';\n", 'billing.schema'],
    [
      'typeorm',
      "import { invoices } from '@/contexts/billing/infrastructure/persistence/billing.schema.js';\n\nexport const entities = [invoices];\n",
      'billing.schema.js',
    ],
    [
      'knex',
      "import { createBillingTables } from '../../contexts/billing/infrastructure/persistence/create-billing-tables.schema';\n",
      'create-billing-tables.schema',
    ],
  ])('keeps the schema index of %s on the tables of the context, in shared', (_orm, index, named) => {
    const root = projectWith(KNEX, { [INDEX]: index });
    const { rewritten } = laidOut(root);

    expect(rewritten).toContain(INDEX);
    expect(read(root, INDEX)).toContain(`/contexts/billing/shared/infrastructure/persistence/${named}'`);
  });

  it('keeps a migration of Knex on the compiled schema it imports, and leaves the other imports of the migration', () => {
    const migration =
      "import { addNotes } from '../dist/src/contexts/billing/infrastructure/persistence/billing.schema.js';\nimport { createTables } from '../dist/src/platform/database/schema.js';\n";

    const root = projectWith(SCHEMA, { [MIGRATION]: migration, 'migrations/meta/_journal.json': '{}' });
    const { rewritten } = laidOut(root);

    expect(rewritten).toContain(MIGRATION);

    expect(read(root, MIGRATION)).toBe(
      migration.replace('billing/infrastructure/persistence', 'billing/shared/infrastructure/persistence'),
    );
  });
});

describe('context-layout, what it says and writes of the tools of the project', () => {
  const MOVED_SPEC = {
    'invoices/domain/aggregates/invoice.aggregate.ts': '',
    'test/integration/invoices/invoice.aggregate.spec.ts': '',
    'test/fakes/invoice.repository.fake.ts': '',
  };

  it('names the fakes and worlds of the test folder of a module among the entries of knip that name those of the context', () => {
    const entry = ['src/**/*.spec.ts', 'src/contexts/*/test/fakes/*.ts', 'src/contexts/*/test/worlds/*.ts'];

    const root = projectWith(MOVED_SPEC, {
      'knip.json': JSON.stringify({ project: ['src/**/*.ts'], vitest: { entry } }),
    });

    laidOut(root);

    expect(JSON.parse(read(root, 'knip.json'))).toEqual({
      project: ['src/**/*.ts'],
      vitest: {
        entry: [
          'src/**/*.spec.ts',
          'src/contexts/*/test/fakes/*.ts',
          'src/contexts/*/*/test/fakes/*.ts',
          'src/contexts/*/test/worlds/*.ts',
          'src/contexts/*/*/test/worlds/*.ts',
        ],
      },
    });

    // Run again on a context left as it was: the entries are there, nothing is added twice.
    write(root, `${BILLING}/test/fakes/clock.fake.ts`, '');
    laidOut(root);

    expect((JSON.parse(read(root, 'knip.json')) as { vitest: { entry: string[] } }).vitest.entry).toHaveLength(5);
  });

  it('leaves a knip config that is not plain JSON, or that enters by no fake', () => {
    const commented = '// knip\n{}\n';
    const plain = `${JSON.stringify({ entry: ['src/main.ts'], vitest: { entry: ['src/**/*.spec.ts'] } })}\n`;

    for (const knip of [commented, plain]) {
      const root = projectWith(MOVED_SPEC, { 'knip.json': knip });

      laidOut(root);

      expect(read(root, 'knip.json')).toBe(knip);
    }
  });

  it('says which config of a test runner still names the integration specs of the contexts alone', () => {
    const root = projectWith(MOVED_SPEC, {
      'vitest.config.ts': "const INTEGRATION_SPECS = 'src/contexts/*/test/integration/**/*.spec.ts';\n",
      'vitest.mutation.config.ts':
        "export default { exclude: ['src/contexts/*/test/integration/**', 'src/contexts/*/*/test/integration/**'] };\n",
      'jest.mutation.config.js': "export default { ignore: ['/src/contexts/[^/]+/test/integration/'] };\n",
    });

    const said = laidOut(root).manual;

    expect(said).toHaveLength(2);
    expect(said[0]).toContain('vitest.config.ts names the integration specs of the test folder of each context alone');
    expect(said[1]).toContain('jest.mutation.config.js names the integration specs');
  });

  it('says which rules of the tests written for the agents still name the test folder of the contexts alone', () => {
    const root = projectWith(MOVED_SPEC, {
      '.claude/rules/tests.md': '---\npaths:\n  - "src/contexts/*/test/**"\n---\n',
      '.github/instructions/tests.instructions.md':
        '---\napplyTo: "src/contexts/*/test/**,src/contexts/*/*/test/**,**/*.spec.ts"\n---\n',
    });

    expect(laidOut(root).manual).toEqual([
      '.claude/rules/tests.md names the test folder of each context alone: name the test folder of its modules beside it (src/contexts/*/*/test/**), or the rules of the tests no longer reach a spec a module keeps.',
    ]);
  });

  it('says nothing of the configs when no file of the tests moved, or when they name both places', () => {
    const upToDate = "export default { ignore: ['/src/contexts/[^/]+/(?:test|[^/]+/test)/integration/'] };\n";

    expect(laidOut(projectWith(MOVED_SPEC, { 'jest.mutation.config.js': upToDate })).manual).toEqual([]);

    const noTest = projectWith(
      { 'infrastructure/persistence/billing.schema.ts': '' },
      { 'vitest.config.ts': "const INTEGRATION_SPECS = 'src/contexts/*/test/integration/**/*.spec.ts';\n" },
    );

    expect(laidOut(noTest).manual).toEqual([]);
  });
});
