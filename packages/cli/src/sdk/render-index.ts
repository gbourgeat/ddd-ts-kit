import type { ClientDocument } from './client-document';
import { generatedHeader } from './generated-header';

/** `index.ts`: what the package exports. */
export function renderIndex(document: ClientDocument): string {
  return `${generatedHeader(document)}
export { type Client, connect, createClient, type SchemeName } from './client.js';
export * from './errors.js';
export * from './operations.js';
export {
  type CallOptions,
  type ClientOptions,
  type Credential,
  type DataOf,
  type Failure,
  ProblemError,
  type Success,
  UnexpectedResponseError,
  unwrap,
} from './runtime.js';
export type * from './schemas.js';
`;
}
