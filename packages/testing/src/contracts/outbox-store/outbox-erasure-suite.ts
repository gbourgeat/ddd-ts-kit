import { ERASED_PERSONAL_DATA, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { Awaitable } from '../awaitable';
import type { ContractRunner } from '../contract-runner';
import { ContractSuite } from '../contract-suite';
import type { OutboxStoreUnderContract, PersonalEventUnderContract } from './outbox-store-under-contract';

const NOW = new Date('2026-03-01T10:00:00.000Z');

/** The erasure of a person in the records the outbox keeps, whatever their status. */
export class OutboxErasureSuite extends ContractSuite<OutboxStoreUnderContract> {
  constructor(
    runner: ContractRunner,
    createStore: () => Awaitable<OutboxStoreUnderContract>,
    private readonly leaseMs: number,
  ) {
    super(runner, createStore);
  }

  protected tests(): void {
    this.erasesAPerson();
    this.reachesEveryStatus();
    this.erasesOnlyThatPerson();
  }

  private erasesAPerson(): void {
    this.it('erases the personal fields of a person in a record that waits, and hands out what is left', async () => {
      await this.subject.append([personalEvent('evt-1', 'cus-1')]);

      this.expect(await this.subject.erasePersonalFields('cus-1', [REGISTERED])).toBe(1);

      const [claimed] = await this.subject.claimBatch(10, NOW);

      this.expect(claimed?.event.payload).toEqual({
        customerId: 'cus-1',
        email: ERASED_PERSONAL_DATA,
        age: null,
        address: { city: ERASED_PERSONAL_DATA, zip: '75011' },
        phones: [ERASED_PERSONAL_DATA, ERASED_PERSONAL_DATA],
        lines: [{ recipient: ERASED_PERSONAL_DATA, sku: 'sku-1' }],
        plan: 'gold',
      });
    });

    this.it('reaches nothing the second time', async () => {
      await this.subject.append([personalEvent('evt-1', 'cus-1')]);
      await this.subject.erasePersonalFields('cus-1', [REGISTERED]);

      this.expect(await this.subject.erasePersonalFields('cus-1', [REGISTERED])).toBe(0);
    });
  }

  private reachesEveryStatus(): void {
    this.it('reaches a record whatever its status: published and dead records keep a person too', async () => {
      const events = [
        personalEvent('evt-1', 'cus-1'),
        personalEvent('evt-2', 'cus-1'),
        personalEvent('evt-3', 'cus-1'),
      ];

      await this.subject.append(events);
      await this.subject.claimBatch(10, NOW);
      await this.subject.markPublished(['evt-1'], NOW);
      await this.subject.markFailed('evt-2', { code: 'BROKER_DOWN' }, null);

      this.expect(await this.subject.erasePersonalFields('cus-1', [REGISTERED])).toBe(3);

      await this.subject.retryDead(['evt-2'], later(this.leaseMs * 10));

      const claimed = await this.subject.claimBatch(10, later(this.leaseMs * 10));

      this.expect(claimed.map(({ event }) => [event.id, emailOf(event)])).toEqual([
        ['evt-3', ERASED_PERSONAL_DATA],
        ['evt-2', ERASED_PERSONAL_DATA],
      ]);
    });
  }

  private erasesOnlyThatPerson(): void {
    this.it('leaves another person, and an event or a version the declarations do not name', async () => {
      await this.subject.append([
        personalEvent('evt-1', 'cus-2'),
        { ...personalEvent('evt-2', 'cus-1'), type: 'contract.thing.renamed' },
        { ...personalEvent('evt-3', 'cus-1'), version: 2 },
      ]);

      this.expect(await this.subject.erasePersonalFields('cus-1', [REGISTERED])).toBe(0);

      const claimed = await this.subject.claimBatch(10, NOW);

      this.expect(claimed.map(({ event }) => emailOf(event))).toEqual([
        'ada@example.org',
        'ada@example.org',
        'ada@example.org',
      ]);
    });

    this.it('reaches nothing when no declaration is given', async () => {
      await this.subject.append([personalEvent('evt-1', 'cus-1')]);

      this.expect(await this.subject.erasePersonalFields('cus-1', [])).toBe(0);
    });

    this.it('leaves the payload that is no object alone', async () => {
      await this.subject.append([{ ...personalEvent('evt-1', 'cus-1'), payload: null }]);

      this.expect(await this.subject.erasePersonalFields('cus-1', [REGISTERED])).toBe(0);
    });
  }
}

function later(ms: number): Date {
  return new Date(NOW.getTime() + ms);
}

const REGISTERED: PersonalEventUnderContract = {
  type: 'contract.thing.happened',
  version: 1,
  personal: {
    subject: 'customerId',
    fields: ['email', 'age', 'address.city', 'phones[]', 'lines[].recipient'],
  },
};

/** An event that names its person and carries what the declaration lists, beside what is nobody's. */
function personalEvent(id: string, customerId: string): IntegrationEvent {
  return {
    id,
    type: REGISTERED.type,
    version: REGISTERED.version,
    occurredAt: '2026-03-01T09:59:59.000Z',
    payload: {
      customerId,
      email: 'ada@example.org',
      age: 36,
      address: { city: 'Paris', zip: '75011' },
      phones: ['+33 1', '+33 2'],
      lines: [{ recipient: 'Ada', sku: 'sku-1' }],
      plan: 'gold',
    },
  };
}

function emailOf({ payload }: IntegrationEvent): unknown {
  return typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'email') : undefined;
}
