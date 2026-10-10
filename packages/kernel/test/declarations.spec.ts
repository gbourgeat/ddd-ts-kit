import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Clock, CommandBus, type Actor } from '../src/index.js';
import { declarationOf, listDeclarations, tokenIdentity, type Declaration, type Token } from '../src/declarations.js';
import type { HandlerOfAnotherMessage } from './fixtures/declarations/declaration-mistakes.js';
import { decoratorModes, removeCompiled } from './support/decorator-modes.js';

type Clinic = typeof import('./fixtures/declarations/declared-clinic.js');
/** The mistakes are compiled with the clinic, in every mode: each one must still be refused. */
type Mistakes = { readonly refused: HandlerOfAnotherMessage };

const FIXTURES = path.join(import.meta.dirname, 'fixtures/declarations');
const ada: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };

/** The declarations a role may come with: three roles share the one of a port. */
type Playing<Role, D = Declaration> = D extends { readonly role: infer Roles }
  ? Role extends Roles
    ? D
    : never
  : never;

function declared<Role extends Declaration['role']>(target: unknown, role: Role): Playing<Role> {
  const declaration = declarationOf(target);

  if (declaration?.role !== role) {
    throw new Error(`Expected a ${role}, got ${declaration?.role ?? 'no declaration'}`);
  }

  return declaration as Playing<Role>;
}

/**
 * A compiled clinic names the ports of its own copy of the kernel: tokens are compared the way
 * a container keys them, never by reference.
 */
function identities(tokens: readonly Token<unknown>[]): symbol[] {
  return tokens.map(tokenIdentity);
}

function describeTheClinic(label: string, load: () => Promise<Clinic>): void {
  describe(`a declared context, ${label}`, () => {
    let clinic: Clinic;

    beforeAll(async () => {
      clinic = await load();
    }, 60_000);

    messagesAndTheirHandlers(() => clinic);
    adaptersJobsAndPolicies(() => clinic);
    whatDeclaringLeavesAndRefuses(() => clinic);
  });
}

function messagesAndTheirHandlers(clinic: () => Clinic): void {
  describe('messages and their handlers', () => {
    it('a protected command says what it requires, about what, and what an audit may keep', () => {
      const { ScheduleVisit, SearchOpeningHours, scheduleVisits } = clinic();
      const declaration = declared(ScheduleVisit, 'message');
      const command = new ScheduleVisit(ada, 'patient-7', new Date(0));

      expect(declaration).toMatchObject({ kind: 'command', access: 'protected', permission: scheduleVisits });
      expect(declaration.resourceOf?.(command)).toEqual({ type: 'patient', id: 'patient-7' });
      expect(declaration.contextOf?.(command)).toEqual({ onBehalfOf: 'ada' });
      expect(declaration.resourceOf?.(new SearchOpeningHours())).toBeUndefined();
      expect(declaration.audited).toEqual(['startsAt', { field: 'patientId', masked: true }]);
    });

    it('a public message says so, command or query', () => {
      expect(declared(clinic().SearchOpeningHours, 'message')).toEqual({
        role: 'message',
        kind: 'query',
        access: 'public',
        audited: [],
      });

      expect(declared(clinic().RequestCallback, 'message')).toMatchObject({ kind: 'command', audited: ['reason'] });
    });

    it('a handler names its message and the tokens of its constructor, in order', () => {
      const { ScheduleVisit, ScheduleVisitHandler, SearchOpeningHours, SearchOpeningHoursHandler, VisitRepository } =
        clinic();

      const declaration = declared(ScheduleVisitHandler, 'command-handler');

      expect(declaration).toMatchObject({
        role: 'command-handler',
        message: ScheduleVisit,
        implementation: ScheduleVisitHandler,
      });

      expect(identities(declaration.dependencies)).toEqual(identities([VisitRepository, Clock]));

      expect(declared(SearchOpeningHoursHandler, 'query-handler')).toMatchObject({
        message: SearchOpeningHours,
        dependencies: [],
      });
    });

    it('a handler of an integration event names its event and its stable consumer name', () => {
      const { WelcomeOnPatientRegistered, PatientRegistered } = clinic();
      const declaration = declared(WelcomeOnPatientRegistered, 'integration-event-handler');

      expect(declaration).toMatchObject({
        event: { type: 'registry.patient.registered', version: 1 },
        consumer: 'clinic.welcome-on-patient-registered',
      });

      expect(identities(declaration.dependencies)).toEqual(identities([CommandBus]));

      expect(declaration.pair((contract, implementation): unknown[] => [contract, implementation])).toEqual([
        PatientRegistered,
        WelcomeOnPatientRegistered,
      ]);
    });

    it('a handler of a domain event names the event class and the name its events carry', () => {
      const { RemindOnVisitScheduled, VisitScheduled, Reminders } = clinic();
      const declaration = declared(RemindOnVisitScheduled, 'domain-event-handler');

      expect(declaration).toMatchObject({
        name: 'clinic.visit.scheduled',
        event: VisitScheduled,
        dependencies: [Reminders],
      });

      expect(declaration.pair((event, implementation): unknown[] => [event, implementation])).toEqual([
        VisitScheduled,
        RemindOnVisitScheduled,
      ]);
    });
  });
}

