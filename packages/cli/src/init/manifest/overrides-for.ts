import type { Config } from '../../config';

/**
 * Versions the project forces under a dependency of its stack that pins one below a fix:
 * `@nestjs/platform-express`, up to 12.2.0, asks for multer 2.4.0 exactly, open to a denial of
 * service through a pending `fileFilter` that 2.5.0 closes. Removed once Nest asks for 2.5.0 itself.
 */
export function overridesFor(config: Config): Record<string, string> {
  return config.stack.http === 'nest' ? { multer: '^2.5.0' } : {};
}
