// The families of packages that implement the same ports, and every asymmetry between their
// members, each with its reason. `parity.mjs --check` fails on an option or a capability of a
// contract that one member has and another lacks without a line here, and on a line here that
// is no longer true. To add an option to one member: add it to the others, or write why not.
//
// For each port:
// - `options`: the options interface of each member (`null`: the member takes no options object);
// - `place`: the options that say where the data or the server is, named the way each technology
//   names it (a schema, a table, a delegate, an entity, a connection): never compared;
// - `apart`: option -> member -> why that member goes without it;
// - `contract`: the contract suite of `@ddd-ts-kit/testing` every member runs;
// - `calls`: when one contract proves several ports, the calls of this one (by their `name`);
// - `withoutContract`: member -> why its specs do not run the contract yet;
// - `capabilitiesApart`: optional key of the contract -> member -> why the member does not give it.

export const CONTRACTS_DIR = 'packages/testing/src/contracts';

const ORM_PLACE = ['schema', 'table', 'tableName', 'delegate', 'entity'];

const NO_OPTIONS = { knex: null, drizzle: null, prisma: null, typeorm: null };

const NO_ROW_LEVEL_SECURITY =
  'no row-level security strategy: nothing sets the tenant at the start of a transaction (the `begin` of the unit of work of Knex and Drizzle)';

const SEPARATE_STORAGE =
  'a schema or a database per tenant (tenantSearchPath, tenantDatabases) is a strategy of Knex alone';

