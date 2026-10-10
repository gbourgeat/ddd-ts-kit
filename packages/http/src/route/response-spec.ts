import type { Schema } from '@ddd-ts-kit/validation';

export interface ResponseSpec {
  readonly description: string;
  readonly body?: Schema<unknown>;
}
