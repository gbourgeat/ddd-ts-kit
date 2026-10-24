import type { PersonalDataCopy } from '@ddd-ts-kit/kernel';
import type { Platform } from '{{alias.platform}}/composition/platform{{alias.ext}}';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

/**
 * The copies the contexts keep of a person, each erased by the adapter of its context, instantiated
 * from the platform as the module file of the context does. A context that
 * erases what it keeps of a person adds the adapter here.
 */
export const dataSubjectCopies: readonly ((platform: Platform) => PersonalDataCopy)[] = [
  // ddd-ts-kit:copies
  // /ddd-ts-kit:copies
];
