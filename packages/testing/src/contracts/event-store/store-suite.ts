import type { EventStore } from '@ddd-ts-kit/kernel';
import { ContractSuite } from '../contract-suite.js';
import { eventOf } from './event-of.js';

/** The whole store: read in the order of the appends, from a position, page by page, for the subscriptions. */
export class StoreSuite extends ContractSuite<EventStore> {
  protected tests(): void {
    this.readsInOrder();
    this.readsFromAPosition();
  }

  private readsInOrder(): void {
    this.it('reads every stream in the order the events were appended, positions rising from 1', async () => {
      await this.subject.append('consignment-c1', 0, [eventOf('a1')]);
      await this.subject.append('consignment-c2', 0, [eventOf('b1'), eventOf('b2')]);
      await this.subject.append('consignment-c1', 1, [eventOf('a2')]);

      const all = await this.subject.readAll(0, 10);

      this.expect(all.map(({ id }) => id)).toEqual(['a1', 'b1', 'b2', 'a2']);
      this.expect(all.map(({ position }) => position)).toEqual([1, 2, 3, 4]);
    });

    this.it('says at which position the store is: 0 when empty, then the position of the last event', async () => {
      const empty = await this.subject.head();
      const appended = await this.subject.append('consignment-c1', 0, [eventOf('a1'), eventOf('a2')]);

      this.expect([empty, appended.position, await this.subject.head()]).toEqual([0, 2, 2]);
    });
  }

  private readsFromAPosition(): void {
    this.it('reads after a position, no more than the limit, then nothing past the last one', async () => {
      await this.subject.append('consignment-c1', 0, [eventOf('a1'), eventOf('a2'), eventOf('a3'), eventOf('a4')]);

      const page = await this.subject.readAll(1, 2);
      const rest = await this.subject.readAll(3, 10);

      this.expect(page.map(({ id }) => id)).toEqual(['a2', 'a3']);
      this.expect(rest.map(({ id }) => id)).toEqual(['a4']);
      this.expect(await this.subject.readAll(4, 10)).toEqual([]);
    });
  }
}
