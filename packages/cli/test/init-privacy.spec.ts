import { describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir } from './helpers';
import { initProject } from './support/init-project';
import { readJson } from './support/read-json';
import { textsAt } from './support/texts-at';

const platform = (root: string, file: string): string => read(root, `src/platform/${file}`);
const stackOf = (root: string): Record<string, string> => textsAt(readJson(root, 'ddd-ts-kit.config.json'), 'stack');

/** The files of the folder `--privacy on` writes, in both families. */
const PRIVACY = ['data-subject-copies.ts', 'data-subject-exports.ts', 'run-erasure.ts', 'run-export.ts'];

const BY_HAND = ['--di', 'manual', '--orm', 'knex'];
const EVENT_SOURCED = ['--event-sourcing', 'on'];

describe('the personal data of a generated project: --privacy', () => {
  it('writes the privacy folder and its two scripts by default with an ORM, and records the choice', () => {
    const tsyringe = initProject();
    const byHand = initProject(...BY_HAND);

    for (const file of PRIVACY) {
      expect(exists(tsyringe, `src/platform/privacy/${file}`)).toBe(true);
      expect(exists(byHand, `src/platform/privacy/${file}`)).toBe(true);
    }

    expect(exists(tsyringe, 'scripts/privacy-erase.ts')).toBe(true);
    expect(exists(tsyringe, 'scripts/privacy-export.ts')).toBe(true);
    expect(read(tsyringe, 'README.md')).toContain('## Personal data');
    expect(stackOf(tsyringe)).toMatchObject({ privacy: 'on', eventSourcing: 'off' });
  });

  it('writes nothing of it with --privacy off, nor without an ORM unless asked', () => {
    const off = initProject('--privacy', 'off');
    const memory = initProject('--orm', 'none');
    const asked = initProject('--orm', 'none', '--privacy', 'on');

    expect(exists(off, 'src/platform/privacy')).toBe(false);
    expect(exists(off, 'scripts/privacy-erase.ts')).toBe(false);
    expect(exists(off, 'scripts/privacy-export.ts')).toBe(false);
    expect(textsAt(readJson(off, 'package.json'), 'scripts')).not.toHaveProperty('privacy:erase');
    expect(read(off, 'README.md')).not.toContain('## Personal data');
    expect(stackOf(off)).toMatchObject({ privacy: 'off' });

    expect(exists(memory, 'src/platform/privacy')).toBe(false);
    expect(stackOf(memory)).toMatchObject({ privacy: 'off' });
    expect(exists(asked, 'src/platform/privacy/run-erasure.ts')).toBe(true);
  });

  it('erases the copies alone while the project has no event store, and the key first once it has one', () => {
    const rows = initProject();
    const events = initProject(...EVENT_SOURCED);
    const byHand = initProject(...BY_HAND, ...EVENT_SOURCED);

    expect(platform(rows, 'privacy/run-erasure.ts')).not.toContain('keys:');
    expect(platform(rows, 'privacy/run-erasure.ts')).not.toContain('SubjectKeyStore');
    expect(platform(rows, 'privacy/run-erasure.ts')).toContain('so no key is destroyed');
    expect(read(rows, 'scripts/privacy-erase.ts')).toContain('there is no key to destroy');

    expect(platform(events, 'privacy/run-erasure.ts')).toContain('keys: container.resolve(SubjectKeyStore),');
    expect(read(events, 'scripts/privacy-erase.ts')).toContain('The key of the subject is destroyed first');
    expect(platform(byHand, 'privacy/run-erasure.ts')).toContain('keys: platform.eventSourcing.subjectKeys,');

    expect(platform(byHand, 'privacy/run-erasure.ts')).toContain(
      'copies: dataSubjectCopies.map((copy) => copy(platform)),',
    );
  });

  it('erases in every tenant with shared tables, since a write of tenant data is never widened, and in one context otherwise', () => {
    const tenants = initProject('--tenancy', 'shared-table');
    const one = initProject();

    expect(platform(tenants, 'privacy/run-erasure.ts')).toContain(
      'inEveryTenant: inEachTenant(scope, request.tenants),',
    );

    expect(platform(tenants, 'privacy/run-export.ts')).toContain(
      'inEveryTenant: recordsInEachTenant(scope, request.tenants),',
    );

    expect(read(tenants, 'scripts/privacy-erase.ts')).toContain("process.env['TENANTS']");

    expect(platform(one, 'privacy/run-erasure.ts')).not.toContain('inEachTenant');
    expect(platform(one, 'privacy/run-erasure.ts')).toContain("origin: 'cli'");
    expect(read(one, 'scripts/privacy-erase.ts')).not.toContain('TENANTS');
  });

  it('gathers the export into one dated document of the kernel, each export audited when the trail is on', () => {
    const audited = initProject();
    const unaudited = initProject('--audit', 'off');
    const byHand = initProject(...BY_HAND);

    expect(platform(audited, 'privacy/run-export.ts')).toContain(
      "import { AuditTrail, auditedPersonalDataExport } from '@ddd-ts-kit/audit';",
    );

    expect(platform(audited, 'privacy/run-export.ts')).toContain(
      'const audited = (port: PersonalDataExport): PersonalDataExport => auditedPersonalDataExport(port, trail, source);',
    );

    expect(platform(audited, 'privacy/run-export.ts')).toContain('Promise<PersonalDataExportDocument>');

    expect(platform(audited, 'privacy/run-export.ts')).toContain(
      '    exportDataSubject(subject, {\n      exports,\n      clock,\n',
    );

    expect(platform(unaudited, 'privacy/run-export.ts')).not.toContain('audited');

    expect(platform(unaudited, 'privacy/run-export.ts')).toContain(
      'const exports: readonly PersonalDataExport[] = dataSubjectExports.map((port) => container.resolve(port));',
    );

    expect(platform(byHand, 'privacy/run-export.ts')).toContain(
      'const source = { scope: platform.scope, clock: platform.clock, ids: platform.ids };',
    );

    expect(platform(byHand, 'privacy/run-export.ts')).toContain('clock: platform.clock,');
    expect(read(audited, 'scripts/privacy-export.ts')).toContain('const document = await runExport(subject, {');
    expect(read(audited, 'scripts/privacy-export.ts')).toContain('the audit trail keeps the entry of each export');
    expect(read(unaudited, 'scripts/privacy-export.ts')).not.toContain('audit trail');
  });

  it('writes the two scripts of the requests of a data subject, on the sources with the variables of .env', () => {
    const tsyringe = initProject();
    const byHand = initProject(...BY_HAND);

    expect(textsAt(readJson(tsyringe, 'package.json'), 'scripts')).toMatchObject({
      'privacy:erase': 'tsx --env-file-if-exists=.env scripts/privacy-erase.ts',
      'privacy:export': 'tsx --env-file-if-exists=.env scripts/privacy-export.ts',
    });

    expect(read(tsyringe, 'scripts/privacy-erase.ts')).toContain('container: application.container,');
    expect(read(tsyringe, 'scripts/privacy-export.ts')).toContain('await runExport(subject, {');
    expect(read(byHand, 'scripts/privacy-erase.ts')).toContain('platform: application.platform,');
    expect(read(byHand, 'scripts/privacy-erase.ts')).toContain('await persistence.close();');
  });
});

