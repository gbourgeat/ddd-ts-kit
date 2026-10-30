import { LINE_WIDTH } from '../../../layout';
import type { PayloadField } from './payload-field';
import type { PayloadOf } from './payload-of';
import type { PayloadSchema } from './payload-schema';
import type { PayloadShape, PrimitiveKind } from './payload-shape';
import { payloadTexts } from './payload-texts';

const { emptyTodo, typeComment, unreadTodo } = payloadTexts;

/** A field the schema checks: every shape but the one the generator writes no check for. */
type CheckedField = PayloadField & { readonly shape: Exclude<PayloadShape, { kind: 'unread' }> };

/** A Standard Schema written by hand, or, with no validation library, the schema of the kernel. */
type Form = 'standard-schema' | 'kernel';

const ARTICLES: Readonly<Record<PrimitiveKind, string>> = {
  string: 'A string',
  number: 'A number',
  boolean: 'A boolean',
};

const LISTS: Readonly<Record<PrimitiveKind, string>> = {
  string: 'isListOfStrings',
  number: 'isListOfNumbers',
  boolean: 'isListOfBooleans',
};

/** A payload that is no object (a text, a number, a list) is refused before any field is read. */
const NO_OBJECT = "typeof input !== 'object' || input === null || Array.isArray(input)";

/**
 * Each field checked by hand, the type of the payload declared next to it: one refusal per
 * field in a list, which the schema runs, so that no function grows with the payload.
 */
export function writtenPayloadSchema(form: Form, payload: PayloadOf): PayloadSchema {
  const empty = payload.fields.length === 0;

  return {
    libraryImports: [],
    kernelNames: form === 'kernel' ? ['err', 'ok', 'type BackgroundJobPayloadSchema'] : [],
    kitImports:
      form === 'kernel'
        ? []
        : ["import { standardSchema, type StandardSchemaV1 } from '@ddd-ts-kit/validation/standard-schema';"],
    declaration: [
      ...typeOf(payload),
      '',
      ...(empty ? [] : [...refusalsOf(payload.fields), '']),
      ...(form === 'kernel' ? kernelSchema(payload) : standard(payload)),
    ].join('\n'),
    schema: 'payloadSchema',
    helpers: empty ? '' : helpersOf(payload),
  };
}

function typeOf({ name, fields }: PayloadOf): string[] {
  if (fields.length === 0) {
    return [emptyTodo(name), `export type ${name.pascal}Payload = Readonly<Record<string, never>>;`];
  }

  return [typeComment(name), `export interface ${name.pascal}Payload {`, ...fields.flatMap(declarationOf), '}'];
}

/**
 * A field the generator writes no check for is let through as `unknown`, as `z.unknown()` and
 * `Allow()` let it through: the type checker stops at the command it is handed to.
 */
function declarationOf(field: PayloadField): string[] {
  if (field.shape.kind !== 'unread') {
    return [field.declaration];
  }

  return [`  ${unreadTodo(field, field.shape.type)}`, `  readonly ${field.name}${field.optional ? '?' : ''}: unknown;`];
}

function refusalsOf(fields: readonly PayloadField[]): string[] {
  return [
    'interface Refusal {',
    '  readonly path: string;',
    '  readonly message: string;',
    '  readonly refuses: (sent: Readonly<Record<string, unknown>>) => boolean;',
    '}',
    '',
    ...refusalListOf(fields.filter(isChecked)),
  ];
}

function refusalListOf(checked: readonly CheckedField[]): string[] {
  if (checked.length === 0) {
    return ['const refusals: readonly Refusal[] = [];'];
  }

  return ['const refusals: readonly Refusal[] = [', ...checked.flatMap(refusalOf), '];'];
}

function refusalOf(field: CheckedField): string[] {
  const { test, message } = refusedBy(field);
  const parts = [`path: '${field.name}'`, `message: '${message}'`, `refuses: (sent) => ${test}`];
  const line = `  { ${parts.join(', ')} },`;

  return [...(line.length <= LINE_WIDTH ? [line] : ['  {', ...parts.map((part) => `    ${part},`), '  },'])];
}

function refusedBy(field: CheckedField): { test: string; message: string } {
  const sent = `sent.${field.name}`;
  const { test, message } = testOf(field.shape, sent);

  return { test: field.optional ? `${sent} !== undefined && ${grouped(test)}` : test, message };
}

