import { CONCURRENCY_CONFLICT, type EventStore } from '@ddd-ts-kit/kernel';
import { ContractSuite } from '../contract-suite';
import { failureOf } from '../failure-of';
import { eventOf } from './event-of';

/** One stream: appended at the version it was read at, read back in order, refused when somebody appended first. */
export class StreamSuite extends ContractSuite<EventStore> {
  protected tests(): void {
    this.appendsAndReads();
    this.readsWhatWasAppended();
    this.refusesStaleVersions();
    this.keepsStreamsApart();
  }

  private appendsAndReads(): void {
    this.it('creates a stream at version 0 and gives its events back in order, numbered from 1', async () => {
      const appended = await this.subject.append('consignment-c1', 0, [eventOf('e1'), eventOf('e2')]);
      const read = await this.subject.readStream('consignment-c1');

      this.expect(appended.version).toBe(2);

      this.expect(read.map(({ id, version, stream }) => ({ id, version, stream }))).toEqual([
        { id: 'e1', version: 1, stream: 'consignment-c1' },
        { id: 'e2', version: 2, stream: 'consignment-c1' },
      ]);
    });

    this.it(
      'gives back the type, the version of the shape, the data, the metadata and the instant as appended',
      async () => {
        const data = {
          label: 'é ✓',
          weight: 12.5,
          fragile: true,
          none: null,
          items: [{ sku: 'a' }],
          nested: { depth: 2 },
        };

        await this.subject.append('consignment-c1', 0, [{ ...eventOf('e1', data), schemaVersion: 3 }]);
        const [read] = await this.subject.readStream('consignment-c1');

        this.expect(read?.type).toBe('shipping.consignment.weighed');
        this.expect(read?.schemaVersion).toBe(3);
        this.expect(read?.data).toEqual(data);
        this.expect(read?.metadata).toEqual({ aggregateId: 'c1', correlationId: 'corr-e1' });
        this.expect(read?.occurredAt.toISOString()).toBe('2026-03-01T10:00:00.000Z');
      },
    );
  }

  private readsWhatWasAppended(): void {
    this.it('appends to a stream at the version it has, and reads it after a version', async () => {
      await this.subject.append('consignment-c1', 0, [eventOf('e1')]);
      await this.subject.append('consignment-c1', 1, [eventOf('e2'), eventOf('e3')]);

      const after = await this.subject.readStream('consignment-c1', 1);

      this.expect(after.map(({ id, version }) => `${id}@${version}`)).toEqual(['e2@2', 'e3@3']);
    });

    this.it('appends nothing at the version the stream has, and refuses nothing at another one', async () => {
      await this.subject.append('consignment-c1', 0, [eventOf('e1')]);

      const unchanged = await this.subject.append('consignment-c1', 1, []);
      const refused = await failureOf(() => this.subject.append('consignment-c1', 0, []));

      this.expect(unchanged).toEqual({ version: 1, position: 1 });
      this.expect(codeOf(refused)).toBe(CONCURRENCY_CONFLICT);
    });

    this.it('reads an unknown stream as empty', async () => {
      this.expect(await this.subject.readStream('consignment-unknown')).toEqual([]);
    });
  }

  private refusesStaleVersions(): void {
    this.it(
      'refuses with a concurrency conflict an append at a version the stream no longer has, and keeps none of it',
      async () => {
        await this.subject.append('consignment-c1', 0, [eventOf('e1')]);

        const behind = await failureOf(() => this.subject.append('consignment-c1', 0, [eventOf('e2')]));
        const ahead = await failureOf(() => this.subject.append('consignment-c1', 2, [eventOf('e3')]));

        this.expect([codeOf(behind), codeOf(ahead)]).toEqual([CONCURRENCY_CONFLICT, CONCURRENCY_CONFLICT]);
        this.expect((await this.subject.readStream('consignment-c1')).map(({ id }) => id)).toEqual(['e1']);
      },
    );

    this.it('lets one of two appends at the same version through, and refuses the other', async () => {
      await this.subject.append('consignment-c1', 0, [eventOf('e1')]);

      const outcomes = await Promise.all([
        failureOf(() => this.subject.append('consignment-c1', 1, [eventOf('left')])),
        failureOf(() => this.subject.append('consignment-c1', 1, [eventOf('right')])),
      ]);

      this.expect(outcomes.filter((failure) => failure === undefined).length).toBe(1);
      this.expect(outcomes.map(codeOf).filter((code) => code === CONCURRENCY_CONFLICT).length).toBe(1);
      this.expect((await this.subject.readStream('consignment-c1')).length).toBe(2);
    });
  }

  private keepsStreamsApart(): void {
    this.it('numbers each stream on its own', async () => {
      await this.subject.append('consignment-c1', 0, [eventOf('a1'), eventOf('a2')]);
      await this.subject.append('consignment-c2', 0, [eventOf('b1')]);

      const second = await this.subject.readStream('consignment-c2');

      this.expect(second.map(({ id, version }) => `${id}@${version}`)).toEqual(['b1@1']);
      this.expect((await this.subject.readStream('consignment-c1')).length).toBe(2);
    });
  }
}

function codeOf(failure: unknown): unknown {
  return typeof failure === 'object' && failure !== null && 'code' in failure ? failure.code : undefined;
}
