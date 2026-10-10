import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { calleeName } from '../support/calls/callee-name.js';
import { hasSpread } from '../support/calls/has-spread.js';
import { methodChain } from '../support/calls/method-chain.js';
import { propertyOf } from '../support/calls/property-of.js';
import { className, type ClassNode } from '../support/classes/class-name.js';
import { constructorOf } from '../support/classes/constructor-of.js';
import { exportedClasses } from '../support/classes/exported-classes.js';
import { ACCESS_DECORATORS } from '../support/declarations/access-decorators.js';
import { DECLARATIONS_ENTRY, declarationReader } from '../support/declarations/declaration-reader.js';
import { declaredRoleOf } from '../support/declarations/declared-role-of.js';
import { isDeclaredStyle } from '../support/declarations/is-declared-style.js';
import { defineRule } from '../support/rule/define-rule.js';
import type { LintedFile } from '../project/linted-file.js';
import { inLayer } from '../support/imports/in-layer.js';
import { staticString } from '../support/imports/static-string.js';
import { classFinder, type ClassFinder } from '../support/classes/class-finder.js';
import { parameterBinding } from '../support/types/parameter-binding.js';

type MessageId = 'useCase' | 'message' | 'route' | 'emptySecurity' | 'actor';
type Finding = TSESLint.ReportDescriptor<MessageId> | undefined;

const REGISTRATIONS = new Set(['command', 'query']);
const HANDLER_BINDINGS = new Set(['handledBy', 'handledByFactory']);
const DECLARATIONS = new Set(['requires', 'public']);
const AUTHORIZED_BASES = new Set(['AuthorizedCommand', 'AuthorizedQuery']);

export const authzDeclared = defineRule<MessageId>({
  id: 'authz/declared',
  type: 'problem',
  recommended: 'error',
  description:
    'Every command, query and route declares the permission it requires, or declares itself public, in its module registration or on the message class: nothing is reachable by default.',
  messages: {
    useCase:
      'The {{kind}} {{name}} is registered without saying who may send it. Insert `.requires(<a permission of application/authorization>)` before `.{{binding}}(...)`, or `.public()` if anybody may: nothing is reachable by default.',
    message: `The {{kind}} {{className}} says nothing about who may send it. Put \`@Requires(<a permission of application/authorization>)\` from "${DECLARATIONS_ENTRY}" on the class, or \`@Public()\` if anybody may: nothing is reachable by default.`,
    route:
      "The route {{route}} declares no `security`. Add `security: ['<scheme>']` with the security schemes that apply, or `security: false` if the route is public.",
    emptySecurity:
      'The route {{route}} declares `security: []`: no scheme applies, so it is public by accident. Name the schemes that apply, or write `security: false`.',
    actor:
      '{{className}} extends {{base}} but does not hand the actor it is given to `super(...)`. Take the actor as the first constructor parameter and pass it on, `constructor(actor: Actor, ...) { super(actor); }`: the caller says who acts, the message never decides it.',
  },
  create({ file, sourceCode, context, report }) {
    if (file.isTest) {
      return {};
    }

    const isModule = inLayer(file, 'module') !== undefined;
    const findClass = classFinder(file, sourceCode.ast, context.languageOptions.parser);

    const tell = (finding: Finding): void => {
      if (finding !== undefined) {
        report(finding);
      }
    };

    const judgeClass = (node: ClassNode): void => tell(unforwardedActor(node));

    return {
      Program: (program) => undeclaredMessages(file, program).forEach(tell),
      CallExpression(node) {
        if (isModule) {
          tell(undeclaredUseCase(node, sourceCode, findClass));
        }

        tell(undeclaredRoute(node));
      },
      ClassDeclaration: judgeClass,
      ClassExpression: judgeClass,
    };
  },
});

/** In the declared style the message class itself says who may send it: there is no registration to read. */
function undeclaredMessages(file: LintedFile, program: TSESTree.Program): Finding[] {
  const role = isDeclaredStyle(file) ? declaredRoleOf(file) : undefined;

  if (role?.decorators.some((decorator) => ACCESS_DECORATORS.has(decorator)) !== true) {
    return [];
  }

  const declarationsOf = declarationReader(program);

  const silent = exportedClasses(program).filter(
    (node) => !declarationsOf(node).some((declaration) => ACCESS_DECORATORS.has(declaration.name)),
  );

  return silent.map((node) => ({
    node: node.id ?? node,
    messageId: 'message',
    data: { kind: role.suffix, className: className(node) },
  }));
}

