import type { TSESTree } from '@typescript-eslint/utils';
import type { ModuleShape } from './module-shape.js';
import type { DeclarationKind } from './top-level-declaration.js';
import { topLevelDeclarations } from './top-level-declarations.js';

const COUNTED: readonly DeclarationKind[] = ['class', 'interface', 'function'];

export function moduleShapeOf(program: TSESTree.Program): ModuleShape {
  const declarations = topLevelDeclarations(program);
  const exports = declarations.filter((declaration) => declaration.exported);

  const counted = exports
    .filter((declaration) => COUNTED.includes(declaration.kind))
    .map((declaration) => declaration.name);

  return { program, declarations, exports, counted: [...new Set(counted)] };
}
