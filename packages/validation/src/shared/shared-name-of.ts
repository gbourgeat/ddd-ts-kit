import type { JsonSchema } from '../json-schema';
import { DEFINITIONS_POINTER } from './definitions-pointer';
import { isRecord } from './is-record';

/**
 * The name a schema is shared under, when its JSON Schema is a reference to one of its own
 * definitions: the form `sharedSchema`, `classSchema(Dto, { shared: true })` and a zod schema
 * registered with `.meta({ id })` all take.
 */
export function sharedNameOf(jsonSchema: JsonSchema): string | undefined {
  const reference = jsonSchema['$ref'];
  const definitions = jsonSchema['$defs'];

  if (typeof reference !== 'string' || !reference.startsWith(DEFINITIONS_POINTER) || !isRecord(definitions)) {
    return undefined;
  }

  const name = reference.slice(DEFINITIONS_POINTER.length);

  return definitions[name] === undefined ? undefined : name;
}
