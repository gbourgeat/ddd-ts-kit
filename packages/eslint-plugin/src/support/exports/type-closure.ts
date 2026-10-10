import type { TSESTree } from '@typescript-eslint/utils';
import type { ModuleShape } from './module-shape.js';
import { typeNamesIn } from './type-names-in.js';

/** The type names `roots` refer to, followed through the interfaces and the type aliases the module declares. */
export function typeClosure(shape: ModuleShape, roots: readonly TSESTree.Node[]): ReadonlySet<string> {
  const reached = new Set<string>();
  const pending = [...roots];

  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    for (const name of typeNamesIn(node).filter((candidate) => !reached.has(candidate))) {
      reached.add(name);
      pending.push(...typesNamed(shape, name));
    }
  }

  return reached;
}

function typesNamed(shape: ModuleShape, name: string): TSESTree.Node[] {
  const types = shape.declarations.filter((declaration) => declaration.name === name && (declaration.kind === 'interface' || declaration.kind === 'type'));

  return types.map((declaration) => declaration.node);
}
