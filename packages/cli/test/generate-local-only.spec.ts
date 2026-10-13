import { beforeAll, describe, expect, it } from 'vitest';
import { KINDS } from '../src/generate/kinds.js';
import { SHARED_WRITES } from '../src/generate/shared-writes.js';
import { cli, exists, EXPLICIT_STACK, scaffoldEverything, tempDir } from './helpers.js';
import { jsonAt } from './support/json-at.js';
import { stringsAt } from './support/strings-at.js';

const SHARED_KINDS = [
  'adapter',
  'context',
  'repository',
  'command',
  'integration-event',
  'job',
  'policy',
  'gateway',
  'service',
  'worker',
  'adr',
  'schema',
  'route-group',
];

/** One run of every kind that declares it writes nothing shared, and of a command on an aggregate that has its repository. */
const LOCAL_RUNS: readonly (readonly string[])[] = [
  ['aggregate', 'billing', 'Price'],
  ['builder', 'billing', 'Invoice', '--force'],
  ['entity', 'billing', 'PriceLine'],
  ['value-object', 'billing', 'LinePrice'],
  ['domain-event', 'billing', 'Invoice', 'Cancelled'],
  ['error', 'billing', 'Invoice', 'alreadyCancelled'],
  ['domain-error', 'billing', 'InvoiceAlreadyCancelled', '--allow-name'],
  ['domain-service', 'billing', 'MonthlyPricing'],
  ['command', 'billing', 'MarkInvoiceAsPaid', '--aggregate', 'Invoice', '--permission', 'invoice.pay'],
  ['query', 'billing', 'SearchStaleInvoices', '--permission', 'invoice.search'],
  ['port', 'billing', 'InvoiceMailer', '--allow-name'],
  ['adapter', 'billing', 'PriceList'],
  ['route', 'billing', 'SearchInvoices', '--method', 'GET', '--path', '/stale-invoices', '--query', '--force'],
  ['controller', 'billing', 'SearchInvoices', '--method', 'GET', '--path', '/late-invoices', '--query', '--force'],
  ['route-group', 'billing', 'InvoiceAdministration', '--prefix', '/administration'],
  ['vocabulary', 'billing', 'InvoiceStatus', '--value', 'draft', '--value', 'issued'],
  ['guard', 'billing', 'OfficeHours'],
  ['integration-handler', 'shipping', 'billing', 'billing.invoice.issued', '--force'],
  ['event-handler', 'billing', 'Invoice', 'Cancelled'],
  ['projection', 'shipping', 'InvoicesToShip', 'billing.invoice.issued'],
  ['acl', 'billing', 'LegacyLedger', '--allow-name'],
  ['e2e', 'billing', 'SearchInvoices'],
];

describe('generate --help --json', () => {
  it('lists every kind with its usage, its aliases and whether it writes outside its context', () => {
    const kinds = jsonAt(cli(tempDir('kinds-help'), 'generate', '--help', '--json').json(), 'kinds');

    expect(kinds).toHaveLength(KINDS.length);

    expect(kinds).toContainEqual({
      name: 'value-object',
      aliases: ['vo'],
      usage: expect.stringContaining('value-object <context> <Name>'),
      summary: expect.any(String),
      writesShared: false,
      shared: [],
      sharedWhen: null,
    });

    expect(kinds).toContainEqual(
      expect.objectContaining({
        name: 'job',
        writesShared: true,
        shared: expect.arrayContaining(['<platformDir>/job-settings.ts']),
        sharedWhen: null,
      }),
    );

    expect(kinds).toContainEqual(
      expect.objectContaining({ name: 'policy', writesShared: true, sharedWhen: 'stack.style is explicit' }),
    );
  });

  it('declares shared exactly the kinds whose shared files are described', () => {
    const shared = KINDS.filter((kind) => kind.writesShared).map((kind) => kind.name);

    expect([...shared].sort()).toEqual([...SHARED_KINDS].sort());
    expect(Object.keys(SHARED_WRITES).sort()).toEqual([...SHARED_KINDS].sort());

    expect(LOCAL_RUNS.map(([kind]) => kind)).toEqual(
      expect.arrayContaining(KINDS.filter((kind) => !kind.writesShared).map((kind) => kind.name)),
    );
  });
});

