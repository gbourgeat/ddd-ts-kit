import type { SchemaNode } from '../schema/schema-node';
import type { FieldBlock } from './field-block';

/** The keywords of JSON Schema a form mirrors so that the user is told early; the server checks them again. */
const CONSTRAINTS = [
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'pattern',
  'format',
  'minItems',
  'maxItems',
];

export function constraintsOf(node: SchemaNode): Pick<FieldBlock, 'constraints'> {
  const found = CONSTRAINTS.flatMap((keyword): [string, string | number | boolean][] => {
    const value = node.node[keyword];

    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? [[keyword, value]]
      : [];
  });

  return found.length === 0 ? {} : { constraints: Object.fromEntries(found) };
}
