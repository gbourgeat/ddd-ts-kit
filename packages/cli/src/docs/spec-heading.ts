import { ownEntry } from '../config/values/own-entry';
import { toName } from '../naming';
import type { SpecSubject } from './spec-subject';
import { SPEC_ROLES } from './spec-roles';

/**
 * The spec `unit/calendars/not-banned.guard.spec.ts` reads `Not banned (guard), in calendars`: the heading of a spec
 * that fits no use case, model nor reaction, in words as a part of the model is headed. The directory its section is
 * named after is not repeated; a module folder below it is.
 */
export function specHeading({ subject, role, folder }: SpecSubject): string {
  const word = role === undefined ? undefined : ownEntry(SPEC_ROLES, role);
  const module = folder.split('/').slice(1).join('/');

  return `${toName(subject).title}${word === undefined ? '' : ` (${word})`}${module === '' ? '' : `, in ${module}`}`;
}
