import { InMemoryRelationTupleStore, type RelationTupleStore } from '@ddd-ts-kit/auth/rebac';

/** Where the tuples may live in memory: nowhere else, production included. */
const IN_MEMORY_IN = ['development', 'test'];

// TODO(platform): answer a persistent store (a table written in the transaction of the change it describes) and hold it to relationTupleStoreContract, as create-tuple-store.contract.spec.ts does for this one.
/**
 * Development and test only: the tuples live in this process, so a revocation reaches this
 * instance alone and a restart forgets every grant. It refuses production: bind a
 * RelationTupleStore that persists, an OpenFGA server (`OpenFgaRelationTupleStore` of
 * `@ddd-ts-kit/openfga`) or a table of your database held to `relationTupleStoreContract`.
 */
export function createTupleStore(environment: string = process.env['NODE_ENV'] ?? 'development'): RelationTupleStore {
  if (!IN_MEMORY_IN.includes(environment)) {
    throw new Error(
      'The in-memory relation tuple store runs in development and test only, never in production: bind a RelationTupleStore that persists in createTupleStore (OpenFgaRelationTupleStore of @ddd-ts-kit/openfga, or a table of your database held to relationTupleStoreContract)',
    );
  }

  return new InMemoryRelationTupleStore();
}
