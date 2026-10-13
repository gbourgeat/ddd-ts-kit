import type { FileStorage } from '@ddd-ts-kit/kernel';
import type { Awaitable } from '../awaitable.js';
import type { FollowedResponse } from './followed-response.js';
import type { SignedRequest } from './signed-request.js';

export interface FileStorageContractOptions {
  readonly name: string;
  /** A storage that holds nothing; called before each test. */
  createStorage(): Awaitable<FileStorage>;
  /** Makes the time of the signed links pass: advances their clock, or really waits. */
  elapse(ms: number): Awaitable<void>;
  /**
   * Sends a request to a signed link. Default: `fetch`, for a storage that answers its own links.
   * A storage the application serves passes `followServed(storage)`.
   */
  follow?(request: SignedRequest): Promise<FollowedResponse>;
}
