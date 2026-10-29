import { SPEC_ROLES } from './spec-roles';

/** What a spec file is about, read from its path: `unit/calendars/slot.vo.spec.ts` is the value object `slot`, in `unit/calendars`. */
export interface SpecSubject {
  /** The kebab name the spec is named after: `slot`. */
  readonly subject: string;
  /** The key of its role in `SPEC_ROLES`, when its name carries one: `vo`. */
  readonly role: string | undefined;
  /** The folders above it, from the directory the page reads: `unit/calendars`; empty at its root. */
  readonly folder: string;
}

/**
 * The subject and the role of a spec. The role is the last segment of its name that is a role: a
 * qualifier after it (`slot.vo.properties.spec.ts`) is read past; a name with none is its own subject.
 */
export function specSubject(file: string): SpecSubject {
  const slash = file.lastIndexOf('/');
  const folder = slash === -1 ? '' : file.slice(0, slash);

  const segments = file
    .slice(slash + 1)
    .replace(/\.spec\.ts$/, '')
    .split('.');

  const at = segments.findLastIndex((segment, index) => index > 0 && SPEC_ROLES[segment] !== undefined);

  return at === -1
    ? { subject: segments.join('.'), role: undefined, folder }
    : { subject: segments.slice(0, at).join('.'), role: segments[at], folder };
}
