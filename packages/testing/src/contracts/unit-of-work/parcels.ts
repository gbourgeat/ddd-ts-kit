import type { Parcel } from './parcel.js';
import type { UnitOfWorkUnderContract } from './unit-of-work-under-contract.js';

/** A repository adapter over the table of the subject: it persists, and knows nothing of events. */
export class Parcels {
  constructor(private readonly subject: Pick<UnitOfWorkUnderContract, 'insert' | 'ids'>) {}

  async save(parcel: Parcel): Promise<void> {
    await this.subject.insert(parcel.id);
  }

  async exists(id: string): Promise<boolean> {
    return (await this.subject.ids()).includes(id);
  }
}
