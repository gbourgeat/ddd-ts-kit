import type { Awaitable } from '../awaitable';
import type { ContractRunner } from '../contract-runner';
import { READ_MODEL_TABLE_SHAPES as TABLES } from './read-model-table-shapes';
import { ReadModelTablesSuite } from './read-model-tables-suite';
import type { ReadModelTablesUnderContract } from './read-model-tables-under-contract';

/**
 * What the list says of a table is what its store says before its first trace, shape by shape:
 * the fields that refuse NULL and no column the store does not map, what no migration opens, a
 * table that is not there, and what the definition of the store names where it has one.
 */
export class TableAgreementSuite extends ReadModelTablesSuite {
  constructor(
    runner: ContractRunner,
    createTables: () => Awaitable<ReadModelTablesUnderContract>,
    private readonly named: {
      readonly tenantColumn?: boolean;
      readonly renamedStamps?: boolean;
      readonly definition?: boolean;
    },
  ) {
    super(runner, createTables);
  }

  protected tests(): void {
    this.agreesOnTheFields();
    this.agreesOnWhatNoMigrationOpens();
    this.agreesOnTheTenantColumn();
    this.agreesOnTheStamp();
    this.agreesOnTheDefinition();
  }

  private agreesOnTheFields(): void {
    this.it('lets a ready table through, and its store writes the trace', async () => {
      const found = this.expected('ready_rows', { row: ['title'], constraint: { state: 'held', columns: ['title'] } });

      await this.agrees(TABLES.ready, found);
    });

    this.it(
      'refuses, as the store does, the fields that refuse NULL and no column the store does not map',
      async () => {
        await this.agrees(TABLES.agenda, this.agenda);
        await this.agrees(TABLES.contacts, this.contacts);
      },
    );

    this.it('refuses, as the store does, the tenant column a store of every tenant maps as a field', async () => {
      await this.agrees(
        TABLES.untenanted,
        this.expected('untenanted_rows', { refusing: ['tenant_id'], row: ['tenant_id', 'title'] }),
      );
    });
  }

  private agreesOnWhatNoMigrationOpens(): void {
    this.it(
      'refuses, as the store does, a part of the primary key mapped as a field, which no migration opens',
      async () => {
        const found = this.expected('composite_rows', {
          unfit: [{ column: 'region', because: 'primary-key' }],
          row: ['title'],
        });

        const refusal = await this.agrees(TABLES.composite, found);

        this.expect(refusal?.statements).toEqual([]);
        this.expect(refusal?.message.includes('"region" is part of the primary key')).toBe(true);
      },
    );

    this.it('refuses, as the store does, an identity and a generated column mapped as fields', async () => {
      const unfit = [
        { column: 'serial', because: 'identity' },
        { column: 'label_upper', because: 'generated' },
      ] as const;

      const refusal = await this.agrees(TABLES.computed, this.expected('computed_rows', { unfit, row: ['label'] }));

      this.expect(refusal?.statements).toEqual([]);
    });

    this.it('refuses, as the store does, a field of a domain that refuses NULL', async () => {
      const unfit = [{ column: 'title', because: 'domain' }] as const;
      const refusal = await this.agrees(TABLES.domained, this.expected('domained_rows', { unfit }));

      this.expect(refusal?.statements).toEqual([]);
      this.expect(refusal?.message.includes('"title" is of a domain that refuses NULL')).toBe(true);
    });

    this.it('refuses, as the store does, a table that is not in the database', async () => {
      const refusal = await this.agrees(TABLES.absent, this.expected('absent_rows', { exists: false }, 'unread'));

      this.expect(refusal?.message.includes('it is not in this database')).toBe(true);
    });
  }

  private agreesOnTheTenantColumn(): void {
    if (this.named.tenantColumn !== true) {
      this.todo('leaves the tenant out under the name the store gives its column (the store names no column)');

      return;
    }

    this.it('leaves the tenant out under the name the store gives its column', async () => {
      await this.agrees(TABLES.network, this.expected('network_rows', { refusing: ['status'], row: ['status'] }));
      await this.migrate(TABLES.network);

      this.expect(await this.refusingNull('network_rows')).toEqual([
        'deleted',
        'id',
        'last_event_at',
        'last_event_id',
        'network',
      ]);
    });
  }

  private agreesOnTheStamp(): void {
    if (this.named.renamedStamps !== true) {
      this.todo('writes the migration with the columns of the stamp as the definition names them (fixed names)');

      return;
    }

    this.it('writes the migration with the columns of the stamp as the definition names them', async () => {
      const found = this.expected('renamed_rows', { refusing: ['title'], row: ['title'], deleted: 'removed' });
      const refusal = await this.agrees(TABLES.renamed, found);

      this.expect(refusal?.statements.some((statement) => statement.includes('check ("removed" or ('))).toBe(true);

      await this.migrate(TABLES.renamed);

      this.expect(await this.traced(TABLES.renamed.shape)).toBe(undefined);
    });
  }

  private agreesOnTheDefinition(): void {
    if (this.named.definition !== true) {
      this.todo('reports a definition that refuses NULL over a table that is ready (no definition)');

      return;
    }

    this.it(
      'reports a definition that refuses NULL over a table that is ready, as the store refuses to be built',
      async () => {
        const found = this.expected('strict_definition_rows', { refusing: ['title'], row: ['title'] }, 'unread');
        const refusal = await this.agrees(TABLES.strict, found);

        this.expect(refusal?.statements).toEqual([]);
        this.expect(refusal?.message.includes('The definition the store reads says so')).toBe(true);
      },
    );
  }
}
