import type { Config } from '../config';
import { escapePattern } from './escape-pattern';

/**
 * What is test code: the `test/` of a context, of a module of its model or of its `shared/` folder
 * (one folder at most before it, written as an alternative, the way a layer of a module is), specs, the test database of the platform, the end-to-end tree.
 */
export function testFiles(config: Config): string[] {
  return [
    `^${escapePattern(config.contextsDir)}/[^/]+/(?:test|[^/]+/test)/`,
    '\\.(spec|test)\\.[cm]?ts$',
    '(^|/)open-test-database\\.ts$',
    '^test/',
  ];
}
