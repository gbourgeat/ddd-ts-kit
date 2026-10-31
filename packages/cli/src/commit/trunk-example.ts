import { resolvedTrunk } from './resolved-trunk';

/** The ref a message gives as its example: the trunk where it resolves, else what to put in its place. */
export function trunkExample(root: string): string {
  return resolvedTrunk(root) ?? '<branch, tag or commit>';
}
