import type { PayloadField } from './payload-field';
import type { PayloadOf } from './payload-of';
import type { PayloadSchema } from './payload-schema';
import type { PayloadShape, PrimitiveKind } from './payload-shape';
import { payloadTexts } from './payload-texts';

const { emptyTodo, typeComment, unreadTodo } = payloadTexts;

type ObjectLibrary = 'zod' | 'typebox';

interface Writer {
  readonly libraryImport: string;
  readonly kitImport: string;
  readonly wrap: string;
  readonly object: string;
  readonly primitive: Readonly<Record<PrimitiveKind, string>>;
  readonly instant: string;
  list(item: string): string;
  literals(values: readonly string[]): string;
  readonly unknown: string;
  optional(written: string): string;
}

const WRITERS: Readonly<Record<ObjectLibrary, Writer>> = {
  zod: {
    libraryImport: "import { z } from 'zod';",
    kitImport: "import { zodSchema } from '@ddd-ts-kit/validation/zod';",
    wrap: 'zodSchema',
    object: 'z.object',
    primitive: { string: 'z.string()', number: 'z.number()', boolean: 'z.boolean()' },
    instant: 'z.iso.datetime()',
    list: (item) => `z.array(${item})`,
    literals: (values) =>
      values.length === 1 ? `z.literal(${quoted(values[0])})` : `z.enum([${values.map(quoted).join(', ')}])`,
    unknown: 'z.unknown()',
    optional: (written) => `${written}.optional()`,
  },
  typebox: {
    libraryImport: "import Type from 'typebox';",
    kitImport: "import { typeboxSchema } from '@ddd-ts-kit/validation/typebox';",
    wrap: 'typeboxSchema',
    object: 'Type.Object',
    primitive: { string: 'Type.String()', number: 'Type.Number()', boolean: 'Type.Boolean()' },
    instant: "Type.String({ format: 'date-time' })",
    list: (item) => `Type.Array(${item})`,
    literals: (values) =>
      values.length === 1
        ? `Type.Literal(${quoted(values[0])})`
        : `Type.Union([${values.map((value) => `Type.Literal(${quoted(value)})`).join(', ')}])`,
    unknown: 'Type.Unknown()',
    optional: (written) => `Type.Optional(${written})`,
  },
};

/** An object of the library, one entry per field, and the type it infers. */
export function objectPayloadSchema(library: ObjectLibrary, { name, fields }: PayloadOf): PayloadSchema {
  const writer = WRITERS[library];
  const entries = fields.length === 0 ? [`    ${emptyTodo(name)}`] : fields.flatMap((field) => entryOf(writer, field));

  return {
    libraryImports: [writer.libraryImport],
    kernelNames: [],
    kitImports: ["import type { Infer } from '@ddd-ts-kit/validation';", writer.kitImport],
    declaration: [
      ...(fields.length === 0 ? [] : [typeComment(name)]),
      `const payloadSchema = ${writer.wrap}(`,
      `  ${writer.object}({`,
      ...entries,
      '  }),',
      ');',
      '',
      `export type ${name.pascal}Payload = Infer<typeof payloadSchema>;`,
    ].join('\n'),
    schema: 'payloadSchema',
    helpers: '',
  };
}

function entryOf(writer: Writer, field: PayloadField): string[] {
  const written = writtenOf(writer, field.shape);
  const todo = field.shape.kind === 'unread' ? [`    ${unreadTodo(field, field.shape.type)}`] : [];

  return [...todo, `    ${field.name}: ${field.optional ? writer.optional(written) : written},`];
}

function writtenOf(writer: Writer, shape: PayloadShape): string {
  switch (shape.kind) {
    case 'instant':
      return writer.instant;
    case 'list':
      return writer.list(writer.primitive[shape.of]);
    case 'literals':
      return writer.literals(shape.values);
    case 'unread':
      return writer.unknown;
    default:
      return writer.primitive[shape.kind];
  }
}

function quoted(value: string | undefined): string {
  return `'${value ?? ''}'`;
}