describe('the erasure announced to the services that keep a copy', () => {
  it('announces the erasure through the outbox once every copy is erased, once per tenant with shared tables', () => {
    const one = initProject();
    const tenants = initProject('--tenancy', 'shared-table');
    const byHand = initProject(...BY_HAND);

    expect(platform(one, 'privacy/run-erasure.ts')).toContain(
      'const publisher = container.resolve(IntegrationEventPublisher);',
    );

    expect(platform(one, 'privacy/run-erasure.ts')).toContain(
      '    await announceErasure(subject, request);\n\n    return report;',
    );

    expect(platform(one, 'privacy/run-erasure.ts')).toContain('  await publish();');

    expect(platform(tenants, 'privacy/run-erasure.ts')).toContain(
      'await eachTenant(container.resolve(ExecutionScope), request.tenants, publish);',
    );

    expect(platform(byHand, 'privacy/run-erasure.ts')).toContain(
      'const publish = () => platform.publisher.publish([event()]);',
    );

    expect(read(one, 'scripts/events.ts')).toContain(
      'const registry = createEventRegistry([...(await declaredEvents()), dataSubjectErasedV1]);',
    );

    expect(read(initProject('--privacy', 'off'), 'scripts/events.ts')).not.toContain('dataSubjectErasedV1');
  });
});

