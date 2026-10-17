import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../../project/linted-file.js';
import { ancestors } from '../ancestors.js';
import { isOutsidePlace } from './is-outside-place.js';

/**
 * Whether a literal is a type of an interface or a type alias of `infrastructure/anti-corruption/`
 * or `infrastructure/external/`, which describe an outside record as it arrives (`readonly state:
 * 'draft' | 'issued'`): words of that record, not of the context.
 */
export function inOutsideRecord(file: LintedFile, node: TSESTree.Node): boolean {
  return (
    isOutsidePlace(file.location) &&
    [...ancestors(node)].some(
      (ancestor) =>
        ancestor.type === AST_NODE_TYPES.TSInterfaceDeclaration ||
        ancestor.type === AST_NODE_TYPES.TSTypeAliasDeclaration,
    )
  );
}
