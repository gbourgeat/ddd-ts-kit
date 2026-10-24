import type { PersonalDataExport } from '@ddd-ts-kit/kernel';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

/**
 * The ports of the contexts that export what they keep of a person, one per context, each extending
 * `PersonalDataExport` of the kernel: the export resolves them once the application is composed.
 * A context that erases what it keeps of a person adds its port here.
 */
export const dataSubjectExports: readonly (typeof PersonalDataExport)[] = [
  // ddd-ts-kit:exports
  // /ddd-ts-kit:exports
];
