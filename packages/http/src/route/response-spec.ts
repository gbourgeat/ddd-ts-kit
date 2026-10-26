import type { Schema } from '@ddd-ts-kit/validation';

export interface ResponseSpec {
  readonly description: string;
  readonly body?: Schema<unknown>;
  /** The headers the answer carries, each with what it holds: the contract lists them. */
  readonly headers?: Readonly<Record<string, string>>;
}
