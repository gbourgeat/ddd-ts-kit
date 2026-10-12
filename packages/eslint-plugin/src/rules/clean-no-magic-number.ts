import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../project/linted-file.js';
import { defineRule } from '../support/rule/define-rule.js';

type MessageId = 'magic';
type Options = [{ readonly allow?: readonly number[] }];

/** Counting from nothing, one more, the last: these say what they are. */
const ALLOWED = [0, 1, -1];

export const cleanNoMagicNumber = defineRule<MessageId, Options>({
  id: 'clean/no-magic-number',
  type: 'suggestion',
  recommended: 'error',
  description:
    'No number literal in domain/ and application/ but 0, 1, -1 and an index: a duration, a limit or a rate is a named constant of the module or a value object.',
  messages: {
    magic:
      '{{value}} is a number without a name. Name it where it is decided: a constant of the module (`const LONGEST_ADDRESS = 254;`, `const MINUTES_PER_HOUR = 60;`), a `static readonly` of the class, or a value object when it is a duration, an amount or a limit of the business. The rule allows {{allowed}}, an index and a type.',
  },
  schema: [
    {
      type: 'object',
      properties: { allow: { type: 'array', items: { type: 'number' } } },
      additionalProperties: false,
    },
  ],
  defaultOptions: [{}],
  create({ file, options, report }) {
    if (!isJudged(file)) {
      return {};
    }

    const allowed = options[0].allow ?? ALLOWED;

    return {
      Literal(node) {
        if (typeof node.value !== 'number' && typeof node.value !== 'bigint') {
          return;
        }

        const signed = signedValue(node);

        if (!allowed.includes(Number(signed.value)) && !isNamed(signed.node)) {
          report({
            node: signed.node,
            messageId: 'magic',
            data: { value: String(signed.value), allowed: allowed.join(', ') },
          });
        }
      },
    };
  },
});

function isJudged(file: LintedFile): boolean {
  return (
    !file.isTest &&
    file.location.area === 'context' &&
    (file.location.layer === 'domain' || file.location.layer === 'application')
  );
}

/** `-1` is one literal for a reader: the minus goes with it. */
function signedValue(node: TSESTree.Literal): { node: TSESTree.Node; value: number | bigint } {
  const { parent } = node;
  const value = typeof node.value === 'bigint' ? node.value : Number(node.value);

  if (parent.type === AST_NODE_TYPES.UnaryExpression && parent.operator === '-') {
    return { node: parent, value: -value };
  }

  return { node, value };
}

/**
 * Where a number is given its name: the initializer of a constant of the module, a `static
 * readonly` field, a member of an enum, an index, a type. A function in between is a use, not a
 * declaration.
 */
function isNamed(node: TSESTree.Node): boolean {
  if (isIndexOrType(node)) {
    return true;
  }

  // The parent of the program is null at run time, whatever its type says.
  for (let current: TSESTree.Node | null | undefined = node.parent; isNode(current); current = current.parent) {
    if (isFunctionNode(current)) {
      return false;
    }

    if (isDeclaringPlace(current)) {
      return true;
    }
  }

  return false;
}

function isIndexOrType(node: TSESTree.Node): boolean {
  const { parent } = node;

  return (
    (parent?.type === AST_NODE_TYPES.MemberExpression && parent.computed && parent.property === node) ||
    parent?.type === AST_NODE_TYPES.TSLiteralType ||
    parent?.type === AST_NODE_TYPES.TSEnumMember
  );
}

function isFunctionNode(node: TSESTree.Node): boolean {
  return (
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression ||
    node.type === AST_NODE_TYPES.ArrowFunctionExpression
  );
}

function isDeclaringPlace(node: TSESTree.Node): boolean {
  if (node.type === AST_NODE_TYPES.PropertyDefinition) {
    return node.static && node.readonly;
  }

  return (
    node.type === AST_NODE_TYPES.VariableDeclaration &&
    node.kind === 'const' &&
    (node.parent.type === AST_NODE_TYPES.Program || node.parent.type === AST_NODE_TYPES.ExportNamedDeclaration)
  );
}

function isNode(node: TSESTree.Node | null | undefined): node is TSESTree.Node {
  return node !== undefined && node !== null;
}
