import type { Config } from '../../config';

/**
 * Versions the project forces under a dependency of its stack that pins one below a fix. Each one
 * is removed once that dependency asks for the fixed version itself.
 */
export function overridesFor(config: Config): Record<string, string> {
  return {
    // `@nestjs/platform-express`, up to 12.2.0, asks for multer 2.4.0 exactly: a denial of service through a pending `fileFilter`.
    ...(config.stack.http === 'nest' ? { multer: '^2.5.0' } : {}),
    // Stryker 10.1 asks for `typed-rest-client` 2.3, which asks for qs 6.15.1 exactly: three denials of service, closed by 6.16.
    // Forced for the whole tree: npm does not apply an override nested under its parent to a lockfile that holds 6.15.1.
    qs: '^6.16.0',
  };
}
