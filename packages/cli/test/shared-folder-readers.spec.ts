import { describe, expect, it } from 'vitest';
import { reachOf } from '../src/affected/reach-of';
import { parseConfig } from '../src/config';
import { testFiles } from '../src/depcruise/test-files';
import { readRouteGroups } from '../src/describe/read-route-groups';
import { describeOnDisk } from '../src/docs/describe-on-disk';
import { readContexts } from '../src/docs/read-contexts';
import { writeBehaviour } from '../src/docs/write-behaviour';
import { contextFakes } from '../src/generate/kinds/world/context-fakes';
import { contextWorld } from '../src/generate/kinds/world/context-world';
import { rewirePersonalData } from '../src/init/rewire-personal-data';
import { rewireTables } from '../src/init/rewire-tables';
import { warnDroppedContextTables } from '../src/migration';
import { contextLevelFolderOf, heldFileOf, moduleTestFolderOf } from '../src/model-modules';
import { toName } from '../src/naming';
import { NO_FLAGS } from '../src/presets/no-flags';
import { Workspace } from '../src/workspace';
import { tempDir, write } from './helpers';
import { specOf } from './support/behaviour-project';

const BILLING = 'src/contexts/billing';
const SHARED = `${BILLING}/shared`;
const INVOICES = `${BILLING}/invoices`;
const TREE = { directory: BILLING, modules: ['invoices'] };
const DIVIDED = { contexts: { billing: { classification: 'core', modules: { invoices: {} } } } };
const CONFIG = parseConfig(DIVIDED);

/** A project whose context billing is divided into the module invoices, holding `files`, and a workspace on it. */
function divided(files: Readonly<Record<string, string>>, config: object = DIVIDED): { root: string; ws: Workspace } {
  const root = tempDir('shared-folder-readers');

  write(root, 'ddd-ts-kit.config.json', JSON.stringify(config));

  for (const [file, content] of Object.entries(files)) {
    write(root, file, content);
  }

  return { root, ws: new Workspace(root, false) };
}

describe('where a reader finds what a context divided into modules keeps', () => {
  it('finds a file of the context where it is: at its level, in shared or in a module', () => {
    const { ws } = divided({
      [`${SHARED}/presentation/http/billing.routes.ts`]: '',
      [`${INVOICES}/infrastructure/persistence/invoice.repository.ts`]: '',
      [`${BILLING}/test/worlds/billing.world.ts`]: '',
    });

    expect(heldFileOf(ws, TREE, 'presentation/http/billing.routes.ts')).toBe(
      `${SHARED}/presentation/http/billing.routes.ts`,
    );

    expect(heldFileOf(ws, TREE, 'infrastructure/persistence/invoice.repository.ts')).toBe(
      `${INVOICES}/infrastructure/persistence/invoice.repository.ts`,
    );

    expect(heldFileOf(ws, TREE, 'test/worlds/billing.world.ts')).toBe(`${BILLING}/test/worlds/billing.world.ts`);

    expect(heldFileOf(ws, TREE, 'test/unit/billing.routes.spec.ts')).toBe(
      `${BILLING}/test/unit/billing.routes.spec.ts`,
    );
  });

  it('names the folder of shared once the context holds it, and the folder of the context before', () => {
    const { ws } = divided({ [`${SHARED}/presentation/http/billing.routes.ts`]: '' });

    expect(contextLevelFolderOf(ws, TREE, 'presentation/http')).toBe(`${SHARED}/presentation/http`);
    expect(contextLevelFolderOf(ws, TREE, 'infrastructure/persistence')).toBe(`${BILLING}/infrastructure/persistence`);

    expect(contextLevelFolderOf(ws, { directory: BILLING, modules: [] }, 'presentation/http')).toBe(
      `${BILLING}/presentation/http`,
    );
  });

  it('names the test folder of a module once it holds one, and the folder of the context named after it before', () => {
    const { ws } = divided({ [`${INVOICES}/test/builders/invoice.builder.ts`]: '' });

    expect(moduleTestFolderOf(ws, TREE, { module: 'invoices', folder: 'unit' })).toBe(`${INVOICES}/test/unit`);

    expect(moduleTestFolderOf(ws, TREE, { module: 'reminders', folder: 'unit' })).toBe(
      `${BILLING}/test/unit/reminders`,
    );

    expect(moduleTestFolderOf(ws, TREE, { module: undefined, folder: 'integration' })).toBe(
      `${BILLING}/test/integration`,
    );
  });
});

