import type { BasePoint } from './base-point';

/** What the message of a merge of the trunk names. */
export interface MergeNames {
  readonly branch: string;
  readonly trunk: { readonly ref: string; readonly commit: string };
  readonly base: BasePoint;
}

/**
 * The message of the merge commit: `Merge <trunk> into <branch>`, then the trailers verify-merge
 * and a reader need: the base it was computed from (`Merge-Base:`), the commit of the trunk
 * (`Trunk:`) and, when the branch was found squashed there, that commit (`Landed:`).
 */
export function mergeMessage({ branch, trunk, base }: MergeNames): string {
  return [
    `Merge ${trunk.ref} into ${branch}`,
    '',
    `Merge-Base: ${base.commit}`,
    `Trunk: ${trunk.commit}`,
    ...(base.landedAs === undefined ? [] : [`Landed: ${base.landedAs.commit}`]),
    '',
  ].join('\n');
}
