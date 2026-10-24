import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initFailure } from './support/init-failure';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { readJson } from './support/read-json';

const CONFIG = 'ddd-ts-kit.config.json';
const PLATFORM = 'src/platform/composition/platform.module.ts';
const PERSISTENCE = 'src/platform/database/persistence-over.ts';
const SCHEMA = 'src/platform/database/schema.ts';
const BACKGROUND_WORK = 'src/platform/jobs/create-background-work.ts';
const COMPOSE = 'src/platform/composition/compose-application.ts';

const queueOf = (root: string): unknown => jsonAt(readJson(root, CONFIG), 'stack', 'queue');

describe('init --queue', () => {
  it('keeps the jobs in the database when the ORM package ships the table, in memory otherwise', () => {
    expect(queueOf(initProject())).toBe('database');
    expect(queueOf(initProject('--orm', 'prisma'))).toBe('database');
    expect(queueOf(initProject('--orm', 'custom'))).toBe('memory');
    // Asked for, the table is bound by the platform wired by hand too; left to the default, that platform keeps the memory.
    expect(queueOf(initProject('--di', 'manual'))).toBe('memory');
    expect(queueOf(initProject('--di', 'manual', '--queue', 'database'))).toBe('database');
    expect(cli(initProject(), '--help').stdout).toContain('[--queue database|redis|memory]');
  });

  it('builds the queue, its worker and the runner of the processes on the stores of the persistence where the platform is wired by hand', () => {
    const root = initProject('--di', 'manual', '--queue', 'database');
    const work = read(root, BACKGROUND_WORK);

    expect(work).toContain('const store = persistence.jobs;');
    expect(work).toContain('store: persistence.processes,');
    expect(work).toContain('traceparent: traced.traceparent');
    expect(read(root, PERSISTENCE)).toContain('jobs: new DrizzleJobStore(unitOfWork, jobs),');

    expect(read(root, 'src/platform/composition/create-platform.ts')).toContain(
      '...createBackgroundWork({ persistence, options, foundations, commands }),',
    );

    expect(read(root, COMPOSE)).toContain(
      '    await platform.jobs.start();\n    await platform.backgroundJobs.start();',
    );

    expect(read(root, COMPOSE)).toContain('  await platform.jobs.stop();\n  await platform.backgroundJobs.stop();');
  });

  it('puts the jobs of a hand-wired platform on the server of the cache with redis, and in memory by default', () => {
    const onRedis = read(initProject('--di', 'manual', '--cache', 'redis', '--queue', 'redis'), BACKGROUND_WORK);
    const inMemory = initProject('--di', 'nest', '--http', 'nest');

    expect(onRedis).toContain('const store = options.redis?.jobs(foundations.logger) ?? new InMemoryJobStore();');
    expect(onRedis).toContain('store: persistence.processes,');

    expect(read(inMemory, BACKGROUND_WORK)).toContain('const store = new InMemoryJobStore();');
    expect(read(inMemory, BACKGROUND_WORK)).toContain('store: new InMemoryProcessStore(),');
    // A queue in the memory of the process is consumed by that process, its jobs on or off.
    expect(read(inMemory, COMPOSE)).toContain('  }\n\n  await platform.backgroundJobs.start();\n}');
  });

  it('binds the jobs table and the processes table of Drizzle in the transaction of the command', () => {
    const root = initProject();

    expect(read(root, SCHEMA)).toContain('export const jobs = jobsTable(MESSAGING_SCHEMA);');
    expect(read(root, SCHEMA)).toContain('export const processes = processesTable(MESSAGING_SCHEMA);');
    expect(read(root, PERSISTENCE)).toContain('jobs: new DrizzleJobStore(unitOfWork, jobs),');
    expect(read(root, PLATFORM)).toContain('builder.rebind(JobStore).toValue(persistence.jobs);');
    expect(read(root, PLATFORM)).toContain('builder.rebind(ProcessStore).toValue(persistence.processes);');
    expect(jsonAt(readJson(root, 'package.json'), 'dependencies')).toHaveProperty('@ddd-ts-kit/scheduling');
  });

  it('creates both tables of Knex with the first migration', () => {
    const root = initProject('--orm', 'knex');

    expect(read(root, SCHEMA)).toContain('await createJobTable(knex, { schema: MESSAGING_SCHEMA });');
    expect(read(root, SCHEMA)).toContain('await createProcessTable(knex, { schema: MESSAGING_SCHEMA });');

    expect(read(root, PERSISTENCE)).toContain(
      'processes: new KnexProcessStore(unitOfWork, { schema: MESSAGING_SCHEMA }),',
    );
  });

  it('binds the jobs and the process instances of Prisma, their models in the schema of the messaging tables', () => {
    const root = initProject('--orm', 'prisma', '--di', 'nest', '--http', 'nest', '--queue', 'database');
    const schema = read(root, 'prisma/schema.prisma');

    expect(schema).toContain('model BackgroundJob {');
    expect(schema).toContain('model ProcessInstance {');
    expect(schema).toContain('  @@map("background_jobs")\n  @@schema("messaging")');

    expect(read(root, PERSISTENCE)).toContain(
      'jobs: new PrismaJobStore(unitOfWork, { delegate: (current) => current.backgroundJob, schema: MESSAGING_SCHEMA }),',
    );

    expect(read(root, PERSISTENCE)).toContain(
      'processes: new PrismaProcessStore(unitOfWork, { delegate: (current) => current.processInstance }),',
    );

    expect(read(root, BACKGROUND_WORK)).toContain('store: persistence.processes,');
  });

  it('keeps the process instances of Prisma in the database when the jobs go to the server of the cache', () => {
    const root = initProject('--orm', 'prisma', '--cache', 'redis', '--queue', 'redis');

    expect(read(root, 'prisma/schema.prisma')).not.toContain('model BackgroundJob {');
    expect(read(root, 'prisma/schema.prisma')).toContain('model ProcessInstance {');
    expect(read(root, PERSISTENCE)).not.toContain('PrismaJobStore');
    expect(read(root, PLATFORM)).toContain('builder.rebind(ProcessStore).toValue(persistence.processes);');
  });

  it('puts the jobs on the server of the cache with redis, the processes staying in the database', () => {
    const root = initProject('--cache', 'redis', '--queue', 'redis');
    const redis = read(root, 'src/platform/redis/open-redis.ts');

    expect(redis).toContain('onLostJob: reportLostJobs(logger, errors),');

    expect(read(root, PLATFORM)).toContain(
      'builder.rebind(JobStore).toFactory((resolve) => redis.jobs(resolve(Logger)));',
    );

    expect(read(root, PLATFORM)).toContain('builder.rebind(ProcessStore).toValue(persistence.processes);');
    expect(read(root, SCHEMA)).not.toContain('jobsTable');
    expect(read(root, 'docker-compose.yml')).toContain('dragonfly');
  });

  it('logs and reports a job Redis lost after its command committed, to Sentry when the project has it', () => {
    const root = initProject('--cache', 'redis', '--queue', 'redis', '--errors', 'sentry');
    const platform = read(root, PLATFORM);

    expect(platform).toContain('bindRedis(builder, options.redis, options.errors);');
    expect(platform).toContain('builder.rebind(JobStore).toFactory((resolve) => redis.jobs(resolve(Logger), errors));');
  });

  it('writes nothing of a store in memory', () => {
    const root = initProject('--queue', 'memory');

    expect(queueOf(root)).toBe('memory');
    expect(read(root, PLATFORM)).not.toContain('JobStore');
    expect(read(root, SCHEMA)).not.toContain('jobsTable');
  });

  it('refuses a store the stack cannot bind', () => {
    expect(initFailure('--queue', 'redis').message).toBe('--queue redis needs --cache redis.');

    expect(initFailure('--orm', 'custom', '--queue', 'database').message).toBe(
      '--queue database cannot be combined with --orm custom.',
    );
  });
});
