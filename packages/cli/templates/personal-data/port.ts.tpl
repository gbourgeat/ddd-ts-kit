import { PersonalDataErasure } from '@ddd-ts-kit/kernel';

/**
 * The right to erasure, for what {{context.kebab}} keeps of a person in clear: the columns its tables declare
 * with `personalFields`, erased or pseudonymised as each declaration says. Run by the platform
 * (`npm run privacy:erase`) with the copies of the other contexts, never by a use case.
 */
export abstract class {{personal.names.port}} extends PersonalDataErasure {}
