import type { Config } from '../../config/index.js';
import { familyOf } from './family-of.js';
import type { InitFile } from './init-file.js';
import { platformFile } from './platform-file.js';
import { when } from './when.js';

/** The composition root and the technical capabilities every context receives, apart from the storage, the authorization and the audit trail. */
export function platformFiles(config: Config): InitFile[] {
  const file = (name: string, variant?: string): InitFile => platformFile(config, name, variant);

  return [
    [`${config.sourceRoot}/main.ts`, 'init/main.ts.tpl'],
    file('tracing.ts'),
    file('job-settings.ts'),
    ...['config/app-config.ts', 'config/load-config.ts', 'config/read-tracing.ts', 'config/config-error.ts'].map(
      (name) => file(name),
    ),
    file('observability/create-logger.ts', config.stack.logger),
    file('observability/create-metrics.ts'),
    ...['resilience-settings', 'default-resilience', 'self-governed', 'adapter-aspects'].map((name) =>
      file(`resilience/${name}.ts`),
    ),
    // On tsyringe nothing names the helper before the first adapter, which brings it (`generate adapter`).
    ...when(familyOf(config) === 'manual', [file('resilience/own-policy.ts')]),
    ...compositionFiles(config),
    ...eventFiles(config),
    ...httpFiles(config),
    ...when(config.stack.cache === 'redis', [file('redis/open-redis.ts')]),
    ...when(config.stack.errors === 'sentry', [file('errors.ts')]),
    ...fileStorageFiles(config),
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
    ...(family === 'tsyringe'
      ? [
          file('files/bind-files.ts', family),
          file('files/files.module.ts', family),
          file('files/staging-uploads.ts', family),
        ]
      : [file('files/create-files.ts')]),
    ...when(http !== 'none', [file('files/file-routes.ts')]),
  ];
}

const TSYRINGE = ['platform.module.ts', 'platform-test.module.ts', 'lay-foundations.ts'];
const MANUAL = ['platform.ts', 'create-platform.ts'];

/** What turns the platform and the contexts into an application: modules of `@ddd-ts-kit/di` on tsyringe, a `Platform` handed to each context otherwise. */
function compositionFiles(config: Config): InitFile[] {
  const family = familyOf(config);
  const file = (name: string, variant?: string): InitFile => platformFile(config, name, variant);
  const shared = [file('compose-application.ts', family)];

  if (family === 'manual') {
    return [...shared, ...MANUAL.map((name) => file(name, family)), file('jobs/configured-job-scheduler.ts')];
  }

  return [
    ...shared,
    ...TSYRINGE.map((name) => file(name, family)),
    file('buses/create-command-bus.ts'),
    file('buses/create-query-bus.ts'),
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
    ...when(cache === 'redis', [file('http/refusal-for.ts')]),
    ...when(representations === 'negotiated' || forms === 'on', [file('http/presentation-of.ts')]),
    ...when(forms === 'on', [file('http/with-forms.ts')]),
  ];
}