describe('the event store of a generated project: --event-sourcing', () => {
  it('wires no event store unless asked: no table, no store, no folder, nothing bound', () => {
    const project = initProject();

    expect(platform(project, 'database/persistence.ts')).not.toContain('eventSourcing');
    expect(platform(project, 'database/persistence-over.ts')).not.toContain('EventSourcing');
    expect(platform(project, 'database/schema.ts')).not.toContain('EVENT_STORE_SCHEMA');
    expect(exists(project, 'src/platform/event-sourcing')).toBe(false);
    expect(platform(project, 'composition/compose-application.ts')).not.toContain('eventSourcingModule');
    expect(platform(project, 'composition/lay-foundations.ts')).not.toContain('eventSourcing');
    expect(platform(project, 'composition/platform-test.module.ts')).not.toContain('bindEventSourcing');

    expect(platform(project, 'composition/platform-test.module.ts')).toContain(
      "import { defineContextModule } from '@ddd-ts-kit/di';",
    );
  });

  it('wires the stores of each ORM in the event_store schema, and the in-memory ones without a database', () => {
    const drizzle = initProject(...EVENT_SOURCED);
    const knex = initProject('--orm', 'knex', ...EVENT_SOURCED);
    const prisma = initProject('--orm', 'prisma', ...EVENT_SOURCED);
    const typeorm = initProject('--orm', 'typeorm', ...EVENT_SOURCED);
    const memory = initProject('--orm', 'none', ...EVENT_SOURCED);

    expect(platform(drizzle, 'database/persistence.ts')).toContain('readonly eventSourcing: EventSourcingStores;');
    expect(platform(memory, 'database/persistence.ts')).toContain('readonly eventSourcing: EventSourcingStores;');

    expect(platform(drizzle, 'database/persistence-over.ts')).toContain(
      'eventSourcing: createDrizzleEventSourcing(unitOfWork, { schema: EVENT_STORE_SCHEMA }),',
    );

    expect(platform(drizzle, 'database/schema.ts')).toContain('eventStoreTables(EVENT_STORE_SCHEMA)');

    expect(platform(knex, 'database/persistence-over.ts')).toContain(
      'eventSourcing: createKnexEventSourcing(unitOfWork, { schema: EVENT_STORE_SCHEMA }),',
    );

    expect(platform(knex, 'database/schema.ts')).toContain(
      'createEventStoreTables(knex, { schema: EVENT_STORE_SCHEMA })',
    );

    expect(platform(prisma, 'database/persistence-over.ts')).toContain(
      'eventSourcing: createPrismaEventSourcing(unitOfWork, { schema: EVENT_STORE_SCHEMA }),',
    );

    expect(read(prisma, 'prisma/schema.prisma')).toContain('@@schema("event_store")');
    expect(read(prisma, 'prisma/schema.prisma')).toContain('schemas  = ["messaging", "event_store"]');

    expect(platform(typeorm, 'database/persistence-over.ts')).toContain(
      'eventSourcing: createTypeOrmEventSourcing(unitOfWork, { schema: EVENT_STORE_SCHEMA }),',
    );

    expect(platform(typeorm, 'database/schema.ts')).toContain('eventStoreEntities({ schema: EVENT_STORE_SCHEMA })');
    expect(platform(memory, 'database/open-persistence.ts')).toContain('subjectKeys: new InMemorySubjectKeyStore(),');
    expect(stackOf(drizzle)).toMatchObject({ eventSourcing: 'on' });
  });

  it('refuses the event store over a custom storage, with what to bind instead', () => {
    const refused = cli(tempDir('init'), 'init', '--orm', 'custom', ...EVENT_SOURCED);

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('--event-sourcing on cannot be combined with --orm custom.');
    expect(refused.stderr).toContain('eventStoreContract');
  });

  it('is added to an initialised project by init --force, which keeps every other choice', () => {
    const project = initProject();
    const forced = cli(project, 'init', '--force', ...EVENT_SOURCED);

    expect(forced.code, forced.stderr).toBe(0);
    expect(stackOf(project)).toMatchObject({ eventSourcing: 'on', privacy: 'on' });
    expect(exists(project, 'src/platform/event-sourcing/create-event-sourcing.ts')).toBe(true);
    expect(platform(project, 'database/schema.ts')).toContain('EVENT_STORE_SCHEMA');
    expect(platform(project, 'privacy/run-erasure.ts')).toContain('keys: container.resolve(SubjectKeyStore),');
  });
});

