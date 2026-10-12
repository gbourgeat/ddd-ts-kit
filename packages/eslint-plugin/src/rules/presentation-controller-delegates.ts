import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { className } from '../support/classes/class-name.js';
import { constructorOf } from '../support/classes/constructor-of.js';
import { exportedClasses } from '../support/classes/exported-classes.js';
import { declarationReader, type Declaration } from '../support/declarations/declaration-reader.js';
import { defineRule, type Report } from '../support/rule/define-rule.js';
import { parameterTypeName } from '../support/types/parameter-type-name.js';

type MessageId = 'foreignDependency' | 'wrongBus' | 'missingBus';

const BUS_OF: Readonly<Record<string, string>> = {
  GET: 'QueryBus',
  HEAD: 'QueryBus',
  POST: 'CommandBus',
  PUT: 'CommandBus',
  PATCH: 'CommandBus',
  DELETE: 'CommandBus',
};

const BUSES = ['CommandBus', 'QueryBus'];
/** What translates for a controller, by the name of its class: its request mapper and its serializer. */
const TRANSLATOR = /(?:Mapper|Serializer)$/;

export const presentationControllerDelegates = defineRule<MessageId>({
  id: 'presentation/controller-delegates',
  type: 'problem',
  recommended: 'error',
  description:
    'A controller decides nothing: its constructor takes the bus of its method (`CommandBus` for POST, PUT, PATCH and DELETE, `QueryBus` for GET and HEAD), a request mapper and a serializer, and nothing else.',
  messages: {
    foreignDependency:
      '{{className}} is given {{type}}. A controller calls its bus and nothing else: a repository, a port or a service belongs behind a use case. Send a command or a query, and let a request mapper (`*.mapper.ts`) or a serializer (`*.serializer.ts`) translate.',
    wrongBus:
      '{{className}} answers {{method}} and is given the {{given}}. A {{method}} route sends through the {{expected}}: a request that changes something is a command, a request that reads is a query. Change the method, or the use case it calls.',
    missingBus:
      '{{className}} answers {{method}} and is not given the {{expected}}. A controller answers by sending a use case through its bus: take `{{expected}}` in the constructor.',
  },
  create({ file, report }) {
    if (file.isTest || file.location.area !== 'context' || !file.path.endsWith('.controller.ts')) {
      return {};
    }

    return {
      Program(program) {
        const read = declarationReader(program);

        for (const controller of exportedClasses(program)) {
          const declaration = read(controller).find(({ name }) => name === 'Controller');

          if (declaration !== undefined) {
            judgeController(controller, methodOf(declaration), report);
          }
        }
      },
    };
  },
});

type ClassNode = ReturnType<typeof exportedClasses>[number];

function judgeController(controller: ClassNode, method: string | undefined, report: Report<MessageId>): void {
  const owner = className(controller);
  const parameters = constructorOf(controller.body)?.value.params ?? [];
  const types = parameters.map((parameter) => ({ parameter, type: parameterTypeName(parameter) }));
  const expected = method === undefined ? undefined : BUS_OF[method];

  for (const { parameter, type } of types) {
    const messageId = flawOf(type, expected);

    if (messageId !== undefined) {
      const data = { className: owner, type: type ?? 'an untyped value', method, given: type, expected };

      report({ node: parameter, messageId, data });
    }
  }

  if (expected !== undefined && !types.some(({ type }) => type === expected)) {
    report({
      node: controller.id ?? controller,
      messageId: 'missingBus',
      data: { className: owner, method, expected },
    });
  }
}

/** What is wrong with one constructor parameter, by the class that types it. */
function flawOf(type: string | undefined, expected: string | undefined): MessageId | undefined {
  if (type === undefined || (!BUSES.includes(type) && !TRANSLATOR.test(type))) {
    return 'foreignDependency';
  }

  return expected !== undefined && BUSES.includes(type) && type !== expected ? 'wrongBus' : undefined;
}

/** The method the declaration writes as a string literal; a declaration built elsewhere is not read. */
function methodOf({ arguments: [spec] }: Declaration): string | undefined {
  if (spec?.type !== AST_NODE_TYPES.ObjectExpression) {
    return undefined;
  }

  const written = spec.properties.find(
    (property): property is TSESTree.Property =>
      property.type === AST_NODE_TYPES.Property &&
      property.key.type === AST_NODE_TYPES.Identifier &&
      property.key.name === 'method',
  );

  return written?.value.type === AST_NODE_TYPES.Literal && typeof written.value.value === 'string'
    ? written.value.value
    : undefined;
}
