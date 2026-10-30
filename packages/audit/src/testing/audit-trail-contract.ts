import {
  cursorPage,
  offsetPage,
  type AuditEntry,
  type AuditFilter,
  type AuditRecord,
  type AuditSortField,
  type Sort,
} from '@ddd-ts-kit/kernel';
import { ContractSuite, type Awaitable, type ContractRunner } from '@ddd-ts-kit/testing/contracts';
import { GENESIS_HASH } from '../chain/genesis-hash';
import { hashOf } from '../chain/hash-of';
import { verifyChain } from '../verify/verify-chain';
import type { AuditTrailUnderContract } from './audit-trail-under-contract';
import { entriesOf } from './entries-of';
import { aRecord } from './records/a-record';
import { fullRecord } from './records/full-record';
import { inTenant } from './records/in-tenant';
import { JOURNAL } from './records/journal';
import { later } from './records/later';
import { recordAll } from './record-all';
import { SealedTextsSuite } from './sealed-texts-suite';

export interface AuditTrailContractOptions {
  readonly name: string;
  /** A fresh, empty trail with the default chains (one per tenant, `global` otherwise); called before each test. */
  createTrail(): Awaitable<AuditTrailUnderContract>;
  /**
   * Rewrites the stored `action` of this entry behind the back of the trail, the way somebody
   * with access to the storage would. When absent, tampering is only checked on what was read.
   */
  readonly tamper?: (entry: AuditEntry, action: string) => Awaitable<void>;
}

/** What every audit trail, fake or real, guarantees to the sources and to the reader. */
export function auditTrailContract(runner: ContractRunner, options: AuditTrailContractOptions): void {
  new AuditTrailSuite(runner, options).describe(`${options.name} (audit trail contract)`);
  new SealedTextsSuite(runner, () => options.createTrail()).describe(`${options.name} (audit trail contract: texts)`);
}

const ALPHA = 'tenant:alpha';
const BY_SEQUENCE: readonly Sort<AuditSortField>[] = [{ field: 'sequence', direction: 'asc' }];

class AuditTrailSuite extends ContractSuite<AuditTrailUnderContract> {
  private readonly options: AuditTrailContractOptions;

  constructor(runner: ContractRunner, options: AuditTrailContractOptions) {
    super(runner, () => options.createTrail());
    this.options = options;
  }

  protected tests(): void {
    this.appends();
    this.numbersEachChain();
    this.chainsTheEntries();
    this.detectsTampering();
    this.neverForks();
    this.filters();
    this.paginates();
  }

  private appends(): void {
    this.it('starts empty', async () => {
      this.expect(await this.subject.search({}, offsetPage())).toEqual({ items: [], total: 0 });
    });

    this.it('gives back what was recorded, sealed as the first entry of its chain', async () => {
      const record = fullRecord('entry-1');

      await this.subject.record(record);

      const [entry] = await this.all();

      this.expect(entry).toEqual({
        ...record,
        chain: ALPHA,
        sequence: 1,
        previousHash: GENESIS_HASH,
        hash: entry?.hash,
      });

      this.expect(entry === undefined ? undefined : hashOf(entry)).toBe(entry?.hash);
    });

    this.it('leaves out what a record does not carry', async () => {
      await this.subject.record(aRecord('entry-1'));

      const [entry] = await this.all();

      this.expect(entry).toEqual({
        ...aRecord('entry-1'),
        extensions: {},
        chain: 'global',
        sequence: 1,
        previousHash: GENESIS_HASH,
        hash: entry?.hash,
      });
    });
  }

  private numbersEachChain(): void {
    this.it('numbers the entries of each chain from 1, without a gap', async () => {
      await this.recordAll([
        inTenant('a-1', 'alpha'),
        inTenant('b-1', 'beta'),
        inTenant('a-2', 'alpha'),
        aRecord('g-1'),
        inTenant('a-3', 'alpha'),
      ]);

      this.expect(await this.sequencesOf(ALPHA)).toEqual([1, 2, 3]);
      this.expect(await this.sequencesOf('tenant:beta')).toEqual([1]);
      this.expect(await this.sequencesOf('global')).toEqual([1]);
    });
  }

  private chainsTheEntries(): void {
    this.it('links each entry to the hash of the one before it', async () => {
      await this.recordAll([inTenant('a-1', 'alpha'), inTenant('a-2', 'alpha'), inTenant('a-3', 'alpha')]);

      const entries = await this.entriesOf(ALPHA);

      this.expect(entries.map((entry) => entry.previousHash)).toEqual([
        GENESIS_HASH,
        entries[0]?.hash,
        entries[1]?.hash,
      ]);

      this.expect(await verifyChain(this.subject, { chain: ALPHA })).toEqual({ valid: true, checked: 3 });
      this.expect(await verifyChain(entries)).toEqual({ valid: true, checked: 3 });
    });

    this.it('verifies a range of a chain read page by page', async () => {
      await this.recordAll(Array.from({ length: 7 }, (_, index) => inTenant(`a-${index}`, 'alpha')));

      this.expect(await verifyChain(this.subject, { chain: ALPHA, from: 3, to: 6 })).toEqual({
        valid: true,
        checked: 4,
      });

      const beyond = await verifyChain(this.subject, { chain: ALPHA, to: 9 });

      this.expect(beyond).toEqual({
        valid: false,
        checked: 7,
        break: { kind: 'missing-entry', chain: ALPHA, position: 7, sequence: 8 },
      });
    });
  }

