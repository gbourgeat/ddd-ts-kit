import type { PersonalDataErasure } from '@ddd-ts-kit/kernel';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

/**
 * The ports of the contexts that erase what they keep of a person, one per context, each extending
 * `PersonalDataErasure` of the kernel: the erasure resolves them once the application is composed.
 * A context that erases what it keeps of a person adds its port here.
 */
export const dataSubjectCopies: readonly (typeof PersonalDataErasure)[] = [
  // ddd-ts-kit:copies
  // /ddd-ts-kit:copies
];
