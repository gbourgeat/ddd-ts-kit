import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../project/linted-file';
import { propertyName } from '../support/globals/property-name';
import { defineRule } from '../support/rule/define-rule';

const THROW_MATCHERS = new Set(['toThrow', 'toThrowError']);

/** The spec of an adapter, wherever it sits: what it asserts about the outside system is technical. */
const ADAPTER_SPEC = /\.adapter\.(?:spec|test)\.ts$/;

/** What `toThrow` compares the failure with, when it is not its code and facts. */
type By = 'nothing' | 'its message' | 'its class';

export const testRefusalByCode = defineRule<'by'>({
  id: 'test/refusal-by-code',
  type: 'suggestion',
  recommended: 'warn',
  transition: '0.90.0',
  description:
    'A refusal of the model or of the application is asserted by its code and its facts, never by its message or the class of one error: `thenError`, `expectRefusal`, `rejects.toMatchObject({ code })`, `expectProblem`; `toThrow` with a message, a class or nothing is reported, outside the specs of the adapters and of the platform.',
  messages: {
    by: "`{{matcher}}` asserts a refusal by {{by}}. A refusal is asserted by its code and its facts, which a client and a reader rely on, never by a message or the class of one error: on an aggregate `given(...).when(...).thenError('INVOICE_ALREADY_PAID', facts)`, on an action `expectRefusal(() => Email.create(raw), 'INVALID_EMAIL', facts)`, through the bus `await expect(bus.execute(command)).rejects.toMatchObject({ code: 'FORBIDDEN' })`, end to end `expectProblem(response, { status: 409, code: 'SLOT_TAKEN' })`; a failure the test injected (`mailer.failNextWith(outage)`) is asserted as itself, `rejects.toBe(outage)`.",
  },
  create({ file, report }) {
    if (!file.isTest || isTechnical(file)) {
      return {};
    }

    return {
      CallExpression(node: TSESTree.CallExpression) {
        const { callee } = node;

        if (callee.type !== AST_NODE_TYPES.MemberExpression) {
          return;
        }

        const matcher = propertyName(callee) ?? '';

        if (!THROW_MATCHERS.has(matcher) || isNegated(callee.object)) {
          return;
        }

        const by = comparedBy(node.arguments[0]);

        if (by !== undefined) {
          report({ node: callee.property, messageId: 'by', data: { matcher, by } });
        }
      },
    };
  },
});

/** The platform, an adapter and the integration specs of a context assert technical failures, whose message is what an operator reads. */
function isTechnical(file: LintedFile): boolean {
  const { location } = file;

  if (location.area === 'platform' || ADAPTER_SPEC.test(file.path)) {
    return true;
  }

  return location.area === 'context' && location.layer === 'test' && location.inside[0] === 'integration';
}

/** `expect(action).not.toThrow()` asserts that the action is accepted: not a refusal. */
function isNegated(object: TSESTree.Expression): boolean {
  let current: TSESTree.Expression = object;

  while (current.type === AST_NODE_TYPES.MemberExpression) {
    if (propertyName(current) === 'not') {
      return true;
    }

    current = current.object;
  }

  return false;
}

/** Nothing for an object or a matcher (`expect.objectContaining({ code })`), which may well name the code. */
function comparedBy(argument: TSESTree.CallExpressionArgument | undefined): By | undefined {
  if (argument === undefined) {
    return 'nothing';
  }

  if (argument.type === AST_NODE_TYPES.Literal || argument.type === AST_NODE_TYPES.TemplateLiteral) {
    return 'its message';
  }

  return argument.type === AST_NODE_TYPES.Identifier ||
    argument.type === AST_NODE_TYPES.MemberExpression ||
    argument.type === AST_NODE_TYPES.NewExpression
    ? 'its class'
    : undefined;
}
