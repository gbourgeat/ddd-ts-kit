import { InMemoryRelationTupleStore, type RelationTupleStore } from '@ddd-ts-kit/auth/rebac';

// TODO(platform): answer a persistent store (a table written in the transaction of the change it describes) and hold it to relationTupleStoreContract, as create-tuple-store.contract.spec.ts does for this one.
export function createTupleStore(): RelationTupleStore {
  return new InMemoryRelationTupleStore();
}
