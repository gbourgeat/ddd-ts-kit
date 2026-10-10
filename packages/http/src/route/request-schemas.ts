import type { Schema } from '@ddd-ts-kit/validation';

export interface RequestSchemas {
  readonly params?: Schema<unknown>;
  readonly query?: Schema<unknown>;
  readonly headers?: Schema<unknown>;
  readonly body?: Schema<unknown>;
}
