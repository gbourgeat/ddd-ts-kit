import type { CalledMember } from './called-member.js';
import type { ProposedName } from './proposed-name.js';
import { repositoryConcept } from './repository-concept.js';

/** A read of one element: `findById`, `get`, `load`, `findOne`, `requireById`. */
const ONE = /^(?:find|get|load|require)(?:One)?(?:ById)?$/;
/** A read of several elements by the name of its method: `findDue`, `findAll`, `getByPractice`. */
const MANY = /^(?:find|get|load)[A-Z]/;
const OF_ONE = /(?:ById|One)$/;

/**
 * Without type information, what a call on a repository answers by the convention of its names:
 * the concept of `appointmentRepository`, one of it for a read of one element, several for a
 * read that names what it selects. Undefined when the names say neither.
 */
export function conventionalModelName(call: CalledMember, several: boolean): ProposedName | undefined {
  const concept = repositoryConcept(call.object);

  if (concept === undefined) {
    return undefined;
  }

  if (!several) {
    return ONE.test(call.method) ? { element: concept, many: false } : undefined;
  }

  return MANY.test(call.method) && !OF_ONE.test(call.method) ? { element: concept, many: true } : undefined;
}
