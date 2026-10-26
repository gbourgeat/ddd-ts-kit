import { describe, expect, it } from 'vitest';
import { auditPrismaModels } from '@ddd-ts-kit/audit/prisma';
import { read } from './helpers';
import { initProject } from './support/init-project';

const platform = (root: string, file: string): string => read(root, `src/platform/${file}`);
/** On request while the files are on the disk of the server, the default storage. */
const ON_REQUEST = "'audit.archive': { enabled: environment['JOB_AUDIT_ARCHIVE_ENABLED'] === 'true' },";
/** On unless switched off once the files are in an object store. */
const BY_DEFAULT = "'audit.archive': { enabled: environment['JOB_AUDIT_ARCHIVE_ENABLED'] !== 'false' },";

describe('init: the monthly archive of the audit trail', () => {
  it('registers audit.archive on the first day of every month with the trail in a database and a storage of files', () => {
    const root = initProject();

    expect(platform(root, 'audit/audit.module.ts')).toContain(
      "      if (jobs) {\n        builder\n          .job('audit.archive', { cron: '0 4 1 * *', tenancy: 'global' })\n" +
        '          .handledByFactory((resolve) => new ArchiveAuditEntries(audit.trail, resolve(FileStorage), resolve(Clock)));',
    );

    expect(platform(root, 'jobs/job-settings.ts')).toContain(ON_REQUEST);

    expect(platform(root, 'database/schema.ts')).toContain(
      'export const auditArchives = auditArchivesTable(AUDIT_SCHEMA);',
    );
  });

  it('runs it unless switched off once the files are in an object store, and only on request on the disk of the server', () => {
    const local = platform(initProject(), 'jobs/job-settings.ts');
    const objectStore = platform(initProject('--storage', 's3'), 'jobs/job-settings.ts');

    expect(local).toContain(ON_REQUEST);
    expect(local).toContain('JOB_AUDIT_ARCHIVE_ENABLED=true once that disk is durable and backed up.');
    expect(objectStore).toContain(BY_DEFAULT);
    expect(objectStore).not.toContain(ON_REQUEST);
  });

  it('registers it on the scheduler of a hand-wired platform the same way', () => {
    const composition = platform(initProject('--di', 'manual', '--orm', 'knex'), 'composition/compose-application.ts');

    expect(composition).toContain('  archiveAuditEntries(platform);');

    expect(composition).toContain(
      "  platform.jobs.register({ name: 'audit.archive', schedule: { cron: '0 4 1 * *' }, run: () => archive.run() });",
    );
  });

  it('declares the archives with the rest of the trail on Prisma and TypeORM', () => {
    expect(read(initProject('--orm', 'prisma'), 'prisma/schema.prisma')).toContain(auditPrismaModels('audit'));
    expect(auditPrismaModels('audit')).toContain('model AuditArchive {');
    expect(platform(initProject('--orm', 'typeorm'), 'database/schema.ts')).toContain('...auditTrail,');
  });

  it.each([
    ['without a storage of files', ['--storage', 'none']],
    ['with the trail off', ['--audit', 'off']],
    ['with the trail in the memory of the process', ['--orm', 'none', '--audit', 'on']],
  ])('registers nothing %s', (_, flags) => {
    const root = initProject(...flags);

    expect(platform(root, 'jobs/job-settings.ts')).not.toContain('audit.archive');
  });

  it('registers nothing on a hand-wired platform without a storage of files', () => {
    const composition = platform(
      initProject('--di', 'manual', '--orm', 'knex', '--storage', 'none'),
      'composition/compose-application.ts',
    );

    expect(composition).not.toContain('archiveAuditEntries');
  });
});