function adaptersJobsAndPolicies(clinic: () => Clinic): void {
  describe('adapters, jobs and policies', () => {
    it('a repository, an adapter and a gateway name their port, with a role, a lifetime and aspects', () => {
      const {
        InMemoryVisitRepository,
        SmsReminders,
        AlwaysFreeRooms,
        VisitRepository,
        Reminders,
        ReminderSettings,
        Rooms,
      } = clinic();

      const reminders = declared(SmsReminders, 'adapter');

      expect(declared(InMemoryVisitRepository, 'repository')).toEqual({
        role: 'repository',
        kind: 'repository',
        token: VisitRepository,
        lifetime: 'singleton',
        replaces: false,
        aspects: [],
        implementation: InMemoryVisitRepository,
        dependencies: [],
      });

      expect(reminders).toMatchObject({ kind: 'external', token: Reminders, lifetime: 'transient' });
      expect(identities(reminders.dependencies)).toEqual(identities([Clock, ReminderSettings]));
      expect(reminders.aspects).toHaveLength(1);
      expect(declared(AlwaysFreeRooms, 'gateway')).toMatchObject({ kind: 'gateway', token: Rooms, replaces: true });
    });

    it('a job names itself, its schedule, the options it wrote and the tokens of its constructor', () => {
      const { RemindTomorrowVisits, PurgeExpiredCallbacks } = clinic();
      const declaration = declared(RemindTomorrowVisits, 'job');

      expect(declaration).toMatchObject({
        role: 'job',
        name: 'clinic.remind-tomorrow-visits',
        schedule: { cron: '0 18 * * mon-fri', timeZone: 'Europe/Paris' },
        options: { overlap: 'queue', timeoutMs: 120_000 },
        implementation: RemindTomorrowVisits,
      });

      expect(identities(declaration.dependencies)).toEqual(identities([CommandBus]));

      expect(declared(PurgeExpiredCallbacks, 'job')).toMatchObject({
        schedule: { every: '6h' },
        options: {},
        dependencies: [],
      });

      expect(RemindTomorrowVisits.built).toBe(0);
    });

    it('a job is refused where it is written: a name, a cron or a time zone that cannot be read', () => {
      const declare =
        (name: `${string}.${string}`, cron = '0 7 * * *', timeZone = 'UTC') =>
        () =>
          clinic().declareAJob(name, cron, timeZone);

      expect(declare('Clinic.PurgeCallbacks')).toThrow(
        /"Clinic.PurgeCallbacks" is not a job name: write <context>.<job-name>/,
      );

      expect(declare('clinic.purge', '0 7 * *')).toThrow(
        /Job "clinic.purge": Cron "0 7 \* \*" has 4 field\(s\): five are expected/,
      );

      expect(declare('clinic.purge', '0 7 * * *', 'Europe/Lutece')).toThrow(
        /Job "clinic.purge": "Europe\/Lutece" is not a time zone/,
      );
    });

    it('a projection names itself, its read model and the method that applies each event', () => {
      const { PatientListProjection, PatientList, PatientRegistered, VisitScheduled } = clinic();
      const declaration = declared(PatientListProjection, 'projection');

      expect(declaration).toMatchObject({ name: 'clinic.patient-list', implementation: PatientListProjection });
      expect(identities(declaration.dependencies)).toEqual(identities([PatientList]));

      expect(declaration.applies).toEqual([
        { kind: 'integration', method: 'registered', contract: PatientRegistered },
        { kind: 'domain', method: 'visitScheduled', event: VisitScheduled, name: 'clinic.visit.scheduled' },
      ]);

      expect(PatientListProjection.built).toBe(0);
    });

    it('a projection is refused where it is written: no event, a name that is none, an @On left alone', () => {
      expect(() => clinic().declareAProjectionOfNothing()).toThrow(/Projection OfNothing applies no event/);

      expect(() => clinic().declareAProjection('Clinic.Patients')).toThrow(
        /"Clinic.Patients" is not a projection name/,
      );

      expect(() => clinic().declareAnOnWithoutItsProjection()).toThrow(
        /@On is written on the method "registered" of a class that carries no @Projection/,
      );
    });

    it('a policy names its permission and the reason it gives', () => {
      expect(declared(clinic().OnlyOwnPatients, 'policy')).toMatchObject({
        name: 'clinic.only-own-patients',
        permission: clinic().scheduleVisits,
        implementation: clinic().OnlyOwnPatients,
      });
    });
  });
}

