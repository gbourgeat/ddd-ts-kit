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

const queueOf = (root: string): unknown => jsonAt(readJson(root, CONFIG), 'stack', 'queue');

describe('init --queue', () => {
  it('keeps the jobs in the database when the ORM package ships the table, in memory otherwise', () => {
    expect(queueOf(initProject())).toBe('database');
    expect(queueOf(initProject('--orm', 'prisma'))).toBe('memory');
    expect(queueOf(initProject('--di', 'manual'))).toBe('memory');
    expect(cli(initProject(), '--help').stdout).toContain('[--queue database|redis|memory]');
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

    expect(initFailure('--orm', 'prisma', '--queue', 'database').message).toBe(
      '--queue database cannot be combined with --orm prisma.',
    );

    expect(initFailure('--di', 'manual', '--queue', 'database').message).toBe(
      '--queue database cannot be combined with --di manual.',
    );
  });
});
