import type { Severity } from '../../config/index.js';

/** Rules that advise instead of blocking unless the config says otherwise (ARCHITECTURE.md section 3). */
export const DEFAULT_SEVERITIES: Readonly<Record<string, Severity>> = {
  'test/no-mocks': 'warn',
  'test/builder-required': 'warn',
  'clean/function-size': 'warn',
  'clean/no-noise-comment': 'warn',
  'clean/no-flag-argument': 'warn',
  'application/command-query-separation': 'warn',
  'standard/no-parallel-interface': 'warn',
};
