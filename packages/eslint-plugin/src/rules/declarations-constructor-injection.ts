import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { className, type ClassNode } from '../support/classes/class-name.js';
import { constructorOf } from '../support/classes/constructor-of.js';
import { ACCESS_DECORATORS } from '../support/declarations/access-decorators.js';
import { declarationReader } from '../support/declarations/declaration-reader.js';
import { declaredRoleOf } from '../support/declarations/declared-role-of.js';
import { isDeclaredStyle } from '../support/declarations/is-declared-style.js';
import { notClasses } from '../support/injection/not-classes.js';
import type { ParameterReading } from '../support/injection/parameter-reading.js';
import { readParameter } from '../support/injection/read-parameter.js';
import { writtenName } from '../support/injection/written-name.js';
import { defineRule } from '../support/rule/define-rule.js';

type MessageId = 'parameter' | 'redundant' | 'differs';
type Finding = TSESLint.ReportDescriptor<MessageId>;

interface Read {
  readonly node: TSESTree.Parameter;
  readonly reading: ParameterReading;
}

export const declarationsConstructorInjection = defineRule<MessageId>({
  id: 'declarations/constructor-injection',
  type: 'problem',
  recommended: 'error',
  fixable: 'code',
  description:
    'In a declared-style project, a class whose decorator lists no dependency states them in its constructor, each parameter typed by one class; under "stack.dependencies": "signature" a decorator carries no list.',
  messages: {
    parameter:
      'Parameter "{{name}}" of the constructor of {{className}} {{flaw}}. Type it by one class and nothing else: a port (an abstract class of application/ports or domain/repositories), a port of the kernel, another declared class, or an abstract class with readonly members that the platform binds to a value. The composition root injects each constructor parameter by the class that types it.',
    redundant:
      'The decorator of {{className}} lists [{{listed}}], which its constructor already states. Remove the list: the constructor signature is the one statement of what a class depends on, and `ddd-ts-kit docs` reads it.',
    differs:
      'The decorator of {{className}} lists [{{listed}}] and its constructor says something else: the list wins at run time, so the signature lies. Type each constructor parameter by the class its list entry names (the token is the type), then remove the list.',
  },
  create({ file, sourceCode, report }) {
    if (file.isTest || !isDeclaredStyle(file) || declaredRoleOf(file) === undefined) {
      return {};
    }

    const declarationsOf = declarationReader(sourceCode.ast);
    const declaredOtherwise = notClasses(sourceCode.ast);
    const signature = file.config.stack.dependencies === 'signature';

    const judgeClass = (node: ClassNode): void => {
      const [declaration] = declarationsOf(node).filter(({ name }) => !ACCESS_DECORATORS.has(name));
      const written = constructorOf(node.body);

      if (declaration === undefined || (written === undefined && node.superClass !== null)) {
        return;
      }

      const read = (written?.value.params ?? []).map((parameter) => ({
        node: parameter,
        reading: readParameter(parameter, declaredOtherwise),
      }));

      const list = declaration.arguments.at(-1);

      const findings =
        list?.type === AST_NODE_TYPES.ArrayExpression ? listed(node, { list, read, signature }) : unstated(node, read);

      findings.forEach(report);
    };

    return { ClassDeclaration: judgeClass, ClassExpression: judgeClass };
  },
});

function unstated(node: ClassNode, read: readonly Read[]): Finding[] {
  return read.flatMap(({ node: parameter, reading }) =>
    reading.flaw === undefined
      ? []
      : [
          {
            node: parameter,
            messageId: 'parameter' as const,
            data: { name: writtenName(parameter), className: className(node), flaw: reading.flaw },
          },
        ],
  );
}

interface Listed {
  readonly list: TSESTree.ArrayExpression;
  readonly read: readonly Read[];
  /** True when the project states dependencies in constructor signatures. */
  readonly signature: boolean;
}

function listed(node: ClassNode, { list, read, signature }: Listed): Finding[] {
  if (!signature) {
    return [];
  }

  const names = list.elements.map((element) => (element?.type === AST_NODE_TYPES.Identifier ? element.name : '?'));
  const typed = read.map(({ reading }) => reading.token ?? '');
  const same = names.length === typed.length && names.every((name, index) => name === typed[index]);
  const data = { className: className(node), listed: names.join(', ') };

  return [
    same
      ? { node: list, messageId: 'redundant', data, fix: withoutList(list) }
      : { node: list, messageId: 'differs', data },
  ];
}

/** Removes the list with the comma before it: `@CommandHandler(PlaceOrder, [Clock])` becomes `@CommandHandler(PlaceOrder)`. */
function withoutList(list: TSESTree.ArrayExpression): TSESLint.ReportFixFunction {
  return (fixer) => {
    const call = list.parent;

    const before =
      call.type === AST_NODE_TYPES.CallExpression ? call.arguments[call.arguments.indexOf(list) - 1] : undefined;

    return before === undefined ? null : fixer.removeRange([before.range[1], list.range[1]]);
  };
}
