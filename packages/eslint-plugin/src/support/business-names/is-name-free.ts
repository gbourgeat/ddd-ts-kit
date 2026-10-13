import type { TSESLint } from '@typescript-eslint/utils';

type Scope = TSESLint.Scope.Scope;
type Variable = TSESLint.Scope.Variable;

/**
 * Whether `variable` can be renamed `name` without changing what any name of the code means:
 * no other variable of that name in its scope, none between a use and its declaration, and no
 * use of that name inside its scope that reaches another variable or a global.
 */
export function isNameFree(variable: Variable, name: string): boolean {
  const { scope } = variable;

  if (scope.set.has(name)) {
    return false;
  }

  const shadowed = variable.references.some((reference) => declaresBetween(reference.from, scope, name));

  return !shadowed && !usedInside(scope, name);
}

function declaresBetween(from: Scope, declaring: Scope, name: string): boolean {
  for (let current: Scope | null = from; current !== null && current !== declaring; current = current.upper) {
    if (current.set.has(name)) {
      return true;
    }
  }

  return false;
}

function usedInside(scope: Scope, name: string): boolean {
  return (
    scope.references.some((reference) => reference.identifier.name === name) ||
    scope.childScopes.some((child) => usedInside(child, name))
  );
}