const ORM = {
  family: 'ORM',
  members: ['knex', 'drizzle', 'prisma', 'typeorm'],
  ports: [
    {
      port: 'unit of work',
      options: { knex: 'KnexUnitOfWorkOptions', drizzle: 'DrizzleUnitOfWorkOptions', prisma: null, typeorm: null },
      apart: {
        begin: {
          prisma:
            'it serves row-level security alone (tenantSession), a tenancy strategy of Knex and Drizzle; the options of $transaction are given as they are',
          typeorm:
            'it serves row-level security alone (tenantSession), a tenancy strategy of Knex and Drizzle; the isolation level is the second argument',
        },
      },
      contract: 'unitOfWorkContract',
    },
    {
      port: 'outbox store',
      options: {
        knex: 'KnexOutboxStoreOptions',
        drizzle: 'DrizzleOutboxStoreOptions',
        prisma: 'PrismaOutboxStoreOptions',
        typeorm: 'TypeOrmOutboxStoreOptions',
      },
      place: ORM_PLACE,
      apart: {
        claim: {
          drizzle: 'the package is written for PostgreSQL alone, which always claims FOR UPDATE SKIP LOCKED',
        },
        tenant: {
          drizzle: 'the table says it: tenantOutboxTable() has tenant_id, which the store reads',
          typeorm: 'the entity says it: outboxEntity({ tenant: true }), which the store reads',
        },
      },
      contract: 'outboxStoreContract',
    },
    {
      port: 'processed event store',
      options: {
        knex: 'KnexProcessedEventStoreOptions',
        drizzle: 'DrizzleProcessedEventStoreOptions',
        prisma: 'PrismaProcessedEventStoreOptions',
        typeorm: 'TypeOrmProcessedEventStoreOptions',
      },
      place: ORM_PLACE,
      contract: 'processedEventStoreContract',
    },
    {
      port: 'job store',
      options: { knex: null, drizzle: null, prisma: 'PrismaJobStoreOptions', typeorm: 'TypeOrmJobStoreOptions' },
      place: ORM_PLACE,
      contract: 'jobStoreContract',
    },
    {
      port: 'process store',
      options: {
        knex: 'KnexProcessStoreOptions',
        drizzle: 'DrizzleProcessStoreOptions',
        prisma: 'PrismaProcessStoreOptions',
        typeorm: 'TypeOrmProcessStoreOptions',
      },
      place: ORM_PLACE,
      contract: 'processStoreContract',
    },
    {
      port: 'read model store',
      options: {
        knex: 'KnexReadModelOptions',
        drizzle: 'DrizzleReadModelOptions',
        prisma: 'PrismaReadModelOptions',
        typeorm: 'TypeOrmReadModelOptions',
      },
      place: ORM_PLACE,
      apart: {
        keyColumn: {
          drizzle: 'named `key` there, as on Prisma and TypeORM',
          prisma: 'the same option is named `key` there, as on Drizzle and TypeORM',
          typeorm: 'the same option is named `key` there, as on Drizzle and Prisma',
        },
        key: { knex: 'named `keyColumn` on Knex, written before the others' },
        columns: { typeorm: 'the entity maps the columns' },
      },
      contract: 'readModelStoreContract',
    },
    {
      port: 'personal data erasure',
      options: {
        knex: 'KnexPersonalDataErasureOptions',
        drizzle: 'DrizzlePersonalDataErasureOptions',
        prisma: 'PrismaPersonalDataErasureOptions',
        typeorm: 'TypeOrmPersonalDataErasureOptions',
      },
      contract: 'personalDataErasureContract',
    },
    { port: 'personal data export', options: NO_OPTIONS, contract: 'personalDataExportContract' },
    { port: 'personal data retention', options: NO_OPTIONS, contract: 'personalDataRetentionContract' },
    { port: 'repository', options: NO_OPTIONS, contract: 'repositoryContract' },
    {
      port: 'tenancy, shared tables',
      options: NO_OPTIONS,
      contract: 'tenantIsolationContract',
      calls: /name: '[^']*, shared tables'/,
    },
    {
      port: 'tenancy, row-level security',
      options: NO_OPTIONS,
      contract: 'tenantIsolationContract',
      calls: /row-level security/,
      withoutContract: { prisma: NO_ROW_LEVEL_SECURITY, typeorm: NO_ROW_LEVEL_SECURITY },
    },
    {
      port: 'tenancy, schema per tenant',
      options: NO_OPTIONS,
      contract: 'tenantIsolationContract',
      calls: /schema per tenant/,
      withoutContract: { drizzle: SEPARATE_STORAGE, prisma: SEPARATE_STORAGE, typeorm: SEPARATE_STORAGE },
    },
    {
      port: 'tenancy, database per tenant',
      options: NO_OPTIONS,
      contract: 'tenantIsolationContract',
      calls: /database per tenant/,
      withoutContract: { drizzle: SEPARATE_STORAGE, prisma: SEPARATE_STORAGE, typeorm: SEPARATE_STORAGE },
    },
    {
      port: 'event store',
      options: NO_OPTIONS,
      contract: 'eventStoreContract',
    },
    {
      port: 'event store in the unit of work',
      options: NO_OPTIONS,
      contract: 'eventStoreUnitOfWorkContract',
    },
    {
      port: 'criteria',
      options: { knex: null, drizzle: null, prisma: null, typeorm: 'TypeOrmCriteriaOptions' },
      // How the query builder of TypeORM names what a criteria reads.
      place: ['alias', 'properties', 'parameters'],
      contract: 'criteriaContract',
    },
  ],
};

/** The topology of each broker and the way it is reached: never compared. */
const BROKER_PLACE = [
  'connection',
  'brokers',
  'client',
  'cluster',
  'exchange',
  'queueType',
  'stream',
  'subjectPrefix',
  'storage',
  'replicas',
  'prefix',
  'streamOf',
  'topicOf',
  'keyOf',
  'topics',
  'publishedTypes',
  'instance',
];

