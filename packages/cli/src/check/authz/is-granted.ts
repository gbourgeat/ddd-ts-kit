import type { Scan } from '../scan/scan';
import { escapeRegExp } from '../text/escape-reg-exp';
import type { PermissionSet } from './permission-sets';

/**
 * Whether code grants a permission by name: by the entry of its set, `billingPermissions['invoice.issue']`;
 * by its id, `'billing:invoice.issue'`; or by the wildcard of its context, `'billing:*'`. A comment grants nothing.
 */
export function isGranted(
  { code, strings }: Scan,
  { set, context }: Omit<PermissionSet, 'keys'>,
  key: string,
): boolean {
  const ids = new Set([`${context}:${key}`, `${context}:*`]);
  const entries = [...code.matchAll(new RegExp(`(?<![\\w$.])${escapeRegExp(set)}\\s*\\[\\s*`, 'g'))];

  return (
    entries.some((entry) =>
      strings.some(({ start, value }) => start === entry.index + entry[0].length && value === key),
    ) || strings.some(({ value }) => ids.has(value))
  );
}
