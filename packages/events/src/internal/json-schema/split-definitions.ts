import type { JsonSchema } from '@ddd-ts-kit/validation';
import { isRecord } from './is-record.js';

export interface SplitSchema {
  readonly schema: JsonSchema;
  readonly definitions: Readonly<Record<string, unknown>>;
}

/** Separates a schema from its dialect marker and its local definitions. */
export function splitDefinitions(source: JsonSchema): SplitSchema {
  const { $schema: _dialect, $defs, definitions, ...schema } = source;

  return {
    schema,
    definitions: {
      ...(isRecord(definitions) ? definitions : {}),
      ...(isRecord($defs) ? $defs : {}),
    },
  };
}
