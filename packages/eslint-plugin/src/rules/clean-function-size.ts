import { ASTUtils, AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { defineRule } from '../support/define-rule.js';

type FunctionNode = TSESTree.ArrowFunctionExpression | TSESTree.FunctionDeclaration | TSESTree.FunctionExpression;

interface Options {
  readonly maxParameters?: number;
  readonly maxLines?: number;
}

const GROUPING_CALLS = new Set(['describe', 'suite', 'context']);

export const cleanFunctionSize = defineRule<'parameters' | 'lines', [Options]>({
  id: 'clean/function-size',
  type: 'suggestion',
  recommended: 'warn',
  description: 'A function has at most 3 parameters and 30 lines (configurable); a longer one is doing more than one thing.',
  messages: {
    parameters:
      '{{name}} takes {{count}} parameters (limit {{limit}}). Group the parameters that travel together into a value object or a named parameter object: they are a concept that has no name yet.',
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
    const maxLines = options.maxLines ?? file.config.limits.maxFunctionLines;
    const isComposition = file.location.area === 'context' && file.location.layer === 'module';
    const judge = (node: FunctionNode): void => {
      const name = capitalize(ASTUtils.getFunctionNameWithKind(node, sourceCode));
      const loc = ASTUtils.getFunctionHeadLocation(node, sourceCode);
      const parameters = node.params.filter((parameter) => !isThisParameter(parameter)).length;
      // A constructor lists the dependencies it is given: that is wiring, not a signature to shorten.
      if (parameters > maxParameters && !isConstructor(node)) report({ loc, messageId: 'parameters', data: { name, count: parameters, limit: maxParameters } });
      const lines = isComposition || isGroupingCallback(node) ? 0 : codeLines(node, sourceCode);
      if (lines > maxLines) report({ loc, messageId: 'lines', data: { name, count: lines, limit: maxLines } });
    };
    return { FunctionDeclaration: judge, FunctionExpression: judge, ArrowFunctionExpression: judge };
  },
});

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function isThisParameter(parameter: TSESTree.Parameter): boolean {
  return parameter.type === AST_NODE_TYPES.Identifier && parameter.name === 'this';
}

function isConstructor(node: FunctionNode): boolean {
  return node.parent.type === AST_NODE_TYPES.MethodDefinition && node.parent.kind === 'constructor';
}

/** The callback of `describe(...)` holds tests, not steps: its length says nothing about one thing. */
function isGroupingCallback(node: FunctionNode): boolean {
  if (node.parent.type !== AST_NODE_TYPES.CallExpression || !node.parent.arguments.some((argument) => argument === node)) return false;
  let callee: TSESTree.Node = node.parent.callee;
  if (isInjectedGrouping(callee)) return true;
  while (callee.type === AST_NODE_TYPES.MemberExpression || callee.type === AST_NODE_TYPES.CallExpression) {
    callee = callee.type === AST_NODE_TYPES.MemberExpression ? callee.object : callee.callee;
  }
  return callee.type === AST_NODE_TYPES.Identifier && GROUPING_CALLS.has(callee.name);
}

/** `runner.describe(...)`: a contract suite receives its test runner instead of importing it. */
function isInjectedGrouping(callee: TSESTree.Node): boolean {
  return (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    callee.property.type === AST_NODE_TYPES.Identifier &&
    GROUPING_CALLS.has(callee.property.name)
  );
}

/** Lines of the body that hold code: blank lines and comment lines carry no token. */
function codeLines(node: FunctionNode, sourceCode: Readonly<TSESLint.SourceCode>): number {
  const tokens = sourceCode.getTokens(node.body);
  const inside = node.body.type === AST_NODE_TYPES.BlockStatement ? tokens.slice(1, -1) : tokens;
  const lines = new Set<number>();
  for (const token of inside) {
    for (let line = token.loc.start.line; line <= token.loc.end.line; line += 1) lines.add(line);
  }
  return lines.size;
}
