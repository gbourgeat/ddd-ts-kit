import { LINE_WIDTH } from '../../../layout';
import { toName, type Name } from '../../../naming';
import type { FieldKind, ReadField } from './message-plan';

const ARTICLES: Readonly<Record<FieldKind, string>> = { string: 'A string', number: 'A number', boolean: 'A boolean' };

/** One part of a request a route validates field by field under Standard Schema. */
export interface StandardPart {
  readonly name: Name;
  readonly vendor: string;
  readonly part: 'params' | 'body';
  readonly fields: readonly ReadField[];
  /** A `TODO(domain)` written above the schema, or nothing. */
  readonly todo: string;
}

/**
 * A Standard Schema written by hand, the protocol being all the stack names: the type it
 * produces, the check of each field, and the JSON Schema of the contract. Nothing without fields.
 */
export function standardSchemaOf(part: StandardPart): string {
  if (part.fields.length === 0) {
    return '';
  }

  return [
    ...(part.todo === '' ? [] : [`// ${part.todo}`]),
    ...producedType(part),
    '',
    ...shape(part),
    '',
    ...jsonSchema(part),
  ].join('\n');
}

function producedType(part: StandardPart): string[] {
  return [
    `interface ${typeName(part)} {`,
    ...part.fields.map((field) => `  readonly ${field.name}: ${field.kind};`),
    '}',
  ];
}

function typeName({ name, part }: StandardPart): string {
  return `${name.pascal}${toName(part).pascal}`;
}

function shape(part: StandardPart): string[] {
  return [
    `const ${part.part}Shape: StandardSchemaV1<unknown, ${typeName(part)}> = {`,
    "  '~standard': {",
    '    version: 1,',
    `    vendor: '${part.vendor}',`,
    '    validate: (value) => {',
    "      const sent: Readonly<Record<string, unknown>> = typeof value === 'object' && value !== null ? { ...value } : {};",
    '',
    ...part.fields.flatMap(checkOf),
    '      return {',
    '        value: {',
    ...part.fields.map((field) => `          ${field.name}: sent.${field.name},`),
    '        },',
    '      };',
    '    },',
    '  },',
    '};',
  ];
}

function checkOf(field: ReadField): string[] {
  return [
    `      if (typeof sent.${field.name} !== '${field.kind}') {`,
    `        return { issues: [{ message: '${ARTICLES[field.kind]} is expected.', path: ['${field.name}'] }] };`,
    '      }',
    '',
  ];
}

/** The required list stays on its line while it fits, as the formatter keeps it. */
function jsonSchema({ part, fields }: StandardPart): string[] {
  const required = `  required: [${fields.map((field) => `'${field.name}'`).join(', ')}],`;

  return [
    `const ${part} = standardSchema(${part}Shape, {`,
    "  type: 'object',",
    ...(required.length <= LINE_WIDTH
      ? [required]
      : ['  required: [', ...fields.map((field) => `    '${field.name}',`), '  ],']),
    '  properties: {',
    ...fields.map((field) => `    ${field.name}: { type: '${field.kind}' },`),
    '  },',
    '});',
  ];
}
