import type { JsonSchema } from '@ddd-ts-kit/validation';
import type { OpenApiInfo } from './open-api-info.js';
import type { OpenApiServer } from './open-api-server.js';

export interface OpenApiDocument {
  readonly openapi: '3.1.0';
  readonly info: OpenApiInfo;
  readonly servers?: readonly OpenApiServer[];
  readonly tags?: readonly { readonly name: string }[];
  readonly security?: readonly Record<string, string[]>[];
  readonly paths: Record<string, Record<string, JsonSchema>>;
  readonly components: {
    readonly schemas: Record<string, JsonSchema>;
    readonly securitySchemes?: Record<string, JsonSchema>;
  };
}
