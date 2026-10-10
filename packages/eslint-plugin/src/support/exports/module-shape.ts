import type { TSESTree } from '@typescript-eslint/utils';
import type { TopLevelDeclaration } from './top-level-declaration.js';

export interface ModuleShape {
  readonly program: TSESTree.Program;
  readonly declarations: readonly TopLevelDeclaration[];
  readonly exports: readonly TopLevelDeclaration[];
  /** Distinct names of the exported classes, interfaces and functions: what a file holds one of. */
  readonly counted: readonly string[];
}
