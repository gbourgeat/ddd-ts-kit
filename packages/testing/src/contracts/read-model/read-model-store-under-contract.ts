import type { UnitOfWork } from '@ddd-ts-kit/kernel';
import type { ReadModelRowsUnderContract } from './read-model-rows-under-contract';

export interface ReadModelStoreUnderContract extends ReadModelRowsUnderContract {
  /** The unit of work of its database: the swap of a rebuild runs in it. */
  readonly unitOfWork: UnitOfWork;
}