function undeclaredUseCase(
  node: TSESTree.CallExpression,
  sourceCode: Readonly<TSESLint.SourceCode>,
  findClass: ClassFinder,
): Finding {
  const binding = node.callee.type === AST_NODE_TYPES.MemberExpression ? (calleeName(node) ?? '') : '';

  if (!HANDLER_BINDINGS.has(binding)) {
    return undefined;
  }

  const chain = methodChain(node);
  const [registration] = chain;

  if (
    registration === undefined ||
    !REGISTRATIONS.has(registration.name) ||
    chain.some((link) => DECLARATIONS.has(link.name))
  ) {
    return undefined;
  }

  const [message] = registration.call.arguments;

  if (isDeclaredMessage(message, findClass)) {
    return undefined;
  }

  const name = message === undefined ? 'registered here' : sourceCode.getText(message);

  return { node: registration.call, messageId: 'useCase', data: { kind: registration.name, name, binding } };
}

/** `@Requires(...)` or `@Public()` on the message class is the declaration, whoever registers the message. */
function isDeclaredMessage(message: TSESTree.CallExpressionArgument | undefined, findClass: ClassFinder): boolean {
  const site = message?.type === AST_NODE_TYPES.Identifier ? findClass(message.name) : undefined;

  return (
    site !== undefined &&
    declarationReader(site.program)(site.node).some((declaration) => ACCESS_DECORATORS.has(declaration.name))
  );
}

function undeclaredRoute(node: TSESTree.CallExpression): Finding {
  const [spec] = node.arguments;

  if (calleeName(node) !== 'defineRoute' || spec?.type !== AST_NODE_TYPES.ObjectExpression) {
    return undefined;
  }

  const messageId = judgeSecurity(spec);

  return messageId === undefined
    ? undefined
    : { node: propertyOf(spec, 'security') ?? spec, messageId, data: { route: routeLabel(spec) } };
}

function judgeSecurity(spec: TSESTree.ObjectExpression): 'route' | 'emptySecurity' | undefined {
  const security = propertyOf(spec, 'security');

  if (security === undefined) {
    return hasSpread(spec) ? undefined : 'route';
  }

  const { value } = security;

  if (value.type === AST_NODE_TYPES.ArrayExpression) {
    return value.elements.length === 0 ? 'emptySecurity' : undefined;
  }

  return value.type === AST_NODE_TYPES.Identifier && value.name === 'undefined' ? 'route' : undefined;
}

function routeLabel(spec: TSESTree.ObjectExpression): string {
  const named = propertyOf(spec, 'operationId') ?? propertyOf(spec, 'path');
  const label = named === undefined ? undefined : staticString(named.value);

  return label === undefined ? 'defined here' : `"${label}"`;
}

function unforwardedActor(node: ClassNode): Finding {
  const base = node.superClass === null ? undefined : baseName(node.superClass);
  const constructor = constructorOf(node.body);

  if (base === undefined || !AUTHORIZED_BASES.has(base) || constructor === undefined) {
    return undefined;
  }

  const call = superCall(constructor);

  if (call === undefined || forwardsParameter(call, constructor)) {
    return undefined;
  }

  return { node: call, messageId: 'actor', data: { className: className(node), base } };
}

function baseName(superClass: TSESTree.Expression): string | undefined {
  if (superClass.type === AST_NODE_TYPES.Identifier) {
    return superClass.name;
  }

  return superClass.type === AST_NODE_TYPES.MemberExpression && superClass.property.type === AST_NODE_TYPES.Identifier
    ? superClass.property.name
    : undefined;
}

function superCall(constructor: TSESTree.MethodDefinition): TSESTree.CallExpression | undefined {
  for (const statement of constructor.value.body?.body ?? []) {
    const expression = statement.type === AST_NODE_TYPES.ExpressionStatement ? statement.expression : undefined;

    if (expression?.type === AST_NODE_TYPES.CallExpression && expression.callee.type === AST_NODE_TYPES.Super) {
      return expression;
    }
  }

  return undefined;
}

/** `super(actor)` or `super(input.actor)`, where the first name is a parameter of the constructor. */
function forwardsParameter(call: TSESTree.CallExpression, constructor: TSESTree.MethodDefinition): boolean {
  let root: TSESTree.Node | undefined = call.arguments[0];

  while (root?.type === AST_NODE_TYPES.MemberExpression) {
    root = root.object;
  }

  if (root?.type !== AST_NODE_TYPES.Identifier) {
    return false;
  }

  const given = root.name;

  return constructor.value.params
    .map(parameterBinding)
    .some((binding) => binding.type === AST_NODE_TYPES.Identifier && binding.name === given);
}
