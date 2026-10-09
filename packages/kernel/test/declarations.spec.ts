import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '../src/index.js';
import {
  CLOCK,
  COMMAND_BUS,
  declarationOf,
  listDeclarations,
  token,
  type Declaration,
} from '../src/declarations.js';
import type { HandlerOfAnotherMessage } from './fixtures/declarations/declaration-mistakes.js';
import { decoratorModes, removeCompiled } from './support/decorator-modes.js';

type Clinic = typeof import('./fixtures/declarations/declared-clinic.js');
/** The mistakes are compiled with the clinic, in every mode: each one must still be refused. */
type Mistakes = { readonly refused: HandlerOfAnotherMessage };

const FIXTURES = path.join(import.meta.dirname, 'fixtures/declarations');
const ada: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };

/** The declarations a role may come with: three roles share the one of a port. */
type Playing<Role, D = Declaration> = D extends { readonly role: infer Roles } ? (Role extends Roles ? D : never) : never;

function declared<Role extends Declaration['role']>(target: unknown, role: Role): Playing<Role> {
  const declaration = declarationOf(target);
  if (declaration?.role !== role) throw new Error(`Expected a ${role}, got ${declaration?.role ?? 'no declaration'}`);
  return declaration as Playing<Role>;
}

function describeTheClinic(label: string, load: () => Promise<Clinic>): void {
  describe(`a declared context, ${label}`, () => {
    let clinic: Clinic;

    beforeAll(async () => {
      clinic = await load();
    }, 60_000);

    it('a protected command says what it requires, about what, and what an audit may keep', () => {
      const { ScheduleVisit, ListOpeningHours, scheduleVisits } = clinic;
      const declaration = declared(ScheduleVisit, 'message');
      const command = new ScheduleVisit(ada, 'patient-7', new Date(0));

      expect(declaration).toMatchObject({ kind: 'command', access: 'protected', permission: scheduleVisits });
      expect(declaration.resourceOf?.(command)).toEqual({ type: 'patient', id: 'patient-7' });
      expect(declaration.contextOf?.(command)).toEqual({ onBehalfOf: 'ada' });
      expect(declaration.resourceOf?.(new ListOpeningHours())).toBeUndefined();
      expect(declaration.audited).toEqual(['startsAt', { field: 'patientId', masked: true }]);
    });

    it('a public message says so, command or query', () => {
      expect(declared(clinic.ListOpeningHours, 'message')).toEqual({
        role: 'message',
        kind: 'query',
        access: 'public',
        audited: [],
      });
      expect(declared(clinic.RequestCallback, 'message')).toMatchObject({ kind: 'command', audited: ['reason'] });
    });

    it('a handler names its message and the tokens of its constructor, in order', () => {
      const { ScheduleVisit, ScheduleVisitHandler, ListOpeningHours, ListOpeningHoursHandler, VISITS } = clinic;

      expect(declared(ScheduleVisitHandler, 'command-handler')).toEqual({
        role: 'command-handler',
        message: ScheduleVisit,
        implementation: ScheduleVisitHandler,
        dependencies: [VISITS, CLOCK],
      });
      expect(declared(ListOpeningHoursHandler, 'query-handler')).toMatchObject({
        message: ListOpeningHours,
        dependencies: [],
      });
    });

    it('a listener of an integration event names its event and its stable consumer name', () => {
      const { WelcomeOnPatientRegistered, PatientRegistered } = clinic;
      const declaration = declared(WelcomeOnPatientRegistered, 'event-listener');

      expect(declaration).toMatchObject({
        event: { type: 'registry.patient.registered', version: 1 },
        consumer: 'clinic.welcome-on-patient-registered',
        dependencies: [COMMAND_BUS],
      });
      expect(declaration.pair((contract, implementation): unknown[] => [contract, implementation])).toEqual([
        PatientRegistered,
        WelcomeOnPatientRegistered,
      ]);
    });

    it('a listener of a domain event names the event class and the name its events carry', () => {
      const { RemindOnVisitScheduled, VisitScheduled, REMINDERS } = clinic;
      const declaration = declared(RemindOnVisitScheduled, 'domain-event-listener');

      expect(declaration).toMatchObject({ name: 'clinic.visit.scheduled', event: VisitScheduled, dependencies: [REMINDERS] });
      expect(declaration.pair((event, implementation): unknown[] => [event, implementation])).toEqual([
        VisitScheduled,
        RemindOnVisitScheduled,
      ]);
    });

    it('a repository, an adapter and a gateway name their port, with a role, a lifetime and aspects', () => {
      const { InMemoryVisitRepository, SmsReminders, AlwaysFreeRooms, VISITS, REMINDERS, ROOMS } = clinic;

      expect(declared(InMemoryVisitRepository, 'repository')).toEqual({
        role: 'repository',
        kind: 'repository',
        token: VISITS,
        lifetime: 'singleton',
        replaces: false,
        aspects: [],
        implementation: InMemoryVisitRepository,
        dependencies: [],
      });
      expect(declared(SmsReminders, 'adapter')).toMatchObject({
        kind: 'external',
        token: REMINDERS,
        lifetime: 'transient',
        dependencies: [CLOCK],
      });
      expect(declared(SmsReminders, 'adapter').aspects).toHaveLength(1);
      expect(declared(AlwaysFreeRooms, 'gateway')).toMatchObject({ kind: 'gateway', token: ROOMS, replaces: true });
    });

    it('a policy names its permission and the reason it gives', () => {
      expect(declared(clinic.OnlyOwnPatients, 'policy')).toMatchObject({
        name: 'clinic.only-own-patients',
        permission: clinic.scheduleVisits,
        implementation: clinic.OnlyOwnPatients,
      });
    });

    it('declares without building anything, and leaves the class as it was', () => {
      const { SmsReminders, InMemoryVisitRepository, Undeclared } = clinic;

      expect(SmsReminders.built).toBe(0);
      expect(new InMemoryVisitRepository()).toBeInstanceOf(InMemoryVisitRepository);
      expect(Object.isFrozen(declarationOf(SmsReminders))).toBe(true);
      expect(declarationOf(Undeclared)).toBeUndefined();
    });

    it('lists the declared classes this process holds', () => {
      const targets = listDeclarations().map((entry) => entry.target);

      expect(targets).toContain(clinic.ScheduleVisit);
      expect(targets).toContain(clinic.OnlyOwnPatients);
      expect(targets).not.toContain(clinic.Undeclared);
    });

    it('refuses a second declaration on one class, and a message that is none', () => {
      expect(() => clinic.declareTwice()).toThrow(/Twice is declared twice: as message and as message/);
      expect(() => clinic.declareAStranger()).toThrow(/Stranger .* is neither a Command nor a Query/);
    });
  });
}

describeTheClinic('as the test runner transforms it (experimentalDecorators, no plugin)', () =>
  import('./fixtures/declarations/declared-clinic.js'),
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

describe('tokens', () => {
  it('a project token is unique, even under the same description', () => {
    expect(token<string>('clinic.Name')).not.toBe(token<string>('clinic.Name'));
    expect(token<string>('clinic.Name').description).toBe('clinic.Name');
  });

  it('a standard token is the same symbol in every copy of the kernel a process loads', () => {
    expect(CLOCK).toBe(Symbol.for('kernel.Clock'));
    expect(COMMAND_BUS.description).toBe('kernel.CommandBus');
  });
});