describe('what the event store hands the composition root', () => {
  it('audits the keys of the data subjects when the trail is on, and hands the plain keys otherwise', () => {
    const audited = initProject(...EVENT_SOURCED);
    const unaudited = initProject('--audit', 'off', ...EVENT_SOURCED);

    expect(platform(audited, 'event-sourcing/create-event-sourcing.ts')).toContain(
      'const subjectKeys = auditedSubjectKeys(persistence.eventSourcing.subjectKeys, audit.trail, source);',
    );

    expect(platform(audited, 'composition/lay-foundations.ts')).toContain(
      'eventSourcing: createEventSourcing(persistence, audit, { scope, clock, ids }),',
    );

    expect(platform(unaudited, 'event-sourcing/create-event-sourcing.ts')).not.toContain('auditedSubjectKeys');

    expect(platform(unaudited, 'event-sourcing/create-event-sourcing.ts')).toContain(
      'const { subjectKeys } = persistence.eventSourcing;',
    );

    expect(platform(unaudited, 'composition/lay-foundations.ts')).toContain(
      'eventSourcing: createEventSourcing(persistence),',
    );
  });

  it('binds the stores and the cipher after the platform module on tsyringe, and carries them on the hand-wired platform', () => {
    const tsyringe = initProject(...EVENT_SOURCED);
    const byHand = initProject(...BY_HAND, ...EVENT_SOURCED);

    expect(platform(tsyringe, 'composition/compose-application.ts')).toContain(
      'platformModule(persistence, options),\n      eventSourcingModule(foundations.eventSourcing),\n      guard,',
    );

    const module = platform(tsyringe, 'event-sourcing/event-sourcing.module.ts');

    for (const port of ['EventStore', 'SnapshotStore', 'CheckpointStore', 'SubjectKeyStore', 'PersonalDataCipher']) {
      expect(module).toContain(`builder.bind(${port}).toValue(`);
    }

    // A handler spec of an event-sourced aggregate loads and saves through stores of the test, and needs no fake.
    const testModule = platform(tsyringe, 'composition/platform-test.module.ts');

    expect(testModule).toContain('bindEventSourcing(builder);');
    expect(testModule).toContain('builder.bind(PersonalDataCipher).toValue(new PersonalDataCipher(subjectKeys));');

    expect(exists(byHand, 'src/platform/event-sourcing/event-sourcing.module.ts')).toBe(false);
    expect(platform(byHand, 'composition/platform.ts')).toContain('readonly eventSourcing: EventSourcing;');
    expect(platform(byHand, 'composition/lay-foundations.ts')).toContain("| 'eventSourcing';");
  });

  it('stands without the privacy folder: an event-sourced project that answers no request keeps its keys all the same', () => {
    const project = initProject(...EVENT_SOURCED, '--privacy', 'off');

    expect(exists(project, 'src/platform/event-sourcing/create-event-sourcing.ts')).toBe(true);
    expect(exists(project, 'src/platform/privacy')).toBe(false);
    expect(platform(project, 'composition/platform-test.module.ts')).toContain('bindEventSourcing(builder);');
    expect(read(project, 'README.md')).not.toContain('## Personal data');
  });

  it('lays the hand-wired foundations on one line while they fit the width, one member per line beyond it', () => {
    const narrow = initProject(...BY_HAND);
    const wide = initProject(...BY_HAND, '--errors', 'sentry', ...EVENT_SOURCED);

    expect(platform(narrow, 'composition/lay-foundations.ts')).toContain(
      "type Founded = 'scope' | 'clock' | 'ids' | 'logger' | 'metrics' | 'cache' | 'jobs' | 'audit';",
    );

    expect(platform(wide, 'composition/lay-foundations.ts')).toContain(
      "type Founded =\n  | 'scope'\n  | 'clock'\n  | 'ids'\n  | 'logger'\n  | 'metrics'\n  | 'errors'\n  | 'cache'\n  | 'jobs'\n  | 'audit'\n  | 'eventSourcing';",
    );
  });
});
