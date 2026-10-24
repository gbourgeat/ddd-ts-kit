import { describe, expect, it } from 'vitest';
import { exists, read } from './helpers';
import { initProject } from './support/init-project';
import { readJson } from './support/read-json';
import { textsAt } from './support/texts-at';

const platform = (root: string, file: string): string => read(root, `src/platform/${file}`);

/** The files of the folder every stack gets; the module joins them on tsyringe. */
const PRIVACY = [
  'create-privacy.ts',
  'data-subject-copies.ts',
  'data-subject-exports.ts',
  'run-erasure.ts',
  'run-export.ts',
];

const BY_HAND = ['--di', 'manual', '--orm', 'knex'];

describe('the privacy platform init writes', () => {
  it('writes the folder on every stack, with a module of its own on tsyringe only', () => {
    const tsyringe = initProject();
    const byHand = initProject(...BY_HAND);

    for (const file of PRIVACY) {
      expect(exists(tsyringe, `src/platform/privacy/${file}`)).toBe(true);
      expect(exists(byHand, `src/platform/privacy/${file}`)).toBe(true);
    }

    expect(exists(tsyringe, 'src/platform/privacy/privacy.module.ts')).toBe(true);
    expect(exists(byHand, 'src/platform/privacy/privacy.module.ts')).toBe(false);
  });

  it('wires the event sourcing stores of each ORM in the event_store schema, and the in-memory ones without a database', () => {
    const drizzle = initProject();
    const knex = initProject('--orm', 'knex');
    const prisma = initProject('--orm', 'prisma');
    const typeorm = initProject('--orm', 'typeorm');
    const memory = initProject('--orm', 'none');

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

    expect(platform(typeorm, 'database/persistence-over.ts')).toContain(
      'eventSourcing: createTypeOrmEventSourcing(unitOfWork, { schema: EVENT_STORE_SCHEMA }),',
    );

    expect(platform(typeorm, 'database/schema.ts')).toContain('eventStoreEntities({ schema: EVENT_STORE_SCHEMA })');
    expect(platform(memory, 'database/open-persistence.ts')).toContain('subjectKeys: new InMemorySubjectKeyStore(),');
  });

  it('audits the keys of the data subjects when the trail is on, and hands the plain keys otherwise', () => {
    const audited = initProject();
    const unaudited = initProject('--audit', 'off');

    expect(platform(audited, 'privacy/create-privacy.ts')).toContain(
      'const subjectKeys = auditedSubjectKeys(persistence.eventSourcing.subjectKeys, audit.trail, source);',
    );

    expect(platform(audited, 'composition/lay-foundations.ts')).toContain(
      'privacy: createPrivacy(persistence, audit, { scope, clock, ids }),',
    );

    expect(platform(unaudited, 'privacy/create-privacy.ts')).not.toContain('auditedSubjectKeys');

    expect(platform(unaudited, 'privacy/create-privacy.ts')).toContain(
      'const { subjectKeys } = persistence.eventSourcing;',
    );

    expect(platform(unaudited, 'composition/lay-foundations.ts')).toContain('privacy: createPrivacy(persistence),');
  });

  it('binds the stores and the cipher after the platform module on tsyringe, and carries them on the hand-wired platform', () => {
    const tsyringe = initProject();
    const byHand = initProject(...BY_HAND);

    expect(platform(tsyringe, 'composition/compose-application.ts')).toContain(
      'platformModule(persistence, options),\n      privacyModule(persistence, foundations.privacy),\n      guard,',
    );

    const module = platform(tsyringe, 'privacy/privacy.module.ts');

    for (const port of ['EventStore', 'SnapshotStore', 'CheckpointStore', 'SubjectKeyStore', 'PersonalDataCipher']) {
      expect(module).toContain(`builder.bind(${port}).toValue(`);
    }

    // A handler spec of an event-sourced aggregate loads and saves through stores of the test, and needs no fake.
    const testModule = platform(tsyringe, 'composition/platform-test.module.ts');

    expect(testModule).toContain('bindEventSourcing(builder);');
    expect(testModule).toContain('builder.bind(PersonalDataCipher).toValue(new PersonalDataCipher(subjectKeys));');

    expect(platform(byHand, 'composition/platform.ts')).toContain('readonly privacy: Privacy;');
    expect(platform(byHand, 'composition/lay-foundations.ts')).toContain("| 'privacy';");
    expect(platform(byHand, 'privacy/run-erasure.ts')).toContain('keys: platform.privacy.subjectKeys,');

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

    expect(platform(tenants, 'privacy/run-export.ts')).toContain('for (const tenantId of request.tenants) {');
    expect(read(tenants, 'scripts/privacy-erase.ts')).toContain("process.env['TENANTS']");

    expect(platform(one, 'privacy/run-erasure.ts')).not.toContain('inEachTenant');
    expect(platform(one, 'privacy/run-erasure.ts')).toContain("origin: 'cli'");
    expect(read(one, 'scripts/privacy-erase.ts')).not.toContain('TENANTS');
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
