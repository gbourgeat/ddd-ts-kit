import type { Config } from '../config/index.js';

/** What each validation library brings next to the package of the kit, all peers of it: knip counts them used as soon as the package is. */
const LIBRARIES: Readonly<Record<string, readonly string[]>> = {
  zod: ['zod'],
  'class-validator': ['class-validator', 'class-transformer', 'class-validator-jsonschema'],
  typebox: ['typebox'],
};

const VALIDATION_PACKAGE = '@ddd-ts-kit/validation';
/** What knip counts as used by NestJS itself, whose validation pipe loads them. */
const LOADED_BY_NEST = ['class-validator', 'class-transformer'];

/**
 * The validation packages of the stack, the one of the kit first. A new project validates nothing
 * before its first route or integration event, unless the audit trail has its route: until then
 * knip is told not to report them, since the next `generate` uses them, and the note goes with
 * the first use (`stopIgnoringValidation`). Under class-validator, `reflect-metadata` waits with
 * them where no container imports it.
 */
export function validationDependencies(config: Config): string[] {
  const { validation, di, http } = config.stack;
  const nest = http === 'nest';
  const library = (LIBRARIES[validation] ?? []).filter((name) => !nest || !LOADED_BY_NEST.includes(name));
  const metadata = validation === 'class-validator' && di !== 'tsyringe' && !nest ? ['reflect-metadata'] : [];

  return [VALIDATION_PACKAGE, ...library, ...metadata];
}
