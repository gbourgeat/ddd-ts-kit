import type { Config } from '../../config/index.js';
import type { InitFile } from './init-file.js';

const WITH_TEST_DATABASE = ['drizzle', 'knex', 'prisma', 'typeorm'];

/** End-to-end tests drive the application through HTTP: without an HTTP stack there is nothing to set up. */
export function endToEndFiles(config: Config): InitFile[] {
  const { http, tests, orm, authn } = config.stack;

  const support = (name: string, variant?: string): InitFile => [
    `test/e2e/support/${name}.ts`,
    `init/e2e/${name}${variant === undefined ? '' : `.${variant}`}.ts.tpl`,
  ];

  if (http === 'none') {
    return [];
  }

  return [
    tests === 'jest'
      ? ['jest.e2e.config.js', 'init/e2e/jest.e2e.config.js.tpl']
      : ['vitest.e2e.config.ts', 'init/e2e/vitest.e2e.config.ts.tpl'],
    support('start-application', WITH_TEST_DATABASE.includes(orm) ? 'database' : 'memory'),
    support('create-credentials', authn),
    support('auth-environment', authn),
    support('test-environment'),
    support('story-of'),
  ];
}