function testOf(shape: CheckedField['shape'], sent: string): { test: string; message: string } {
  switch (shape.kind) {
    case 'instant':
      return {
        test: `typeof ${sent} !== 'string' || Number.isNaN(Date.parse(${sent}))`,
        message: 'An instant is expected.',
      };
    case 'list':
      return { test: `!${LISTS[shape.of]}(${sent})`, message: `A list of ${shape.of}s is expected.` };
    case 'literals':
      return {
        test: shape.values.map((value) => `${sent} !== '${value}'`).join(' && '),
        message: `One of ${shape.values.join(', ')} is expected.`,
      };
    default:
      return { test: `typeof ${sent} !== '${shape.kind}'`, message: `${ARTICLES[shape.kind]} is expected.` };
  }
}

function isChecked(field: PayloadField): field is CheckedField {
  return field.shape.kind !== 'unread';
}

function grouped(test: string): string {
  return /&&|\|\|/.test(test) ? `(${test})` : test;
}

function standard(payload: PayloadOf): string[] {
  const type = `${payload.name.pascal}Payload`;

  return [
    `const payloadShape: StandardSchemaV1<unknown, ${type}> = {`,
    "  '~standard': {",
    '    version: 1,',
    `    vendor: '${payload.vendor}',`,
    ...(payload.fields.length === 0 ? standardOfNothing() : standardOfFields()),
    '  },',
    '};',
    '',
    'const payloadSchema = standardSchema(payloadShape);',
  ];
}

function standardOfNothing(): string[] {
  return [
    '    validate: (value) =>',
    "      typeof value === 'object' && value !== null && !Array.isArray(value)",
    '        ? { value: {} }',
    "        : { issues: [{ message: 'An object is expected.' }] },",
  ];
}

function standardOfFields(): string[] {
  return [
    '    validate: (input) => {',
    `      if (${NO_OBJECT}) {`,
    "        return { issues: [{ message: 'An object is expected.' }] };",
    '      }',
    '',
    '      const sent: Readonly<Record<string, unknown>> = { ...input };',
    '      const refused = refusals.filter((refusal) => refusal.refuses(sent));',
    '',
    '      return fits(sent, refused)',
    '        ? { value: sent }',
    '        : { issues: refused.map(({ path, message }) => ({ message, path: [path] })) };',
    '    },',
  ];
}

function kernelSchema(payload: PayloadOf): string[] {
  const type = `${payload.name.pascal}Payload`;

  return [
    `const payloadSchema: BackgroundJobPayloadSchema<${type}> = {`,
    ...(payload.fields.length === 0 ? kernelOfNothing() : kernelOfFields()),
    '};',
  ];
}

function kernelOfNothing(): string[] {
  return [
    '  parse: (input) =>',
    "    typeof input === 'object' && input !== null && !Array.isArray(input)",
    '      ? ok({})',
    "      : err([{ path: '', code: 'invalid_type', message: 'An object is expected.' }]),",
  ];
}

function kernelOfFields(): string[] {
  return [
    '  parse(input) {',
    `    if (${NO_OBJECT}) {`,
    "      return err([{ path: '', code: 'invalid_type', message: 'An object is expected.' }]);",
    '    }',
    '',
    '    const sent: Readonly<Record<string, unknown>> = { ...input };',
    '    const refused = refusals.filter((refusal) => refusal.refuses(sent));',
    '',
    '    return fits(sent, refused)',
    '      ? ok(sent)',
    "      : err(refused.map(({ path, message }) => ({ path, code: 'invalid_type', message })));",
    '  },',
  ];
}

/** Below the class: the guard the schema answers with, then the checks of the lists. */
function helpersOf({ name, fields }: PayloadOf): string {
  const lists = [...new Set(fields.flatMap(({ shape }) => (shape.kind === 'list' ? [shape.of] : [])))].sort();

  const fitting = [
    `function fits(sent: object, refused: readonly Refusal[]): sent is ${name.pascal}Payload {`,
    '  return refused.length === 0;',
    '}',
  ].join('\n');

  return [fitting, ...lists.map(listGuard)].join('\n\n');
}

function listGuard(kind: PrimitiveKind): string {
  return [
    `function ${LISTS[kind]}(value: unknown): value is ${kind}[] {`,
    `  return Array.isArray(value) && value.every((entry) => typeof entry === '${kind}');`,
    '}',
  ].join('\n');
}
