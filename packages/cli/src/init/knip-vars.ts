import type { Config } from '../config';
import { WITH_DATABASE } from '../stack/with-database';
import type { RenderContext } from '../templating';
import { validationDependencies } from './validation-dependencies';

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
    // The data source the TypeORM CLI loads to run the migrations: no source file imports it.
    toolEntry: config.stack.orm === 'typeorm' ? `,\n    "${config.platformDir}/database/data-source.ts"` : '',
    e2eProject: when(', "test/**/*.ts"'),
    // The plugin of the runner of the specs reads its configurations, and enters by the specs, the fakes and the worlds.
    runner: config.stack.tests,
    runnerConfigs: runnerConfigs(config, when),
    e2eSpecs: when(', "test/e2e/**/*.e2e.spec.ts"'),
    testDatabase: opensTestDatabaseLater(config)
      ? `,\n      "${config.platformDir}/database/open-test-database.ts"`
      : '',
    ignores: ignored.length > 0,
    ignored: JSON.stringify(ignored),
  };
}

/** The configuration files of the runner of the specs: the unit one, the end-to-end one with an HTTP stack, the mutation one. */
function runnerConfigs(config: Config, when: (text: string) => string): string {
  const name = (role: string): string =>
    config.stack.tests === 'jest' ? `"jest${role}.config.js"` : `"vitest${role}.config.ts"`;

  return `${name('')}${when(`, ${name('.e2e')}`)}, ${name('.mutation')}`;
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
