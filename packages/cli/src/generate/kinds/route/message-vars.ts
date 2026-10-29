import type { RenderContext } from '../../../templating';
import type { Scope } from '../../scope';
import { describedField } from './described-field';
import type { FieldKind, MessagePlan, ReadField } from './message-plan';
import type { Routed } from './plan-of';
import { standardSchemaOf } from './standard-schema-of';
import { writesBodyOf } from './writes-body-of';
import { writesParamsOf } from './writes-params-of';
import { messageCall } from './message-call';

/** How each library declares one field of a body. */
const ZOD: Readonly<Record<FieldKind, string>> = { string: 'z.string()', number: 'z.number()', boolean: 'z.boolean()' };

const TYPEBOX: Readonly<Record<FieldKind, string>> = {
  string: 'Type.String()',
  number: 'Type.Number()',
  boolean: 'Type.Boolean()',
};

const DECORATORS: Readonly<Record<FieldKind, string>> = {
  string: 'IsString',
  number: 'IsNumber',
  boolean: 'IsBoolean',
};

const INITIAL: Readonly<Record<FieldKind, string>> = { string: "''", number: '0', boolean: 'false' };

/** The body of a route, as its library declares it. */
interface Declared {
  readonly scope: Scope;
  readonly routed: Routed;
  readonly body: readonly ReadField[];
  readonly todo: string;
}

/**
 * What the templates of a route, a controller and a Nest controller read of the message they
 * build: the call, the schema of the body (and of the path parameters under Standard Schema),
 * written field by field from the constructor of the command or the query.
 */
export function messageVars(scope: Scope, routed: Routed, plan: MessagePlan): RenderContext {
  const { useCase } = routed;
  const { validation } = scope.config.stack;
  const body = plan.read.filter((field) => field.from === 'body');
  const todo = unreadTodo(plan);

  return {
    readsMessage: plan.unread.length === 0 && plan.read.length > 0,
    writesBody: writesBodyOf(plan),
    writesParams: writesParamsOf(validation, plan),
    routeMessage: messageCall(useCase, plan, {
      actor: 'actorOf(input.context.principal)',
      field: (field) => `input.${field.from}.${field.name}`,
    }),
    nestMessage: messageCall(useCase, plan, { actor: 'actor', field: (field) => `${field.from}.${field.name}` }),
    bodyDeclaration: body.length === 0 ? '' : bodyDeclarationOf({ scope, routed, body, todo }),
    paramsDeclaration: writesParamsOf(validation, plan) ? paramsDeclarationOf(scope, routed) : '',
    ...dtoBodyVars(scope, body, todo),
  };
}

/** Every path parameter of the route, each a string as the path gives it: none is dropped from the request. */
function paramsDeclarationOf(scope: Scope, { name, endpoint }: Routed): string {
  const fields = endpoint.parameters.map(
    (parameter): ReadField => ({ name: parameter, type: 'string', optional: false, kind: 'string', from: 'params' }),
  );

  return standardSchemaOf({ name, vendor: scope.context.kebab, part: 'params', fields, todo: '' });
}

/** The decorated fields of the body class, written where the route has one: class-validator, and Nest whatever it validates with. */
function dtoBodyVars(scope: Scope, body: readonly ReadField[], todo: string): RenderContext {
  const { validation, routes } = scope.config.stack;

  if (body.length === 0 || (validation !== 'class-validator' && routes !== 'nest')) {
    return { dtoBodyImports: '', dtoBodyFields: '' };
  }

  return {
    dtoBodyImports: `import { ${[...new Set(body.map((field) => DECORATORS[field.kind]))].sort().join(', ')} } from 'class-validator';`,
    dtoBodyFields: [...body.map(dtoFieldOf), ...todoLines(todo, '  ')].join('\n'),
  };
}

function bodyDeclarationOf({ scope, routed, body, todo }: Declared): string {
  const lines = (declared: Readonly<Record<FieldKind, string>>): string[] => [
    ...body.map((field) => `    ${field.name}: ${declared[field.kind]},`),
    ...todoLines(todo, '    '),
  ];

  switch (scope.config.stack.validation) {
    case 'zod':
      return ['const body = zodSchema(', '  z.object({', ...lines(ZOD), '  }),', ');'].join('\n');
    case 'typebox':
      return ['const body = typeboxSchema(', '  Type.Object({', ...lines(TYPEBOX), '  }),', ');'].join('\n');
    case 'class-validator':
      return `const body = classSchema(${routed.name.pascal}Body);`;
    default:
      return standardSchemaOf({ name: routed.name, vendor: scope.context.kebab, part: 'body', fields: body, todo });
  }
}

function dtoFieldOf(field: ReadField, index: number): string {
  return `${index === 0 ? '' : '\n'}  @${DECORATORS[field.kind]}()\n  ${field.name} = ${INITIAL[field.kind]};`;
}

/** What the generator could not read in the body, said in its schema: the path and the request say theirs at the call. */
function unreadTodo({ unread }: MessagePlan): string {
  const sent = unread.filter((field) => field.from === 'body');

  if (sent.length === 0) {
    return '';
  }

  return `TODO(domain): declare what the client sends for ${sent.map(describedField).join(', ')}, with shape constraints only (types, formats, lengths), and pass it to the message; business rules stay in the domain.`;
}

function todoLines(todo: string, indent: string): string[] {
  return todo === '' ? [] : [`${indent}// ${todo}`];
}
