import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, fake, type ContextModule, type Override } from '@ddd-ts-kit/di';
import { createTestApplication } from '@ddd-ts-kit/di/tsyringe';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/composition/platform-test.module';
import { Agenda } from '@/contexts/scheduling/calendars/application/ports/agenda.port';
import { AppointmentRepository } from '@/contexts/scheduling/calendars/domain/repositories/appointment.repository';
import { AttendanceHistory } from '@/contexts/scheduling/calendars/application/ports/attendance-history.port';
import { AttendanceRecordRepository } from '@/contexts/scheduling/calendars/domain/repositories/attendance-record.repository';
import { CalendarRepository } from '@/contexts/scheduling/calendars/domain/repositories/calendar.repository';
import { PersonDirectoryGateway } from '@/contexts/scheduling/calendars/application/ports/person-directory-gateway.port';
import { PractitionerDirectory } from '@/contexts/scheduling/calendars/application/ports/practitioner-directory.port';
import { SchedulingPersonalDataErasure } from '@/contexts/scheduling/calendars/application/ports/scheduling-personal-data-erasure.port';
import { SchedulingRelationships } from '@/contexts/scheduling/calendars/application/ports/scheduling-relationships.port';
import { WaitlistRepository } from '@/contexts/scheduling/waitlist/domain/repositories/waitlist.repository';
import { FakeAgenda } from '@/contexts/scheduling/test/fakes/agenda.fake';
import { FakeAppointmentRepository } from '@/contexts/scheduling/test/fakes/appointment.repository.fake';
import { FakeAttendanceHistory } from '@/contexts/scheduling/test/fakes/attendance-history.fake';
import { FakeAttendanceRecordRepository } from '@/contexts/scheduling/test/fakes/attendance-record.repository.fake';
import { FakeCalendarRepository } from '@/contexts/scheduling/test/fakes/calendar.repository.fake';
import { FakePersonDirectoryGateway } from '@/contexts/scheduling/test/fakes/person-directory-gateway.fake';
import { FakePractitionerDirectory } from '@/contexts/scheduling/test/fakes/practitioner-directory.fake';
import { FakeSchedulingPersonalDataErasure } from '@/contexts/scheduling/test/fakes/scheduling-personal-data-erasure.fake';
import { FakeSchedulingRelationships } from '@/contexts/scheduling/test/fakes/scheduling-relationships.fake';
import { FakeWaitlistRepository } from '@/contexts/scheduling/test/fakes/waitlist.repository.fake';

const nobody = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: {} }) });

export interface SchedulingWorldFakes {
  readonly agenda: FakeAgenda;
  readonly appointmentRepository: FakeAppointmentRepository;
  readonly attendanceHistory: FakeAttendanceHistory;
  readonly attendanceRecordRepository: FakeAttendanceRecordRepository;
  readonly calendarRepository: FakeCalendarRepository;
  readonly personDirectoryGateway: FakePersonDirectoryGateway;
  readonly practitionerDirectory: FakePractitionerDirectory;
  readonly schedulingPersonalDataErasure: FakeSchedulingPersonalDataErasure;
  readonly schedulingRelationships: FakeSchedulingRelationships;
  readonly waitlistRepository: FakeWaitlistRepository;
}

export interface SchedulingWorldOptions {
  readonly now?: Date;
  readonly idPrefix?: string;
  readonly modules?: readonly ContextModule[];
  readonly fakes?: readonly Override[];
  readonly tenants?: readonly string[];
  readonly given?: (fakes: SchedulingWorldFakes) => Promise<void>;
}

export async function aSchedulingWorld({ modules = [nobody], given, ...settings }: SchedulingWorldOptions = {}) {
  const context = contextModule('scheduling', schedulingDeclarations);

  const fakes = buildFakes();

  await given?.(fakes);

  const application = createTestApplication({
    ...settings,
    eventBusFailures: 'as-thrown',
    modules: [platformTestModule, context, ...modules],
    fakes: overridden(settings.fakes, [
      fake(Agenda, fakes.agenda),
      fake(AppointmentRepository, fakes.appointmentRepository),
      fake(AttendanceHistory, fakes.attendanceHistory),
      fake(AttendanceRecordRepository, fakes.attendanceRecordRepository),
      fake(CalendarRepository, fakes.calendarRepository),
      fake(PersonDirectoryGateway, fakes.personDirectoryGateway),
      fake(PractitionerDirectory, fakes.practitionerDirectory),
      fake(SchedulingPersonalDataErasure, fakes.schedulingPersonalDataErasure),
      fake(SchedulingRelationships, fakes.schedulingRelationships),
      fake(WaitlistRepository, fakes.waitlistRepository),
    ]),
  });

  return { application, ...fakes };
}

// The fakes a spec hands replace those the world builds for the same port.
function overridden(handed: readonly Override[] | undefined, built: readonly Override[]): Override[] {
  const replaced = new Set((handed ?? []).map(([port]) => port));

  return [...built.filter(([port]) => !replaced.has(port)), ...(handed ?? [])];
}

function buildFakes(): SchedulingWorldFakes {
  return {
    agenda: new FakeAgenda(),
    appointmentRepository: new FakeAppointmentRepository(),
    attendanceHistory: new FakeAttendanceHistory(),
    attendanceRecordRepository: new FakeAttendanceRecordRepository(),
    calendarRepository: new FakeCalendarRepository(),
    personDirectoryGateway: new FakePersonDirectoryGateway(),
    practitionerDirectory: new FakePractitionerDirectory(),
    schedulingPersonalDataErasure: new FakeSchedulingPersonalDataErasure(),
    schedulingRelationships: new FakeSchedulingRelationships(),
    waitlistRepository: new FakeWaitlistRepository(),
  };
}
