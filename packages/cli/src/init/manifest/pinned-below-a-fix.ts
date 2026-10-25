import type { Config } from '../../config';

/** A package a dependency of the stack pins below a security fix: init forces the fix, doctor says when it is no longer needed. */
export interface PinnedBelowAFix {
  readonly name: string;
  /** The range the override forces. */
  readonly range: string;
  /** The first version with the fix: the override is needed while the parent asks for a range without it. */
  readonly fixed: string;
  /** The dependency of the project that brings it, then each package down to the one that asks for it. */
  readonly through: readonly string[];
  readonly applies: (config: Config) => boolean;
}

export const PINNED_BELOW_A_FIX: readonly PinnedBelowAFix[] = [
  // `@nestjs/platform-express`, up to 12.2.0, asks for multer 2.4.0 exactly: a denial of service through a pending `fileFilter`.
  {
    name: 'multer',
    range: '^2.5.0',
    fixed: '2.5.0',
    through: ['@nestjs/platform-express'],
    applies: (config) => config.stack.http === 'nest',
  },
  // Stryker 10.1 asks for `typed-rest-client` 2.3, which asks for qs 6.15.1 exactly: three denials of service, closed by 6.16.
  // Forced for the whole tree: npm does not apply an override nested under its parent to a lockfile that holds 6.15.1.
  {
    name: 'qs',
    range: '^6.16.0',
    fixed: '6.16.0',
    through: ['@stryker-mutator/core', 'typed-rest-client'],
    applies: () => true,
  },
];
