import { ownEntry } from '../config/values/own-entry';
import { specSubject } from './spec-subject';
import { SPEC_ROLES } from './spec-roles';

/** `calendars/slot.vo.spec.ts` reads `slot (value object), in calendars`: the heading of a spec that fits no use case, model nor reaction. */
export function specHeading(file: string): string {
  const { subject, role, folder } = specSubject(file);
  const word = role === undefined ? undefined : ownEntry(SPEC_ROLES, role);

  return `${subject}${word === undefined ? '' : ` (${word})`}${folder === '' ? '' : `, in ${folder}`}`;
}
