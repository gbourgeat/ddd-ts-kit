import type { JsonSchema } from '@ddd-ts-kit/validation';

/** A form in JSON Forms: what its renderers take as `schema`, `uischema` and `data`. */
export interface JsonForm {
  readonly schema: JsonSchema;
  readonly uischema: JsonSchema;
  readonly data: Readonly<Record<string, unknown>>;
}
