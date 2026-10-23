import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { FUNCTION_LINES_CEILING } from '../project/parse-config';
import { defineRule } from '../support/rule/define-rule';
import { codeLines } from '../support/functions/code-lines';
import { describedFunction } from '../support/functions/described-function';
import type { FunctionNode } from '../support/functions/function-node';

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

/** Who acts and when: the context of an intention, not counted among the parameters it takes. */
const CONTEXT_TYPES = new Set(['Actor', 'Date']);

export const cleanFunctionSize = defineRule<'parameters' | 'lines', [Options]>({
  id: 'clean/function-size',
  type: 'suggestion',
  recommended: 'warn',
  description:
    'A function has at most 3 parameters and 30 lines (configurable, never above 100 lines); a longer one is doing more than one thing.',
  messages: {
    parameters:
      '{{name}} takes {{count}} parameters (limit {{limit}}, an actor or an instant not counted). Group the parameters that travel together into a typed props object or a value object (`Invoice.draft({ customer, lines, currency, draftedAt })`): they are a concept that has no name yet. Never add one more parameter, nor split the function only to get under the limit.',
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
      const parameters = countedParameters(node.params.filter((parameter) => !isThisParameter(parameter)));

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

/** The parameters a signature is judged on: one typed `Actor` or `Date`, who acts and when, is not counted. */
function countedParameters(parameters: readonly TSESTree.Parameter[]): number {
  return parameters.some(isContextParameter) ? parameters.length - 1 : parameters.length;
}

function isContextParameter(parameter: TSESTree.Parameter): boolean {
  const annotation =
    parameter.type === AST_NODE_TYPES.Identifier ? parameter.typeAnnotation?.typeAnnotation : undefined;

  return (
    annotation?.type === AST_NODE_TYPES.TSTypeReference &&
    annotation.typeName.type === AST_NODE_TYPES.Identifier &&
    CONTEXT_TYPES.has(annotation.typeName.name) &&
    parameter.type === AST_NODE_TYPES.Identifier &&
    !parameter.optional
  );
}

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
