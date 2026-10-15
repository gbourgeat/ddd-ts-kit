import type { SourceFile } from '../model/source-file.js';
import type { StringRecord } from '../scan/string-record.js';
import { depthAt } from '../text/depth-at.js';
import { matchingBracket } from '../text/matching-bracket.js';

const PERMISSION_SET = /export\s+const\s+([a-z][\w$]*)\s*=\s*definePermissions\(\s*/g;

/** `export const billingPermissions = definePermissions('billing', { 'invoice.issue': .. })`, as the checker reads it. */
export interface PermissionSet {
  /** The name code reads the set by: `billingPermissions`. */
  readonly set: string;
  readonly context: string;
  /** The key of each permission, where it is written. */
  readonly keys: readonly StringRecord[];
}

/** The permission sets a file declares, each with the keys of its first level. */
export function permissionSets(file: SourceFile): PermissionSet[] {
  const { code, strings } = file.scan;

  return [...code.matchAll(PERMISSION_SET)].flatMap((found) => {
    const at = found.index + found[0].length;
    const context = strings.find(({ start }) => start === at)?.value;
    const open = code.indexOf('{', at);

    if (context === undefined || open === -1) {
      return [];
    }

    const close = matchingBracket(code, open);

    const keys = strings.filter(
      ({ start, end }) =>
        start > open && end < close && /^\s*:/.test(code.slice(end)) && depthAt(code, open, start) === 1,
    );

    return [{ set: found[1] ?? '', context, keys }];
  });
}
