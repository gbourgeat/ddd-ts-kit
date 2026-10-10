import type { TSESTree } from '@typescript-eslint/utils';

export type DeclarationKind = 'class' | 'interface' | 'function' | 'type' | 'variable' | 'other';

/** One declaration at the top of a module. Overloads, and a type sharing the name of a value, are several declarations of one name. */
export interface TopLevelDeclaration {
  readonly name: string;
  readonly kind: DeclarationKind;
  readonly node: TSESTree.Node;
  readonly exported: boolean;
}
