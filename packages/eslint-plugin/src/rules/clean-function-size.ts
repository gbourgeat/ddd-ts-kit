import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { FUNCTION_LINES_CEILING } from '../project/parse-config.js';
import { defineRule } from '../support/rule/define-rule.js';
import { codeLines } from '../support/functions/code-lines.js';
import { describedFunction } from '../support/functions/described-function.js';
import type { FunctionNode } from '../support/functions/function-node.js';

interface Options {
  readonly maxParameters?: number;
  readonly maxLines?: number;
}

const GROUPING_CALLS = new Set(['describe', 'suite', 'context']);

/** What a test runner chains on a grouping call (`describe.each`, `describe.skip`): `context.run` is not one. */
const RUNNER_MODIFIERS = new Set([
  'each',
  'skip',
  'only',
  'todo',
  'concurrent',
  'sequential',
  'shuffle',
  'skipIf',
  'runIf',
  'fails',
]);

export const cleanFunctionSize = defineRule<'parameters' | 'lines', [Options]>({
  id: 'clean/function-size',
  type: 'suggestion',
  recommended: 'warn',
  description:
    'A function has at most 3 parameters and 30 lines (configurable, never above 100 lines); a longer one is doing more than one thing.',
  messages: {
    parameters:
      '{{name}} takes {{count}} parameters (limit {{limit}}). Group the parameters that travel together into a typed props object or a value object (`Invoice.draft({ customer, lines, currency, draftedAt })`): they are a concept that has no name yet. Never add one more parameter, nor split the function only to get under the limit.',
    lines:
      '{{name}} is {{count}} lines long (limit {{limit}}). Extract each step into a function named after what it does, placed below this one, until the body reads as a list of intentions.',
  },
  schema: [
    {
      type: 'object',
      additionalProperties: false,
      properties: { maxParameters: { type: 'integer', minimum: 1 }, maxLines: { type: 'integer', minimum: 1 } },
    },
  ],
  defaultOptions: [{}],
  create({ file, sourceCode, options: [options], report }) {
    const maxParameters = options.maxParameters ?? file.config.limits.maxParameters;
    const maxLines = Math.min(options.maxLines ?? file.config.limits.maxFunctionLines, FUNCTION_LINES_CEILING);
    const isComposition = file.location.area === 'context' && file.location.layer === 'module';

    const judge = (node: FunctionNode): void => {
      const { name, loc } = describedFunction(node, sourceCode);
      const parameters = node.params.filter((parameter) => !isThisParameter(parameter)).length;

      // A constructor lists the dependencies it is given: that is wiring, not a signature to shorten.
      if (parameters > maxParameters && !isConstructor(node)) {
        report({ loc, messageId: 'parameters', data: { name, count: parameters, limit: maxParameters } });
      }

      const lines = isComposition || isGroupingCallback(node) ? 0 : codeLines(node, sourceCode);

      if (lines > maxLines) {
        report({ loc, messageId: 'lines', data: { name, count: lines, limit: maxLines } });
      }
    };

    return { FunctionDeclaration: judge, FunctionExpression: judge, ArrowFunctionExpression: judge };
  },
});

function isThisParameter(parameter: TSESTree.Parameter): boolean {
  return parameter.type === AST_NODE_TYPES.Identifier && parameter.name === 'this';
}

function isConstructor(node: FunctionNode): boolean {
  return node.parent.type === AST_NODE_TYPES.MethodDefinition && node.parent.kind === 'constructor';
}

/** The callback of `describe(...)` holds tests, not steps: its length says nothing about one thing. */
function isGroupingCallback(node: FunctionNode): boolean {
  if (
    node.parent.type !== AST_NODE_TYPES.CallExpression ||
    !node.parent.arguments.some((argument) => argument === node)
  ) {
    return false;
  }

  let callee: TSESTree.Node = node.parent.callee;

  if (isInjectedGrouping(callee)) {
    return true;
  }

  const chained: string[] = [];

  while (callee.type === AST_NODE_TYPES.MemberExpression || callee.type === AST_NODE_TYPES.CallExpression) {
    if (callee.type === AST_NODE_TYPES.MemberExpression) {
      chained.push(callee.property.type === AST_NODE_TYPES.Identifier ? callee.property.name : '');
      callee = callee.object;
    } else {
      callee = callee.callee;
    }
  }

  return (
    callee.type === AST_NODE_TYPES.Identifier &&
    GROUPING_CALLS.has(callee.name) &&
    chained.every((modifier) => RUNNER_MODIFIERS.has(modifier))
  );
}

/** `runner.describe(...)`: a contract suite receives its test runner instead of importing it. */
function isInjectedGrouping(callee: TSESTree.Node): boolean {
  return (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    callee.property.type === AST_NODE_TYPES.Identifier &&
    GROUPING_CALLS.has(callee.property.name)
  );
}
