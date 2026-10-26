import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, exists, read } from './helpers';
import { report } from './reports';
import { initProject } from './support/init-project';

const BILLING = 'src/contexts/billing';
const CODEC = `${BILLING}/infrastructure/persistence/ledger-events.mapper.ts`;

describe('generate repository on an event-sourced aggregate', () => {
  const LEDGER_TERMS = ['--term', 'Ledger=The payments of a customer', '--term', 'Create=To open'];
  const ADAPTER = `${BILLING}/infrastructure/persistence/event-store-ledger.repository.ts`;
  const FAKE = `${BILLING}/test/fakes/ledger.repository.fake.ts`;
  const CONTRACT = `${BILLING}/test/integration/ledger.repository.contract.spec.ts`;

  function ledgerProject(...initFlags: string[]): string {
    const project = initProject('--context', 'billing:core', '--event-sourcing', 'on', ...initFlags);
    const generated = cli(project, 'generate', 'aggregate', 'billing', 'Ledger', '--event-sourced', ...LEDGER_TERMS);

    expect(generated.code, generated.stderr).toBe(0);

    return project;
  }

  it.each(['drizzle', 'knex', 'prisma', 'typeorm'])(
    'writes the adapter over EventSourcedRepository, its fake and the contract, and no table nor row mapper on %s',
    (orm) => {
      const project = ledgerProject('--orm', orm);
      const generated = report(cli(project, 'generate', 'repository', 'billing', 'Ledger', '--json'));

      expect(generated.created.slice(0, 4)).toEqual([
        `${BILLING}/domain/repositories/ledger.repository.ts`,
        ADAPTER,
        FAKE,
        CONTRACT,
      ]);

      const adapter = read(project, ADAPTER);

      expect(adapter).toContain('export class EventStoreLedgerRepository implements LedgerRepository {');
      expect(adapter).toContain("category: 'billing.ledger',");
      expect(adapter).toContain('serializer: new EventSerializer<LedgerEvent>(ledgerEvents, { cipher }),');
      expect(adapter).toContain('TODO(domain)');
      expect(adapter).not.toContain(orm === 'typeorm' ? 'TypeOrm' : `${orm[0]?.toUpperCase()}${orm.slice(1)}Ledger`);

      expect(read(project, FAKE)).toContain('readonly store = new InMemoryEventStore();');
      expect(read(project, CONTRACT)).toContain("name: 'FakeLedgerRepository'");
      expect(read(project, CONTRACT)).toContain('on the in-memory event store');
      expect(exists(project, `${BILLING}/infrastructure/persistence/ledger.mapper.ts`)).toBe(false);
      expect(exists(project, `${BILLING}/infrastructure/persistence/billing.schema.ts`)).toBe(false);
      expect(generated.notes.join('\n')).toContain('there is no table');
    },
  );

  it('binds the adapter to the event store of the platform on a platform wired by hand, when a use case first needs it', () => {
    const project = ledgerProject('--di', 'manual', '--orm', 'knex');

    cli(project, 'generate', 'repository', 'billing', 'Ledger');

    expect(exists(project, `${BILLING}/billing.module.ts`)).toBe(true);

    const generated = cli(
      project,
      'generate',
      'command',
      'billing',
      'CloseLedger',
      '--aggregate',
      'Ledger',
      ...LEDGER_TERMS,
      '--term',
      'Close=To end',
      '--public',
    );

    expect(generated.code, generated.stderr).toBe(0);

    expect(read(project, `${BILLING}/billing.module.ts`).replaceAll(/\s+/g, ' ')).toContain(
      'new EventStoreLedgerRepository(platform.eventSourcing.events, platform.eventSourcing.cipher)',
    );
  });

  it('binds the adapter to the stores of the kernel on tsyringe with the explicit style', () => {
    const project = ledgerProject('--style', 'explicit');

    cli(project, 'generate', 'repository', 'billing', 'Ledger');

    expect(read(project, `${BILLING}/billing.module.ts`).replaceAll(/\s+/g, ' ')).toContain(
      '.toClass(EventStoreLedgerRepository, [EventStore, PersonalDataCipher])',
    );
  });

  it('keeps the table adapter for an aggregate that is not event-sourced', () => {
    const project = ledgerProject();

    cli(project, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=A request for payment');

    const generated = report(cli(project, 'generate', 'repository', 'billing', 'Invoice', '--json'));

    expect(generated.created).toContain(`${BILLING}/infrastructure/persistence/invoice.mapper.ts`);
  });

  it('says what to write when the codec of its stored events is gone, and refuses columns', () => {
    const project = ledgerProject();
    const refusedColumns = cli(project, 'generate', 'repository', 'billing', 'Ledger', '--personal', 'holder');

    expect(refusedColumns.code).not.toBe(0);
    expect(refusedColumns.stderr).toContain('an event-sourced aggregate has none');

    fs.rmSync(path.join(project, CODEC));

    const refused = cli(project, 'generate', 'repository', 'billing', 'Ledger');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('the codec of its stored events is missing');
    expect(exists(project, ADAPTER)).toBe(false);
  });
});
