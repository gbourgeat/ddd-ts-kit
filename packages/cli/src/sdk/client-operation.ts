import type { ClientParameter } from './client-parameter.js';
import type { ClientResponse } from './client-response.js';

/** One operation of a document: how it is called and what it answers. */
export interface ClientOperation {
  /** The name of its function, from its `operationId`: `openPractice`. */
  readonly name: string;
  readonly method: string;
  readonly path: string;
  readonly summary: string;
  readonly deprecated: boolean;
  /** The alternatives of its security, each the schemes sent together; an empty alternative: it may be called anonymously. */
  readonly security: readonly (readonly string[])[];
  readonly parameters: readonly ClientParameter[];
  /** The schema of its JSON body, when it takes one. */
  readonly body: { readonly schema: unknown; readonly required: boolean } | undefined;
  readonly responses: readonly ClientResponse[];
}
