import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { parserOf } from '../support/parse/parser-of';
import { calleeName } from '../support/calls/callee-name';
import { hasSpread } from '../support/calls/has-spread';
import { methodChain } from '../support/calls/method-chain';
import { propertyOf } from '../support/calls/property-of';
import { className, type ClassNode } from '../support/classes/class-name';
import { constructorOf } from '../support/classes/constructor-of';
import { exportedClasses } from '../support/classes/exported-classes';
import { ACCESS_DECORATORS } from '../support/declarations/access-decorators';
import { DECLARATIONS_ENTRY, declarationReader } from '../support/declarations/declaration-reader';
import { declaredRoleOf } from '../support/declarations/declared-role-of';
import { isDeclaredStyle } from '../support/declarations/is-declared-style';
import { defineRule } from '../support/rule/define-rule';
import type { LintedFile } from '../project/linted-file';
import { inLayer } from '../support/imports/in-layer';
import { staticString } from '../support/imports/static-string';
import { classFinder, type ClassFinder } from '../support/classes/class-finder';
import { parameterBinding } from '../support/types/parameter-binding';

type MessageId = 'useCase' | 'message' | 'route' | 'emptySecurity' | 'controller' | 'actor';
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
    controller:
      'This controller names no `group` and no `guards`: nothing says who may call its route. Name its route group, whose guards stand before it, or write `guards: [Public]` when anybody may call it.',
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
    const findClass = classFinder(file, sourceCode.ast, parserOf(context));

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
      Decorator: (node) => tell(unguardedController(node)),
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

/** `@Controller({ .. })` of @ddd-ts-kit/http names its group or its guards; a declaration built elsewhere is judged at run time. */
function unguardedController({ expression }: TSESTree.Decorator): Finding {
  if (expression.type !== AST_NODE_TYPES.CallExpression || calleeName(expression) !== 'Controller') {
    return undefined;
  }

  const [spec] = expression.arguments;

  if (spec?.type !== AST_NODE_TYPES.ObjectExpression || !isRouteDeclaration(spec)) {
    return undefined;
  }

  return { node: spec, messageId: 'controller' };
}

/** A declaration of a route, with a `method` and a `response`, that names neither a group nor guards. */
function isRouteDeclaration(spec: TSESTree.ObjectExpression): boolean {
  const has = (key: string): boolean => propertyOf(spec, key) !== undefined;

  return !hasSpread(spec) && has('method') && has('response') && !has('group') && !has('guards');
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
