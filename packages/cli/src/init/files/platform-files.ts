import type { Config } from '../../config';
import { familyOf } from './family-of';
import type { InitFile } from './init-file';
import { platformFile } from './platform-file';
import { when } from './when';

/** The composition root and the technical capabilities every context receives, apart from the storage, the authorization and the audit trail. */
export function platformFiles(config: Config): InitFile[] {
  const file = (name: string, variant?: string): InitFile => platformFile(config, name, variant);

  return [
    [`${config.sourceRoot}/main.ts`, 'init/main.ts.tpl'],
    file('observability/tracing.ts'),
    file('jobs/job-settings.ts'),
    ...[
      'config/app-config.ts',
      'config/environment.ts',
      'config/load-config.ts',
      'config/read-tracing.ts',
      'config/config-error.ts',
    ].map((name) => file(name)),
    file('observability/create-logger.ts', config.stack.logger),
    file('observability/create-metrics.ts'),
    ...['resilience-settings', 'default-resilience-settings', 'adapters-with-own-policy', 'default-policy'].map(
      (name) => file(`resilience/${name}.ts`),
    ),
    // On tsyringe nothing names the helper before the first adapter, which brings it (`generate adapter`).
    ...when(familyOf(config) === 'manual', [file('resilience/own-policy.ts')]),
    ...compositionFiles(config),
    ...eventFiles(config),
    ...httpFiles(config),
    ...when(config.stack.cache === 'redis', [file('redis/open-redis.ts')]),
    ...when(config.stack.errors === 'sentry', [file('observability/errors.ts')]),
    ...fileStorageFiles(config),
    ...searchFiles(config),
    ...housekeepingFiles(config),
  ];
}

/** The read models of OpenSearch: the injectable every context receives, and on a container the module that binds it. */
function searchFiles(config: Config): InitFile[] {
  if (config.stack.search === 'none') {
    return [];
  }

  return [
    ...['search-indexes', 'open-search', 'provisioned-indexes', 'store-index', 'search-name-taken-error'].map((name) =>
      platformFile(config, `search/${name}.ts`),
    ),
    ...when(familyOf(config) === 'container', [platformFile(config, 'search/search.module.ts', 'container')]),
  ];
}

/** How long the platform keeps what it is done with, and on tsyringe the module of its nightly purges. */
function housekeepingFiles(config: Config): InitFile[] {
  const { events, queue } = config.stack;
  const family = familyOf(config);

  if (events !== 'outbox' && queue === 'memory') {
    return [];
  }

  return [
    platformFile(config, 'jobs/housekeeping.ts'),
    platformFile(config, 'jobs/days-before.ts'),
    ...when(family === 'container', [platformFile(config, 'jobs/housekeeping.module.ts', family)]),
  ];
}

/** Where the content of files lives, how its settings are read, and the capability every context receives. */
function fileStorageFiles(config: Config): InitFile[] {
  const { storage, http } = config.stack;
  const file = (name: string, variant?: string): InitFile => platformFile(config, name, variant);
  const family = familyOf(config);

  if (storage === 'none') {
    return [];
  }

  return [
    file('config/read-files.ts', storage),
    file('files/open-files.ts', storage),
    ...(family === 'container'
      ? [
          file('files/bind-files.ts', family),
          file('files/files.module.ts', family),
          file('files/staging-uploads.ts', family),
        ]
      : [file('files/create-files.ts')]),
    ...when(http !== 'none', [file('files/file-routes.ts')]),
  ];
}

const TSYRINGE = [
  'composition/platform.module.ts',
  'composition/platform-test.module.ts',
  'composition/context-selection.ts',
];

const MANUAL = ['composition/platform.ts', 'composition/platform-options.ts', 'composition/create-platform.ts'];

/** The same map in both families: what exists before anything else, and the chain around each bus. */
const BOTH = ['composition/lay-foundations.ts', 'buses/create-command-bus.ts', 'buses/create-query-bus.ts'];

/** What turns the platform and the contexts into an application: modules of `@ddd-ts-kit/di` on tsyringe, a `Platform` handed to each context otherwise. */
function compositionFiles(config: Config): InitFile[] {
  const family = familyOf(config);
  const file = (name: string, variant?: string): InitFile => platformFile(config, name, variant);
  const own = family === 'manual' ? MANUAL : TSYRINGE;

  return [
    file('composition/compose-application.ts', family),
    ...BOTH.map((name) => file(name, family)),
    ...when(config.stack.tenancy !== 'none', [file('composition/tenant-directory.ts')]),
    ...own.map((name) => file(name, family)),
    ...when(config.stack.http !== 'none', [file('composition/platform-error-mapper.ts')]),
    ...when(family !== 'manual' && config.stack.http !== 'none', [file('composition/routes-of.ts', family)]),
    ...when(family === 'manual', [
      file('events/platform-events.ts'),
      file('jobs/configured-job-scheduler.ts'),
      file('jobs/background-jobs.ts'),
      file('jobs/create-background-work.ts'),
    ]),
  ];
}

function eventFiles(config: Config): InitFile[] {
  const { events, broker } = config.stack;
  const file = (name: string, variant?: string): InitFile => platformFile(config, name, variant);

  return [
    file('events/event-provider.ts'),
    file('events/in-process-events.ts'),
    ...when(broker !== 'none', [file('events/create-event-provider.ts', broker)]),
    ...when(broker === 'kafka', [file('events/aggregate-key-of.ts')]),
    ...when(broker === 'custom', [
      file('events/custom-event-bus.ts'),
      file('events/custom-event-bus.contract.spec.ts'),
    ]),
    ...when(events === 'outbox', [file('events/start-outbox-relay.ts')]),
  ];
}

function httpFiles(config: Config): InitFile[] {
  const { http, docsUi, cache, representations, forms } = config.stack;
  const file = (name: string, variant?: string): InitFile => platformFile(config, name, variant);

  if (http === 'none') {
    return [];
  }

  return [
    file('http/start-http-server.ts', http),
    ...when(http === 'nest', [file('http/create-app-module.ts')]),
    ...when(docsUi !== 'none', [file('http/with-documentation.ts')]),
    ...when(cache === 'redis', [file('http/too-many-requests-for.ts')]),
    ...when(representations === 'negotiated' || forms === 'on', [file('http/presentation-of.ts')]),
    ...when(forms === 'on', [file('http/with-forms.ts')]),
  ];
}