const BROKERS = {
  family: 'brokers',
  members: ['rabbitmq', 'nats', 'kafka', 'redis'],
  ports: [
    {
      port: 'event bus',
      options: {
        rabbitmq: 'RabbitMqEventBusOptions',
        nats: 'NatsEventBusOptions',
        kafka: 'KafkaEventBusOptions',
        redis: 'RedisStreamsEventBusOptions',
      },
      place: BROKER_PLACE,
      apart: {
        prefetch: {
          kafka: 'Kafka hands partitions, not messages: `concurrency` is the partitions handled at once',
          redis: 'a read takes entries per stream: `batchSize`',
        },
        concurrency: {
          rabbitmq: 'the deliveries in flight are `prefetch`',
          nats: 'the deliveries in flight are `prefetch`',
          redis: 'the entries in flight are `batchSize`',
        },
        batchSize: {
          rabbitmq: 'the deliveries in flight are `prefetch`',
          nats: 'the deliveries in flight are `prefetch`',
          kafka: 'the partitions in flight are `concurrency`',
        },
        startFrom: {
          rabbitmq: 'a queue holds what was published once it was bound, there is no earlier position to read from',
          nats: 'a durable consumer starts with the stream, its position kept by the server',
        },
        publishTimeoutMs: {
          redis: 'XADD answers at once, there is no acknowledgement of replicas to wait for',
        },
        connectTimeoutMs: {
          rabbitmq: 'the connection options of amqplib carry it',
          nats: 'the connection options of the client carry it',
          redis: 'the options of ioredis carry it',
        },
        ackWaitMs: {
          rabbitmq: 'RabbitMQ bounds a delivery with its consumer_timeout, set on the server',
          kafka: 'the bound of a handling is `maxHandlingMs`',
          redis: 'the bound of a handling is `visibilityTimeoutMs`',
        },
        maxHandlingMs: {
          rabbitmq: 'RabbitMQ bounds a delivery with its consumer_timeout, set on the server',
          nats: 'the bound of a handling is `ackWaitMs`',
          redis: 'the bound of a handling is `visibilityTimeoutMs`',
        },
        visibilityTimeoutMs: {
          rabbitmq: 'RabbitMQ bounds a delivery with its consumer_timeout, set on the server',
          nats: 'the bound of a handling is `ackWaitMs`',
          kafka: 'the bound of a handling is `maxHandlingMs`',
        },
        blockMs: {
          rabbitmq: 'the server pushes the deliveries, no read waits',
          nats: 'the server pushes the deliveries, no read waits',
          kafka: 'the client of Kafka polls on its own',
        },
        duplicateWindowMs: {
          rabbitmq: 'no deduplication by the server: the consumers deduplicate by event id',
          kafka: 'no deduplication by the server: the consumers deduplicate by event id',
          redis: 'its guard of the publications is `deduplication`',
        },
        deduplication: {
          rabbitmq: 'no deduplication by the server: the consumers deduplicate by event id',
          nats: 'the stream drops duplicates within `duplicateWindowMs`',
          kafka: 'no deduplication by the server: the consumers deduplicate by event id',
        },
        retention: {
          rabbitmq: 'a queue forgets what was acknowledged',
          nats: 'the bus creates the stream without limits, which are set on the server',
          kafka: 'the bus creates a topic with the retention of the cluster',
        },
        onUnroutable: {
          nats: 'a subject with no consumer is kept by the stream',
          kafka: 'a topic keeps every record',
          redis: 'a stream keeps every entry',
        },
      },
      contract: 'eventBusContract',
    },
  ],
};

const LOGGERS = {
  family: 'loggers',
  members: ['pino', 'winston'],
  ports: [
    {
      port: 'logger',
      options: { pino: 'CreatePinoLoggerOptions', winston: 'CreateWinstonLoggerOptions' },
      apart: {
        asynchronous: { winston: 'its transports decide how they write' },
        destination: { winston: 'where it writes is its `transports`' },
        transports: { pino: 'where it writes is its `destination`' },
      },
      contract: 'loggerContract',
    },
  ],
};

export const FAMILIES = [ORM, BROKERS, LOGGERS];
