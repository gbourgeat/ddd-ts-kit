import type { ClientOperation } from './client-operation';
import type { SchemeCarrier } from './scheme-carrier';

/** One document of the contract, read as what its client needs. */
export interface ClientDocument {
  /** The name of the client: `api` for the whole contract, the name of the document when it is split. */
  readonly name: string;
  /** The contract file it is generated from, relative to the project: `openapi/openapi.yaml`. */
  readonly source: string;
  readonly title: string;
  readonly version: string;
  readonly operations: readonly ClientOperation[];
  /** The schemas of `components.schemas`, by name, in the order of the document. */
  readonly schemas: readonly (readonly [string, unknown])[];
  readonly schemes: readonly (readonly [string, SchemeCarrier])[];
}
