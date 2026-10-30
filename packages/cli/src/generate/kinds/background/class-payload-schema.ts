import type { Name } from '../../../naming';
import type { PayloadField } from './payload-field';
import type { PayloadOf } from './payload-of';
import type { PayloadSchema } from './payload-schema';
import type { PayloadShape, PrimitiveKind } from './payload-shape';
import { payloadTexts } from './payload-texts';

const { emptyTodo, typeComment, unreadTodo } = payloadTexts;

const DECORATORS: Readonly<Record<PrimitiveKind, string>> = {
  string: 'IsString',
  number: 'IsNumber',
  boolean: 'IsBoolean',
};

/** How a decorator of class-validator checks every item of a list. */
const EACH: Readonly<Record<PrimitiveKind, string>> = {
  string: 'IsString({ each: true })',
  number: 'IsNumber({}, { each: true })',
  boolean: 'IsBoolean({ each: true })',
};

/** A field of the class: its decorators, then the field. */
interface Decorated {
  readonly decorators: readonly string[];
  readonly field: string;
}

/** A class whose decorated fields are the payload, validated as it is. */
export function classPayloadSchema({ name, fields }: PayloadOf): PayloadSchema {
  const decorated = fields.map(decoratedOf);
  const decorators = [...new Set(decorated.flatMap((field) => field.decorators.flatMap(decoratorName)))].sort();
  const body = fields.length === 0 ? [`  ${emptyTodo(name)}`] : decorated.flatMap(linesOf);

  return {
    libraryImports: decorators.length === 0 ? [] : [`import { ${decorators.join(', ')} } from 'class-validator';`],
    kernelNames: [],
    kitImports: [
      "import type { Infer } from '@ddd-ts-kit/validation';",
      "import { classSchema } from '@ddd-ts-kit/validation/class-validator';",
    ],
    declaration: [
      ...(fields.length === 0 ? [] : [typeComment(name)]),
      `class ${name.pascal}PayloadFields {`,
      ...body,
      '}',
      '',
      ...schemaOf(name, fields.length === 0),
      '',
      `export type ${name.pascal}Payload = Infer<typeof payloadSchema>;`,
    ].join('\n'),
    schema: 'payloadSchema',
    helpers: '',
  };
}

/** A class without any decorated field is let through by the option its `TODO(domain)` says to drop. */
function schemaOf(name: Name, empty: boolean): string[] {
  if (!empty) {
    return [`const payloadSchema = classSchema(${name.pascal}PayloadFields);`];
  }

  return [
    `// TODO(domain): once ${name.pascal}PayloadFields has its decorated fields, drop the second argument: it only lets a class without any decorated field through.`,
    `const payloadSchema = classSchema(${name.pascal}PayloadFields, { validator: { forbidUnknownValues: false } });`,
  ];
}

/**
 * A field has no initial value: class-transformer would keep it for a field the stored payload
 * lacks, and the payload of an earlier shape would pass. Each one is declared, its value set by
 * class-transformer from the stored payload, as the classes of a route declare theirs.
 */
function decoratedOf(field: PayloadField): Decorated {
  const { decorators, type } = describedBy(field.shape);
  const optional = field.optional ? ['IsOptional()'] : [];
  const todo = field.shape.kind === 'unread' ? [unreadTodo(field, field.shape.type)] : [];

  return {
    decorators: [...todo, ...optional, ...decorators],
    field: `declare ${field.name}${field.optional ? '?' : ''}: ${type};`,
  };
}

interface Described {
  readonly decorators: readonly string[];
  readonly type: string;
}

function describedBy(shape: PayloadShape): Described {
  switch (shape.kind) {
    case 'instant':
      return { decorators: ['IsISO8601()'], type: 'string' };
    case 'list':
      return { decorators: ['IsArray()', EACH[shape.of]], type: `${shape.of}[]` };
    case 'literals':
      return {
        decorators: [`IsIn([${shape.values.map((value) => `'${value}'`).join(', ')}])`],
        type: shape.values.map((value) => `'${value}'`).join(' | '),
      };
    case 'unread':
      return { decorators: ['Allow()'], type: 'unknown' };
    default:
      return { decorators: [`${DECORATORS[shape.kind]}()`], type: shape.kind };
  }
}

function linesOf({ decorators, field }: Decorated, index: number): string[] {
  const lines = decorators.map((decorator) => (decorator.startsWith('//') ? `  ${decorator}` : `  @${decorator}`));

  return [...(index === 0 ? [] : ['']), ...lines, `  ${field}`];
}

function decoratorName(decorator: string): string[] {
  return decorator.startsWith('//') ? [] : [decorator.slice(0, decorator.indexOf('('))];
}
