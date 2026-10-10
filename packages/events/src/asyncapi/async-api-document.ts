import type { JsonSchema } from '@ddd-ts-kit/validation';
import type { AsyncApiInfo } from './async-api-info.js';
import type { AsyncApiServer } from './async-api-server.js';

export interface AsyncApiDocument {
  readonly asyncapi: '3.0.0';
  readonly info: AsyncApiInfo;
  readonly servers?: Record<string, AsyncApiServer>;
  readonly channels: Record<string, JsonSchema>;
  readonly operations: Record<string, JsonSchema>;
  readonly components: {
    readonly messages: Record<string, JsonSchema>;
    readonly schemas?: Record<string, JsonSchema>;
  };
}
