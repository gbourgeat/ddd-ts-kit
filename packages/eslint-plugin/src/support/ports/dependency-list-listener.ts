import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { calleeName } from '../calls/callee-name.js';
import type { ClassNode } from '../classes/class-name.js';
import { declarationReader } from '../declarations/declaration-reader.js';

type Visit = (dependency: TSESTree.Identifier) => void;

const LISTING_CALLS = new Set(['toClass', 'handledBy']);

/**
 * Visits every name of a dependency list: the array that names what a constructor receives,
 * as last argument of a declaration decorator (`@CommandHandler(M, [..])`, `@Repository(P, [..])`)
 * and as second argument of `.toClass(C, [..])` and `.handledBy(H, [..])`.
 */
export function dependencyListListener(program: TSESTree.Program, visit: Visit): TSESLint.RuleListener {
  const declarationsOf = declarationReader(program);

  const visitList = (list: TSESTree.Node | undefined): void => {
    if (list?.type !== AST_NODE_TYPES.ArrayExpression) {
      return;
    }

    for (const element of list.elements) {
      if (element?.type === AST_NODE_TYPES.Identifier) {
        visit(element);
      }
    }
  };

  const judgeClass = (node: ClassNode): void => {
    for (const declaration of declarationsOf(node)) {
      visitList(declaration.arguments.at(-1));
    }
  };

  return {
    ClassDeclaration: judgeClass,
    ClassExpression: judgeClass,
    CallExpression(node) {
      if (node.callee.type === AST_NODE_TYPES.MemberExpression && LISTING_CALLS.has(calleeName(node) ?? '')) {
        visitList(node.arguments[1]);
      }
    },
  };
}