  private detectsTampering(): void {
    this.it('shows an entry whose content was changed after it was read', async () => {
      await this.recordAll([inTenant('a-1', 'alpha'), inTenant('a-2', 'alpha'), inTenant('a-3', 'alpha')]);
      const entries = await this.entriesOf(ALPHA);

      const altered: AuditEntry[] = entries.map((entry) =>
        entry.sequence === 2 ? { ...entry, outcome: 'failed' } : entry,
      );

      const altering = { kind: 'altered-content', chain: ALPHA, position: 1, sequence: 2, entryId: 'a-2' };

      this.expect(await verifyChain(altered)).toEqual({ valid: false, checked: 1, break: altering });
    });

    const { tamper } = this.options;

    if (tamper === undefined) {
      return;
    }

    this.it('shows an entry rewritten in the storage itself', async () => {
      await this.recordAll([inTenant('a-1', 'alpha'), inTenant('a-2', 'alpha'), inTenant('a-3', 'alpha')]);
      const [, second] = await this.entriesOf(ALPHA);

      if (second === undefined) {
        throw new Error('The second entry of the chain was not listed');
      }

      await tamper(second, 'contract.thing.forged');

      const altering = { kind: 'altered-content', chain: ALPHA, position: 1, sequence: 2, entryId: 'a-2' };

      this.expect(await verifyChain(this.subject, { chain: ALPHA })).toEqual({
        valid: false,
        checked: 1,
        break: altering,
      });
    });
  }

  private neverForks(): void {
    this.it('gives concurrent appends to one chain a position each', async () => {
      const records = Array.from({ length: 12 }, (_, index) => inTenant(`a-${index}`, 'alpha'));

      await Promise.all([...records, inTenant('b-1', 'beta')].map((record) => this.subject.record(record)));

      this.expect(await this.sequencesOf(ALPHA)).toEqual(records.map((_, index) => index + 1));
      this.expect(await verifyChain(this.subject, { chain: ALPHA })).toEqual({ valid: true, checked: 12 });
      this.expect(await verifyChain(this.subject, { chain: 'tenant:beta' })).toEqual({ valid: true, checked: 1 });
    });
  }

  private filters(): void {
    const cases: readonly (readonly [string, AuditFilter, readonly string[]])[] = [
      ['actor', { actorId: 'grace' }, ['e-2', 'e-4']],
      ['resource', { resource: { type: 'appointment', id: 'apt-1' } }, ['e-1', 'e-4']],
      ['resource type', { resource: { type: 'appointment' } }, ['e-1', 'e-3', 'e-4']],
      ['action', { action: 'scheduling:appointment.read' }, ['e-2']],
      ['category', { category: 'authorization' }, ['e-2', 'e-3']],
      ['outcome', { outcome: 'denied' }, ['e-3']],
      ['period', { from: later(1), to: later(3) }, ['e-2', 'e-3']],
      ['correlation id', { correlationId: 'correlation-2' }, ['e-3', 'e-4']],
      ['tenant', { tenantId: 'beta' }, ['e-4']],
      ['chain and positions', { chain: ALPHA, fromSequence: 2, toSequence: 3 }, ['e-2', 'e-3']],
      ['several criteria at once', { actorId: 'ada', category: 'authorization' }, ['e-3']],
    ];

    for (const [criterion, filter, expected] of cases) {
      this.it(`searches by ${criterion}`, async () => {
        await this.recordAll(JOURNAL);

        const page = await this.subject.search(filter, offsetPage());

        this.expect(page.items.map((entry) => entry.id)).toEqual(expected);
        this.expect(page.total).toBe(expected.length);
      });
    }
  }

  private paginates(): void {
    this.it('cuts an offset page out of the whole and counts the whole', async () => {
      await this.recordAll(JOURNAL);

      const page = await this.subject.search({}, offsetPage({ offset: 1, limit: 2 }));

      this.expect(page.items.map((entry) => entry.id)).toEqual(['e-2', 'e-3']);
      this.expect(page.total).toBe(4);
    });

    this.it('walks every entry once by cursor, oldest first, then says there is no more', async () => {
      await this.recordAll(JOURNAL);

      this.expect(await this.walk([])).toEqual(['e-1', 'e-2', 'e-3', 'e-4']);
    });

    this.it('walks newest first when asked', async () => {
      await this.recordAll(JOURNAL);

      this.expect(await this.walk([{ field: 'occurredAt', direction: 'desc' }])).toEqual(['e-4', 'e-3', 'e-2', 'e-1']);
    });

    this.it('walks chain by chain when sorted by sequence', async () => {
      await this.recordAll(JOURNAL);

      const ids = await this.walk(BY_SEQUENCE);

      this.expect(ids.filter((id) => id !== 'e-4')).toEqual(['e-1', 'e-2', 'e-3']);
      this.expect(ids.length).toBe(4);
    });
  }

  private recordAll(records: readonly AuditRecord[]): Promise<void> {
    return recordAll(this.subject, records);
  }

  private async all(): Promise<readonly AuditEntry[]> {
    return (await this.subject.search({}, offsetPage({ limit: 100 }))).items;
  }

  private entriesOf(chain: string): Promise<readonly AuditEntry[]> {
    return entriesOf(this.subject, chain);
  }

  private async sequencesOf(chain: string): Promise<number[]> {
    return (await this.entriesOf(chain)).map((entry) => entry.sequence);
  }

  private async walk(sort: readonly Sort<AuditSortField>[]): Promise<string[]> {
    const ids: string[] = [];
    let cursor: string | undefined;

    do {
      const page = await this.subject.search(
        {},
        cursorPage({ limit: 3, sort, ...(cursor === undefined ? {} : { cursor }) }),
      );

      ids.push(...page.items.map((entry) => entry.id));
      cursor = page.nextCursor;
    } while (cursor !== undefined);

    return ids;
  }
}
