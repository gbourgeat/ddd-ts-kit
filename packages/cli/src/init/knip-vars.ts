import type { Config } from '../config/index.js';
import { WITH_DATABASE } from '../stack/with-database.js';
import type { RenderContext } from '../templating/index.js';
import { validationDependencies } from './validation-dependencies.js';

/**
 * What knip is told beyond the sources when the project is created: the entry point of a worker,
 * and the end-to-end tree, which exists only with an HTTP stack, so that no pattern matches
 * nothing. What it enters a context by comes with the first context (`declareContextEntries`).
 */
export function knipVars(config: Config): RenderContext {
  const when = (text: string): string => (config.stack.http === 'none' ? '' : text);
  const ignored = ignoredDependencies(config);

  return {
    apps: config.worker || Object.values(config.contexts).some((context) => context.deployable),
    e2eEntry: when(',\n    "test/e2e/**/*.ts"'),
    e2eProject: when(', "test/**/*.ts"'),
    e2eConfig: when(', "vitest.e2e.config.ts"'),
    e2eSpecs: when(', "test/e2e/**/*.e2e.spec.ts"'),
    testDatabase: opensTestDatabaseLater(config)
      ? `,\n      "${config.platformDir}/database/open-test-database.ts"`
      : '',
    ignores: ignored.length > 0,
    ignored: JSON.stringify(ignored),
  };
}

/**
 * The report formatter a GitLab pipeline names on its command line, and the validation packages
 * while nothing validates: the route of the audit trail is their only user in a new project.
 */
function ignoredDependencies(config: Config): string[] {
  const { ci, audit, http } = config.stack;
  const validates = audit === 'on' && http !== 'none';

  return [
    ...(ci === 'gitlab' || ci === 'both' ? ['eslint-formatter-gitlab'] : []),
    ...(validates ? [] : validationDependencies(config)),
  ];
}

/** With an HTTP boundary the end-to-end support opens the database of the tests; without one it waits for the first repository spec, as a fake waits for its spec. */
function opensTestDatabaseLater(config: Config): boolean {
  return config.stack.http === 'none' && WITH_DATABASE.includes(config.stack.orm);
}
