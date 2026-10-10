import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { descendants } from '../descendants.js';
import type { ModuleShape } from './module-shape.js';

/**
 * The exported functions that are a form of the function `main`: named after it with a suffix
 * (`retryAdvice` next to `retry`) and called by it, so that `main` is that function taken one
 * step further.
 */
export function derivedFormsOf(shape: ModuleShape, main: string): string[] {
  const bodies = shape.exports.flatMap((declaration) =>
    declaration.name === main && declaration.node.type === AST_NODE_TYPES.FunctionDeclaration
      ? [declaration.node.body]
      : [],
  );

  const called = new Set(
    bodies
      .flatMap((body) => [...descendants(body)])
      .flatMap((node) =>
        node.type === AST_NODE_TYPES.CallExpression && node.callee.type === AST_NODE_TYPES.Identifier
          ? [node.callee.name]
          : [],
      ),
  );

  const forms = shape.exports.filter(
    (declaration) =>
      declaration.kind === 'function' && called.has(declaration.name) && isSuffixed(declaration.name, main),
  );

  return [...new Set(forms.map((declaration) => declaration.name))];
}

function isSuffixed(name: string, main: string): boolean {
  return name.startsWith(main) && /^[A-Z]/.test(name.slice(main.length));
}