function whatDeclaringLeavesAndRefuses(clinic: () => Clinic): void {
  describe('what declaring leaves and refuses', () => {
    it('declares without building anything, and leaves the class as it was', () => {
      const { SmsReminders, InMemoryVisitRepository, Undeclared } = clinic();

      expect(SmsReminders.built).toBe(0);
      expect(new InMemoryVisitRepository()).toBeInstanceOf(InMemoryVisitRepository);
      expect(Object.isFrozen(declarationOf(SmsReminders))).toBe(true);
      expect(declarationOf(Undeclared)).toBeUndefined();
    });

    it('lists the declared classes this process holds', () => {
      const targets = listDeclarations().map((entry) => entry.target);

      expect(targets).toContain(clinic().ScheduleVisit);
      expect(targets).toContain(clinic().OnlyOwnPatients);
      expect(targets).not.toContain(clinic().Undeclared);
    });

    it('refuses a port that carries behaviour, and an adapter that extends its port', () => {
      expect(() => clinic().declareAnAdapterOfAPortWithABody()).toThrow(
        /TalkativePharmacy implements greet: a port is an abstract class with abstract members only/,
      );

      expect(() => clinic().declareAnAdapterThatExtendsItsPort()).toThrow(
        /CornerPharmacy extends Pharmacy: an adapter implements its port, it never extends it/,
      );
    });

    it('refuses a second declaration on one class, and a message that is none', () => {
      expect(() => clinic().declareTwice()).toThrow(/Twice is declared twice: as message and as message/);
      expect(() => clinic().declareAStranger()).toThrow(/Stranger .* is neither a Command nor a Query/);
    });
  });
}

describeTheClinic(
  'as the test runner transforms it (experimentalDecorators, no plugin)',
  () => import('./fixtures/declarations/declared-clinic.js'),
);

for (const mode of decoratorModes(FIXTURES)) {
  // The compiled clinic declares through its own copy of the kernel sources, and is read
  // here through this one: the registry is shared by every copy a process loads.
  describeTheClinic(`compiled by ${mode.label}`, async () => {
    const emitted = await mode.load('test/fixtures/declarations/declared-clinic.js');

    return emitted as Clinic;
  });
}

afterAll(() => {
  removeCompiled(FIXTURES);
});

describe('declarations', () => {
  it('answer nothing for what is not a declared class', () => {
    class Plain {}
    const mistakes: Partial<Mistakes> = {};

    expect(mistakes.refused).toBeUndefined();
    expect(declarationOf(Plain)).toBeUndefined();
    expect(declarationOf(undefined)).toBeUndefined();
    expect(declarationOf('ScheduleVisit')).toBeUndefined();
  });

  it('are not inherited: a subclass declares itself or nothing', async () => {
    const { InMemoryVisitRepository } = await import('./fixtures/declarations/declared-clinic.js');

    class AuditedVisitRepository extends InMemoryVisitRepository {}

    expect(declarationOf(AuditedVisitRepository)).toBeUndefined();
  });
});
