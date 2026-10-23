import type { TSESTree } from '@typescript-eslint/utils';
import { defineRule, type Report } from '../support/rule/define-rule';
import { importListener } from '../support/imports/import-listener';
import { innerLayer } from '../support/imports/inner-layer';
import type { LintedFile } from '../project/linted-file';
import { parameterTypeName } from '../support/types/parameter-type-name';

interface Options {
  readonly brokerPackages?: readonly string[];
}

const DEFAULT_BROKER_PACKAGES = [
  'amqplib',
  'kafkajs',
  'nats',
  '@aws-sdk/client-sqs',
  '@aws-sdk/client-sns',
  '@google-cloud/pubsub',
  '@ddd-ts-kit/rabbitmq',
  'bullmq',
  'ioredis',
];

/** What carries events past the outbox: the bus port itself, every bus of a broker, and the parts of the outbox the platform alone assembles. */
const TRANSPORT = /^(?:[\w$]*EventBus|OutboxRelay|OutboxPublisher|OutboxStore)$/;
const TRANSPORT_TYPE = /(?:EventBus|Relay)$/;

const THROUGH_THE_PORT =
  'Depend on the IntegrationEventPublisher port of @ddd-ts-kit/kernel and publish through it: the composition root binds it to the outbox, so the event is stored in the transaction of the command and relayed afterwards.';

type MessageId = 'broker' | 'concreteBus' | 'publisherDependency';

export const eventsOutboxRequired = defineRule<MessageId, [Options]>({
  id: 'events/outbox-required',
  type: 'problem',
  recommended: 'error',
  description:
    'Integration events leave through the transactional outbox: domain/ and application/ never reach a broker client, a bus (the EventBus port included) or a part of the outbox.',
  messages: {
    broker: `The {{layer}} layer imports the broker client "{{name}}": an event sent straight to a broker is lost or duplicated when the transaction of the command fails. ${THROUGH_THE_PORT}`,
    concreteBus: `The {{layer}} layer imports {{name}}, which carries events past the outbox: the use case would decide how events leave. ${THROUGH_THE_PORT}`,
    publisherDependency: `{{className}} is given a {{type}}: a publisher of application/integration/publishers translates a domain event and hands it to a port. Type the parameter IntegrationEventPublisher. ${THROUGH_THE_PORT}`,
  },
  schema: [
    {
      type: 'object',
      additionalProperties: false,
      properties: { brokerPackages: { type: 'array', items: { type: 'string' }, uniqueItems: true } },
    },
  ],
  defaultOptions: [{}],
  create({ file, options: [options], report }) {
    const layer = innerLayer(file);

    if (layer === undefined) {
      return {};
    }

    const brokers = options.brokerPackages ?? DEFAULT_BROKER_PACKAGES;
    const judgesConstructors = isPublisher(file);

    return {
      ...importListener(file, ({ node, target, names }) => {
        if (target.kind === 'package' && brokers.includes(target.name)) {
          report({ node, messageId: 'broker', data: { name: target.name, layer } });

          return;
        }

        for (const bus of names.filter((imported) => TRANSPORT.test(imported.name))) {
          report({ node: bus.node, messageId: 'concreteBus', data: { name: bus.name, layer } });
        }
      }),
      MethodDefinition(node) {
        if (judgesConstructors && node.kind === 'constructor') {
          judgeConstructor(node, report);
        }
      },
    };
  },
});

function judgeConstructor(node: TSESTree.MethodDefinition, report: Report<MessageId>): void {
  for (const parameter of node.value.params) {
    const type = parameterTypeName(parameter) ?? '';

    if (TRANSPORT_TYPE.test(type)) {
      report({
        node: parameter,
        messageId: 'publisherDependency',
        data: { className: node.parent.parent.id?.name ?? 'The publisher', type },
      });
    }
  }
}

function isPublisher(file: LintedFile): boolean {
  const { location } = file;

  return (
    location.area === 'context' &&
    location.layer === 'application' &&
    location.inside[0] === 'integration' &&
    location.inside[1] === 'publishers'
  );
}