/** A projection declares itself, which only the declared style assembles: `projection.spec.ts` holds the refusal of the other. */
const DECLARED_ONLY = ['projection'];

/** One class per error is the form of a project that does not build through factories: `generate-error.spec.ts` holds it. */
const CLASSES_ONLY = ['domain-error'];

describe.each([
  ['declared', undefined],
  ['explicit', EXPLICIT_STACK],
])('generate --local-only, in a %s project', (style, stack) => {
  let root: string;

  beforeAll(() => {
    root = tempDir(`local-only-${style}`);
    scaffoldEverything(root, stack);
    cli(root, 'generate', 'port', 'billing', 'PriceList');
  });

  const runs = runsOf(style);

  it.each(runs)('%s stays inside its context and the end-to-end specs', (...args) => {
    const planned = cli(root, 'generate', ...args, '--local-only', '--dry-run', '--json');

    const written = [...stringsAt(planned.json(), 'created'), ...stringsAt(planned.json(), 'updated')];

    expect(planned.stderr).toBe('');
    expect(planned.code).toBe(0);
    expect(written.length).toBeGreaterThan(0);

    expect(
      written.filter(
        (file) => !file.startsWith(`src/contexts/${args[1] ?? ''}/`) && !/^test\/e2e\/[^/]+\.e2e\.spec\.ts$/.test(file),
      ),
    ).toEqual([]);
  });

  it('refuses a kind that would write a shared file, names the file and writes nothing', () => {
    const refused = cli(
      root,
      'generate',
      'job',
      'billing',
      'RemindLateInvoices',
      '--every',
      '1h',
      '--command',
      'CancelInvoice',
      '--allow-name',
      '--local-only',
    );

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('--local-only: this command would write');
    expect(refused.stderr).toContain('src/platform/job-settings.ts');
    expect(refused.stderr).toContain('Nothing was written.');
    expect(exists(root, 'src/contexts/billing/application/scheduling/remind-late-invoices.job.ts')).toBe(false);
  });

  it('refuses a command that would create the repository of its aggregate, and a kind without a context', () => {
    cli(root, 'generate', 'aggregate', 'shipping', 'Parcel');

    const command = cli(
      root,
      'generate',
      'command',
      'shipping',
      'ShipParcel',
      '--aggregate',
      'Parcel',
      '--permission',
      'parcel.ship',
      '--term',
      'Ship=To hand a parcel to a carrier',
      '--local-only',
      '--json',
    );

    expect(command.code).toBe(2);
    expect(String(jsonAt(command.json(), 'error', 'message'))).toContain('src/platform/database/schema.ts');

    expect(cli(root, 'generate', 'context', 'catalog', '--classification', 'generic', '--local-only').stderr).toContain(
      'ddd-ts-kit.config.json',
    );

    expect(cli(root, 'generate', 'adr', 'Keep one repository', '--local-only').stderr).toContain(
      'docs/adr/0002-keep-one-repository.md',
    );

    expect(exists(root, 'src/contexts/catalog/CONTEXT.md')).toBe(false);
  });

  it('refuses a gateway: its contract lands in the published language of the upstream', () => {
    const refused = cli(
      root,
      'generate',
      'gateway',
      'shipping',
      'billing',
      'InvoiceLines',
      '--allow-name',
      '--local-only',
    );

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('src/contexts/billing/published-language/invoice-lines.contract.ts');
  });

  it('changes nothing to a run that writes nothing shared', () => {
    const local = cli(
      root,
      'generate',
      'value-object',
      'billing',
      'Currency',
      '--term',
      'Currency=The unit of an amount',
      '--local-only',
      '--json',
    );

    expect(local.code).toBe(0);

    expect(stringsAt(local.json(), 'created')).toEqual([
      'src/contexts/billing/domain/value-objects/currency.vo.ts',
      'src/contexts/billing/test/unit/currency.vo.spec.ts',
    ]);

    expect(exists(root, 'src/contexts/billing/domain/value-objects/currency.vo.ts')).toBe(true);
  });
});

function runsOf(style: string): readonly (readonly string[])[] {
  return LOCAL_RUNS.filter(
    ([kind = '']) => !CLASSES_ONLY.includes(kind) && (style === 'declared' || !DECLARED_ONLY.includes(kind)),
  );
}
