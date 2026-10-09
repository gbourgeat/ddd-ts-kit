import { ASTUtils, AST_NODE_TYPES, TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { calleeName, methodChain, missingKeys } from '../support/calls.js';
import { defineRule } from '../support/define-rule.js';
import { propertyName } from '../support/globals.js';
import { inContext } from '../support/imports.js';

type MessageId = 'consumerName' | 'subscription' | 'directSubscribe';
type Finding = TSESLint.ReportDescriptor<MessageId> | undefined;
type Source = Readonly<TSESLint.SourceCode>;

const EVENTS = '@ddd-ts-kit/events';
const HANDLER_BINDINGS = new Set(['handledBy', 'handledByFactory']);

const WHY = 'Delivery is at least once: without a stable consumer name and a processed-event store, a redelivered event is handled twice.';

export const eventsConsumerIdempotent = defineRule<MessageId>({
  id: 'events/consumer-idempotent',
  type: 'problem',
  recommended: 'error',
  description: 'Every consumer of an integration event is registered with a stable consumer name and a processed-event store.',
  messages: {
    consumerName: `This consumer is declared without a name. ${WHY} Write \`.on(<definition>, { consumer: '{{context}}.<reaction>' })\`: the name is the idempotency scope and must never change.`,
    subscription: `This subscription gives no {{missing}}. ${WHY} Pass \`{ consumer: '{{context}}.<reaction>', processed: <the processed-event store> }\` as third argument, or use \`consume\`, which also commits the mark with the handler.`,
    directSubscribe: `{{call}}() subscribes a handler that nothing deduplicates. ${WHY} Declare the consumer with \`builder.on(<definition>, { consumer })\` in the module, or wrap the handler with \`on\` or \`consume\` of ${EVENTS}.`,
  },
  create({ file, sourceCode, report }) {
    const here = inContext(file);
    if (here === undefined || file.isTest) return {};
    const subscribesHere = here.layer === 'application' || here.layer === 'module';
    const tell = (finding: Finding): void => {
      if (finding !== undefined) report({ ...finding, data: { ...finding.data, context: here.context } });
    };
    return {
      CallExpression(node) {
        tell(unnamedConsumer(node));
        tell(unprotectedSubscription(node, sourceCode));
        if (subscribesHere) tell(directSubscription(node, sourceCode));
      },
    };
  },
});

/** `builder.on(definition, options).handledBy(Consumer)`: the chain tells this `on` from the one of an event emitter. */
function unnamedConsumer(node: TSESTree.CallExpression): Finding {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression || !HANDLER_BINDINGS.has(calleeName(node) ?? '')) return undefined;
  const [declaration] = methodChain(node);
  if (declaration?.name !== 'on' || missingKeys(declaration.call.arguments[1], ['consumer']).length === 0) return undefined;
  return { node: declaration.call, messageId: 'consumerName' };
}

function unprotectedSubscription(node: TSESTree.CallExpression, sourceCode: Source): Finding {
  if (node.callee.type !== AST_NODE_TYPES.Identifier || !isImportOf(sourceCode, node.callee, 'on')) return undefined;
  const missing = missingKeys(node.arguments[2], ['consumer', 'processed']);
  return missing.length === 0 ? undefined : { node, messageId: 'subscription', data: { missing: missing.map((key) => `\`${key}\``).join(' and ') } };
}

function isImportOf(sourceCode: Source, identifier: TSESTree.Identifier, exported: string): boolean {
  const definition = ASTUtils.findVariable(sourceCode.getScope(identifier), identifier.name)?.defs[0];
  if (definition?.type !== TSESLint.Scope.DefinitionType.ImportBinding || definition.node.type !== AST_NODE_TYPES.ImportSpecifier) return false;
  const { imported } = definition.node;
  return definition.parent.type === AST_NODE_TYPES.ImportDeclaration && definition.parent.source.value === EVENTS && imported.type === AST_NODE_TYPES.Identifier && imported.name === exported;
}

function directSubscription(node: TSESTree.CallExpression, sourceCode: Source): Finding {
  const { callee } = node;
  if (callee.type !== AST_NODE_TYPES.MemberExpression || propertyName(callee) !== 'subscribe' || node.arguments.some(isDeduplicated)) return undefined;
  return { node, messageId: 'directSubscribe', data: { call: sourceCode.getText(callee) } };
}

/** `idempotent(name, store, handler)` of the kernel is the primitive `on` and `consume` are built on. */
function isDeduplicated(argument: TSESTree.CallExpressionArgument): boolean {
  return argument.type === AST_NODE_TYPES.CallExpression && calleeName(argument) === 'idempotent';
}
