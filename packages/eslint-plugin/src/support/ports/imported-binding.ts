import type { TSESTree } from '@typescript-eslint/utils';
import type { ImportTarget } from '../../project/resolve-import';

/** A name of the file that an import declares, with where it comes from. */
export interface ImportedBinding {
  readonly specifier: TSESTree.ImportClause;
  readonly declaration: TSESTree.ImportDeclaration;
  readonly target: ImportTarget;
  /** `import type { X }` or `import { type X }`: the name is erased when the file is compiled. */
  readonly typeOnly: boolean;
}