describe('describe and docs, on a context divided into modules', () => {
  it('reads a route group of shared, and one a module holds', () => {
    const { ws } = divided({
      [`${SHARED}/presentation/http/invoices.routes.ts`]:
        "@RouteGroup({ prefix: '/invoices', tags: ['Invoices'] })\nexport class InvoicesRoutes {}\n",
      [`${INVOICES}/presentation/http/drafts.routes.ts`]:
        "@RouteGroup({ parent: InvoicesRoutes, prefix: '/drafts' })\nexport class DraftsRoutes {}\n",
    });

    const groups = readRouteGroups(ws, TREE);

    expect(groups.get('InvoicesRoutes')).toMatchObject({ prefix: '/invoices', tags: ['Invoices'] });
    expect(groups.get('DraftsRoutes')).toMatchObject({ prefix: '/invoices/drafts' });
  });

  /** The behaviour page of billing, its specs written where `place` puts each one. */
  function behaviourPage(place: (folder: string, name: string) => string): string {
    const { ws } = divided({
      [`${INVOICES}/domain/value-objects/money.vo.ts`]: 'export class Money {}\n',
      [`${BILLING}/${place('unit', 'money.vo.spec.ts')}`]: specOf('Money', ['adds two amounts of one currency']),
      [`${BILLING}/${place('integration', 'ledger.reader.spec.ts')}`]: specOf('Ledger', ['reads what was written']),
      [`${BILLING}/test/unit/rounding.spec.ts`]: specOf('Rounding', ['rounds half up']),
    });

    writeBehaviour(ws, CONFIG, describeOnDisk(ws, CONFIG, readContexts(ws, CONFIG)));

    return ws.read('docs/behaviour/billing.md') ?? '';
  }

  it('writes the same behaviour page wherever a module keeps its specs, but for the place it names', () => {
    const today = behaviourPage((folder, name) => `test/${folder}/invoices/${name}`);
    const toCome = behaviourPage((folder, name) => `invoices/test/${folder}/${name}`);

    expect(toCome).toContain('adds two amounts of one currency');
    expect(toCome).toContain('reads what was written');
    expect(toCome).toContain('`invoices/test/unit/money.vo.spec.ts`');
    expect(toCome).toContain('`invoices/test/integration/ledger.reader.spec.ts`');

    expect(
      toCome
        .replace('invoices/test/unit/money.vo.spec.ts', 'unit/invoices/money.vo.spec.ts')
        .replace('invoices/test/integration/ledger.reader.spec.ts', 'integration/invoices/ledger.reader.spec.ts'),
    ).toBe(today);
  });
});

describe('generate test-world, on a context divided into modules', () => {
  const scope = (ws: Workspace) => ({ ws, config: CONFIG, context: toName('billing'), dir: BILLING, flags: NO_FLAGS });
  const port = (name: string): string => `export abstract class ${name} {}\n`;
  const fake = (name: string): string => `export class Fake${name} implements ${name} {}\n`;

  it('reads the fakes of a module and of shared with those of the context, and no class of a test folder', () => {
    const { ws } = divided({
      [`${INVOICES}/application/ports/payment-gateway.port.ts`]: port('PaymentGateway'),
      [`${INVOICES}/application/ports/tax-rates.port.ts`]: port('TaxRates'),
      [`${INVOICES}/application/ports/ledger.port.ts`]: port('Ledger'),
      [`${INVOICES}/test/fakes/payment-gateway.fake.ts`]: fake('PaymentGateway'),
      [`${SHARED}/test/fakes/tax-rates.fake.ts`]: fake('TaxRates'),
      [`${BILLING}/test/fakes/ledger.fake.ts`]: fake('Ledger'),
      [`${INVOICES}/test/fakes/recording.ts`]: 'export class Recording extends PaymentGateway {}\n',
      [`${INVOICES}/test/fakes/recording-gateway.fake.ts`]: 'export class RecordingGateway extends Recording {}\n',
    });

    const read = contextFakes(scope(ws));
    const said = [...read.fakes.map((found) => found.name), ...read.leftOut].join('\n');

    expect(said).toContain('FakePaymentGateway');
    expect(said).toContain('FakeTaxRates');
    expect(said).toContain('FakeLedger');
    // A class of a test folder is no class of the context a fake may extend to stand for a port.
    expect(said).toContain('RecordingGateway implements no port of the context');
  });

  it('reads the world of the context from shared', () => {
    const { ws } = divided({ [`${SHARED}/test/worlds/billing.world.ts`]: 'export const nothing = 1;\n' });

    expect(contextWorld(scope(ws)).kind).not.toBe('absent');
    expect(contextWorld(scope(divided({}).ws)).kind).toBe('absent');
  });
});

