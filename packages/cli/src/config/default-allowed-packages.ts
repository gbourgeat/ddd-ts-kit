import type { Config } from './config';
import { schemaLibrariesOf } from './schema-libraries-of';

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
  const schemaLibraries = schemaLibrariesOf(validation);

  return {
    domainAllowedPackages: [kernel],
    applicationAllowedPackages: [kernel, '@ddd-ts-kit/auth'],
    publishedLanguageAllowedPackages: [kernel, '@ddd-ts-kit/events', '@ddd-ts-kit/validation', ...schemaLibraries],
  };
}
