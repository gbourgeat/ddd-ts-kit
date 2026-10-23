import path from 'node:path';
import { CONFIG_FILE, type Config } from '../../config';
import type { Finding } from '../model/finding';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { inLayers } from '../support/in-layers';
import { lineOfSequence } from '../support/line-of-sequence';
import { perFile } from '../support/per-file';
import { reporter } from '../support/reporter';
import { identifier } from '../text/identifier';
import { platformFilePaths } from '../../platform-layout';

const BROKER_CLIENTS = [
  'amqplib',
  'kafkajs',
  '@ddd-ts-kit/rabbitmq',
  '@aws-sdk/client-sqs',
  '@aws-sdk/client-sns',
  '@google-cloud/pubsub',
  'nats',
  'bullmq',
  'ioredis',
];

/** What carries events past the outbox: the bus port itself, every bus of a broker, and the parts of the outbox the platform alone assembles. */
const TRANSPORT = /^(?:[\w$]*EventBus|OutboxRelay|OutboxPublisher|OutboxStore)$/;
const OTHER_THAN_THE_PORT = /^(?:OutboxPublisher|IntegrationEventSubscriber|[\w$]*EventBus)$/;
const PUBLISHER_KEY = /(?<![\w$.])(?:eventPublisher|publisher)\s*:/;

const PORT_FIX =
  'Depend on the IntegrationEventPublisher port of @ddd-ts-kit/kernel and publish through it: the composition root binds it to the OutboxPublisher, and the relay alone talks to the broker.';

const OUTBOX_FIX =
  'Bind the publisher of use cases to `new OutboxPublisher(<outbox store>)` from @ddd-ts-kit/events and give the bus or the broker to the OutboxRelay only.';

const STACK_FIX =
  'Set "stack.events" to "outbox", so that an event commits or rolls back with the state change it describes; a deliberate exception is a "deviations" entry whose "what" is "stack.events", pointing to its decision record.';

export const eventsOutboxRequired: Rule = {
  id: 'events/outbox-required',
  description:
    'With a database, integration events are published through the transactional outbox, never straight to a broker or a bus from a handler.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => [
      ...straightToTheBroker(file),
      ...publisherBesideThePort(file),
      ...platformWithoutOutbox(file, project.config),
    ]);
  },
  acrossProject(project) {
    const { stack, deviations } = project.config;

    if (
      stack.orm === 'none' ||
      stack.database === 'none' ||
      stack.events === 'outbox' ||
      deviations.some((deviation) => deviation.what === 'stack.events')
    ) {
      return [];
    }

    const at = { file: CONFIG_FILE, line: lineOfSequence(project.configText, ['"stack"', '"events"']) };

    return [
      reporter(project, this.id)(
        at,
        `"stack.events" is "${stack.events}" although the project has a database ("stack.orm" is "${stack.orm}").`,
        STACK_FIX,
      ),
    ];
  },
};

function straightToTheBroker(file: SourceFile): Finding[] {
  const here = inLayers(file, ['domain', 'application']);

  if (here === undefined) {
    return [];
  }

  return file.imports.flatMap(({ target, names, line }) => {
    const client =
      target.kind === 'package' && BROKER_CLIENTS.includes(target.name)
        ? `the broker client "${target.name}"`
        : undefined;

    const what = client ?? names.find((name) => TRANSPORT.test(name) && !reportedAsPublisher(here.inside, name));

    return what === undefined ? [] : [{ line, message: `The ${here.layer} layer imports ${what}.`, fix: PORT_FIX }];
  });
}

/** In a publisher the same import is reported once, by the message that names the port to use. */
function reportedAsPublisher(inside: readonly string[], name: string): boolean {
  return inside.slice(0, 2).join('/') === 'integration/publishers' && OTHER_THAN_THE_PORT.test(name);
}

function publisherBesideThePort(file: SourceFile): Finding[] {
  const here = inLayers(file, ['application']);

  if (here === undefined || here.inside.slice(0, 2).join('/') !== 'integration/publishers') {
    return [];
  }

  return file.imports.flatMap(({ names, line }) => {
    const other = names.find((name) => OTHER_THAN_THE_PORT.test(name));

    return other === undefined
      ? []
      : [
          {
            line,
            message: `The publisher depends on ${other} instead of the IntegrationEventPublisher port.`,
            fix: PORT_FIX,
          },
        ];
  });
}

/** With the outbox, the publisher the platform hands to use cases is the OutboxPublisher; the relay keeps the bus for itself. */
function platformWithoutOutbox(file: SourceFile, config: Config): Finding[] {
  if (config.stack.events !== 'outbox' || file.isTest || !givesThePublisher(file, config)) {
    return [];
  }

  const { code } = file.scan;
  const key = PUBLISHER_KEY.exec(code);

  if (key === null || identifier('OutboxPublisher').test(code)) {
    return [];
  }

  return [
    {
      line: file.scan.lineAt(key.index),
      message: 'The platform hands use cases a publisher that is not the OutboxPublisher.',
      fix: OUTBOX_FIX,
    },
  ];
}

function givesThePublisher(file: SourceFile, config: Config): boolean {
  const { platformDir } = config;

  if (platformFilePaths(config, 'composition/platform.module.ts').includes(file.path)) {
    return true;
  }

  // The relay names its target `publisher` too: that one is the bus, on purpose.
  return path.posix.dirname(file.path) === `${platformDir}/events` && !identifier('OutboxRelay').test(file.scan.code);
}
