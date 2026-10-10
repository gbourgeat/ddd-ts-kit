import type { Config } from '../config/index.js';
import { escapePattern } from './escape-pattern.js';

/** What is test code: the `test/` of a context, specs, the test database of the platform, the end-to-end tree. */
export function testFiles(config: Config): string[] {
  return [`^${escapePattern(config.contextsDir)}/[^/]+/test/`, '\\.(spec|test)\\.[cm]?ts$', '(^|/)open-test-database\\.ts$', '^test/'];
}
