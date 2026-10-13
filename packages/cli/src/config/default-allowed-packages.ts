import type { Config } from './config.js';
import { isOneOf } from './is-one-of.js';
import { VALIDATION_STACKS, type ValidationStack } from './stack.js';

/**
 * An integration event is declared with a payload schema, so a published language needs
 * the declaration helper and the schema library of the project, and nothing else.
 */
const SCHEMA_LIBRARIES: Readonly<Record<ValidationStack, readonly string[]>> = {
  zod: ['zod'],
  'class-validator': ['class-validator', 'class-transformer'],
  typebox: ['typebox'],
  'standard-schema': [],
  none: [],
};

export type AllowedPackages = Pick<
  Config,
  'domainAllowedPackages' | 'applicationAllowedPackages' | 'publishedLanguageAllowedPackages'
>;

/**
 * What the inner layers may import when the config says nothing; anything a config adds to
 * these is a deviation. The application layer declares its permissions and policies with
 * `@ddd-ts-kit/auth`, which imports the kernel only.
 */
export function defaultAllowedPackages(validation: string): AllowedPackages {
  const kernel = '@ddd-ts-kit/kernel';
  const schemaLibraries = isOneOf(VALIDATION_STACKS, validation) ? SCHEMA_LIBRARIES[validation] : [];

  return {
    domainAllowedPackages: [kernel],
    applicationAllowedPackages: [kernel, '@ddd-ts-kit/auth'],
    publishedLanguageAllowedPackages: [kernel, '@ddd-ts-kit/events', '@ddd-ts-kit/validation', ...schemaLibraries],
  };
}
