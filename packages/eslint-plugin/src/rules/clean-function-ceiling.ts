import { FUNCTION_LINES_CEILING } from '../project/parse-config.js';
import { defineRule } from '../support/rule/define-rule.js';
import { codeLines } from '../support/functions/code-lines.js';
import { describedFunction } from '../support/functions/described-function.js';
import type { FunctionNode } from '../support/functions/function-node.js';

/**
 * The hard ceiling of clean/function-size. ESLint gives one severity to a rule name, so the
 * part that is an error whatever the configured limit is a rule of its own.
 */
export const cleanFunctionCeiling = defineRule<'ceiling'>({
  id: 'clean/function-size',
  name: 'clean-function-ceiling',
  type: 'suggestion',
  recommended: 'error',
  description: 'No function is longer than 100 lines of code, whatever the configured limit: not a test suite, not a module file.',
  messages: {
    ceiling:
      '{{name}} is {{count}} lines long: no function goes past {{limit}} lines, a `describe` callback and a module file included. Split it by responsibility: one function per step, one `describe` (or one spec file) per behaviour, one registration function per group of bindings.',
  },
  create({ sourceCode, report }) {
    const judge = (node: FunctionNode): void => {
      const count = codeLines(node, sourceCode);

      if (count > FUNCTION_LINES_CEILING) report({ loc: describedFunction(node, sourceCode).loc, messageId: 'ceiling', data: { name: describedFunction(node, sourceCode).name, count, limit: FUNCTION_LINES_CEILING } });
    };

    return { FunctionDeclaration: judge, FunctionExpression: judge, ArrowFunctionExpression: judge };
  },
});
