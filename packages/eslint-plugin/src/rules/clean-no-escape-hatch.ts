import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../project/linted-file.js';
import { defineRule } from '../support/define-rule.js';

type Assertion = TSESTree.TSAsExpression | TSESTree.TSTypeAssertion;

interface Options {
  readonly typeAssertions?: boolean;
}

const DISABLE = /^\s*(eslint-disable(?:-next-line|-line)?)\b(.*)$/s;

/**
 * The part of clean/no-escape-hatch that no standard rule covers. `any`, the non-null
 * assertion and the `@ts-` comments are held by typescript-eslint rules the presets enable.
 */
export const cleanNoEscapeHatch = defineRule<'assertion' | 'undescribedDisable', [Options]>({
  id: 'clean/no-escape-hatch',
  type: 'problem',
  recommended: 'error',
  description: 'No type assertion outside mappers and infrastructure adapters, no eslint-disable without a reason.',
  messages: {
    assertion:
      'The assertion to {{type}} overrules the compiler. Narrow with a type guard, parse the value with a schema, or annotate with `satisfies`; an assertion belongs in a *.mapper.ts or an infrastructure adapter, where foreign data enters.',
    undescribedDisable: '{{directive}} gives no reason. Fix the diagnostic; if it cannot be fixed, name the rule and add the reason after `--`.',
  },
  schema: [{ type: 'object', additionalProperties: false, properties: { typeAssertions: { type: 'boolean' } } }],
  defaultOptions: [{}],
  create({ file, sourceCode, options: [options], report }) {
    const judgesAssertions = options.typeAssertions !== false && !mayAssert(file);
    const judge = (node: Assertion): void => {
      if (judgesAssertions && isEscape(node)) report({ node, messageId: 'assertion', data: { type: sourceCode.getText(node.typeAnnotation) } });
    };
    return {
      TSAsExpression: judge,
      TSTypeAssertion: judge,
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          const directive = undescribedDisable(comment.value);
          if (directive !== undefined) report({ loc: comment.loc, messageId: 'undescribedDisable', data: { directive } });
        }
      },
    };
  },
});

/** Mappers and infrastructure adapters translate rows and payloads the compiler knows nothing about. */
function mayAssert(file: LintedFile): boolean {
  if (file.path.endsWith('.mapper.ts')) return true;
  return file.location.area === 'context' && file.location.layer === 'infrastructure';
}

function isEscape(node: Assertion): boolean {
  if (isAssertion(node.parent)) return false;
  const type = node.typeAnnotation;
  if (type.type === AST_NODE_TYPES.TSUnknownKeyword) return false;
  return !(type.type === AST_NODE_TYPES.TSTypeReference && type.typeName.type === AST_NODE_TYPES.Identifier && type.typeName.name === 'const');
}

function isAssertion(node: TSESTree.Node): node is Assertion {
  return node.type === AST_NODE_TYPES.TSAsExpression || node.type === AST_NODE_TYPES.TSTypeAssertion;
}

function undescribedDisable(comment: string): string | undefined {
  const match = DISABLE.exec(comment);
  if (match === null || /--\s*\S/.test(match[2] ?? '')) return undefined;
  return match[1];
}