describe('the wiring of the platform, on a context divided into modules', () => {
  const INDEX = 'src/platform/database/schema.ts';
  const REGIONS = '// ddd-ts-kit:imports\n// /ddd-ts-kit:imports\n// ddd-ts-kit:schemas\n// /ddd-ts-kit:schemas\n';
  const TABLES = "export const invoices = billingSchema.table('invoices', { id: text('id') });\n";

  it('lists again the tables of a context whose tables file sits in shared', () => {
    const { ws } = divided({ [INDEX]: REGIONS, [`${SHARED}/infrastructure/persistence/billing.schema.ts`]: TABLES });

    rewireTables(ws, parseConfig({ ...DIVIDED, stack: { orm: 'drizzle' } }), 'billing');

    expect(ws.read(INDEX)).toContain('billing.schema');
  });

  it('lists again the erasure of a context whose adapter sits in a module', () => {
    const copies = 'src/platform/privacy/data-subject-copies.ts';
    const config = parseConfig({ ...DIVIDED, stack: { orm: 'drizzle', privacy: 'on' } });

    const { ws } = divided({
      [copies]: '// ddd-ts-kit:imports\n// /ddd-ts-kit:imports\n// ddd-ts-kit:copies\n// /ddd-ts-kit:copies\n',
      [`${INVOICES}/infrastructure/persistence/drizzle-billing-personal-data-erasure.repository.ts`]:
        'export class DrizzleBillingPersonalDataErasure {}\n',
    });

    rewirePersonalData(ws, config, 'billing');

    expect(ws.read(copies)).toContain('BillingPersonalDataErasure');
  });

  it('warns of the tables of shared that a migration would drop', () => {
    const { root } = divided({
      [INDEX]: REGIONS,
      [`${SHARED}/infrastructure/persistence/billing.schema.ts`]: TABLES,
      'migrations/meta/_journal.json': JSON.stringify({ entries: [{ idx: 0, tag: '20260101120000_invoices' }] }),
      'migrations/meta/20260101120000_snapshot.json': JSON.stringify({
        tables: { 'billing.invoices': { name: 'invoices', schema: 'billing' } },
      }),
    });

    const lines: string[] = [];

    warnDroppedContextTables(root, { out: () => undefined, err: (text) => lines.push(text) });

    expect(lines.join('\n')).toContain('drops the tables of the context billing (billing.invoices)');
  });
});

describe('what a change of a test folder reaches, and what dependency-cruiser holds for test code', () => {
  it('reaches the tests alone for a file of the test folder of a module or of shared', () => {
    const testsOnly = (file: string): unknown => reachOf(CONFIG, `${BILLING}/${file}`);

    expect(testsOnly('invoices/test/unit/money.vo.spec.ts')).toEqual({
      kind: 'context',
      context: 'billing',
      testsOnly: true,
    });

    expect(testsOnly('shared/test/worlds/billing.world.ts')).toMatchObject({ testsOnly: true });
    expect(testsOnly('test/builders/invoice.builder.ts')).toMatchObject({ testsOnly: true });
    expect(testsOnly('invoices/domain/value-objects/money.vo.ts')).toMatchObject({ testsOnly: false });
    expect(testsOnly('shared/infrastructure/persistence/billing.schema.ts')).toMatchObject({ testsOnly: false });
    // A folder the config does not declare as a module holds no test folder the kit knows.
    expect(testsOnly('drafts/test/unit/draft.spec.ts')).toMatchObject({ testsOnly: false });
  });

  it('holds the test folder of a context, of a module and of shared as test code, and no deeper folder named test', () => {
    const [ofContexts = ''] = testFiles(CONFIG);
    const isTest = (file: string): boolean => new RegExp(ofContexts).test(`${BILLING}/${file}`);

    expect(isTest('test/fakes/clock.fake.ts')).toBe(true);
    expect(isTest('invoices/test/builders/invoice.builder.ts')).toBe(true);
    expect(isTest('shared/test/worlds/billing.world.ts')).toBe(true);
    expect(isTest('invoices/domain/test/money.ts')).toBe(false);
    expect(isTest('invoices/domain/value-objects/money.vo.ts')).toBe(false);
  });
});
