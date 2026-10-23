import { CONCURRENCY_CONFLICT, type EventSourcingStores } from '@ddd-ts-kit/kernel';
import { ContractSuite } from '../contract-suite';
import { failureOf } from '../failure-of';

type Companions = Pick<EventSourcingStores, 'snapshots' | 'checkpoints' | 'subjectKeys'>;

/** The stores that come with an event store: snapshots, checkpoints of the subscriptions, keys of the data subjects. */
export class CompanionStoresSuite extends ContractSuite<Companions> {
  protected tests(): void {
    this.keepsTheLatestSnapshot();
    this.movesCheckpointsFromWhereTheyStand();
    this.destroysKeys();
  }

  private keepsTheLatestSnapshot(): void {
    this.it('keeps the snapshot of a stream as saved, and never replaces it by an older one', async () => {
      const { snapshots } = this.subject;
      const later = { stream: 'consignment-c1', version: 6, schemaVersion: 2, data: { grams: 600, tags: ['a'] } };

      await snapshots.save({ stream: 'consignment-c1', version: 3, schemaVersion: 2, data: { grams: 300 } });
      await snapshots.save(later);
      await snapshots.save({ stream: 'consignment-c1', version: 4, schemaVersion: 2, data: { grams: 400 } });

      this.expect(await snapshots.find('consignment-c1')).toEqual(later);
      this.expect(await snapshots.find('consignment-c2')).toBe(undefined);
    });
  }

  private movesCheckpointsFromWhereTheyStand(): void {
    this.it('starts a subscriber at 0 and moves it from where it stands, refusing a move from elsewhere', async () => {
      const { checkpoints } = this.subject;

      this.expect(await checkpoints.position('shipping.weights')).toBe(0);

      await checkpoints.advance('shipping.weights', 0, 4);
      await checkpoints.advance('shipping.weights', 4, 9);

      const stale = await failureOf(() => checkpoints.advance('shipping.weights', 4, 12));
      const fresh = await failureOf(() => checkpoints.advance('shipping.labels', 3, 5));

      this.expect([codeOf(stale), codeOf(fresh)]).toEqual([CONCURRENCY_CONFLICT, CONCURRENCY_CONFLICT]);
      this.expect(await checkpoints.position('shipping.weights')).toBe(9);
      this.expect(await checkpoints.position('shipping.labels')).toBe(0);
    });

    this.it('lets one of two runs starting from 0 move the checkpoint', async () => {
      const { checkpoints } = this.subject;

      const outcomes = await Promise.all([
        failureOf(() => checkpoints.advance('shipping.weights', 0, 3)),
        failureOf(() => checkpoints.advance('shipping.weights', 0, 3)),
      ]);

      this.expect(outcomes.filter((failure) => failure === undefined).length).toBe(1);
    });
  }

  private destroysKeys(): void {
    this.it('gives a subject one key until it is erased, then a new one that the old id never finds', async () => {
      const { subjectKeys } = this.subject;
      const first = await subjectKeys.keyFor('patient-1');

      this.expect(await subjectKeys.keyFor('patient-1')).toEqual(first);
      this.expect(await subjectKeys.find(first.id)).toEqual(first);
      this.expect(Buffer.from(first.material, 'base64').length).toBe(32);
      this.expect(await subjectKeys.erase('patient-1')).toBe(true);
      this.expect(await subjectKeys.find(first.id)).toBe(undefined);
      this.expect(await subjectKeys.erase('patient-1')).toBe(false);
      this.expect((await subjectKeys.keyFor('patient-1')).id === first.id).toBe(false);
    });
  }
}

function codeOf(failure: unknown): unknown {
  return typeof failure === 'object' && failure !== null && 'code' in failure ? failure.code : undefined;
}
