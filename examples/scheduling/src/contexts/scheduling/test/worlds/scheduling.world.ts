import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication, fake, type ContextModule } from '@ddd-ts-kit/di';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/composition/platform-test.module';
import { Agenda } from '@/contexts/scheduling/application/ports/agenda.port';
import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';
import { AttendanceHistory } from '@/contexts/scheduling/application/ports/attendance-history.port';
import { AttendanceRecordRepository } from '@/contexts/scheduling/domain/repositories/attendance-record.repository';
import { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import { PersonDirectoryGateway } from '@/contexts/scheduling/application/ports/person-directory-gateway.port';
import { PractitionerDirectory } from '@/contexts/scheduling/application/ports/practitioner-directory.port';
import { SchedulingRelationships } from '@/contexts/scheduling/application/ports/scheduling-relationships.port';
import { WaitlistRepository } from '@/contexts/scheduling/domain/repositories/waitlist.repository';
import { FakeAgenda } from '@/contexts/scheduling/test/fakes/agenda.fake';
import { FakeAppointmentRepository } from '@/contexts/scheduling/test/fakes/appointment.repository.fake';
import { FakeAttendanceHistory } from '@/contexts/scheduling/test/fakes/attendance-history.fake';
import { FakeAttendanceRecordRepository } from '@/contexts/scheduling/test/fakes/attendance-record.repository.fake';
import { FakeCalendarRepository } from '@/contexts/scheduling/test/fakes/calendar.repository.fake';
import { FakePersonDirectoryGateway } from '@/contexts/scheduling/test/fakes/person-directory-gateway.fake';
import { FakePractitionerDirectory } from '@/contexts/scheduling/test/fakes/practitioner-directory.fake';
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
  readonly schedulingRelationships: FakeSchedulingRelationships;
  readonly waitlistRepository: FakeWaitlistRepository;
}

export interface SchedulingWorldOptions {
  readonly now?: Date;
  readonly idPrefix?: string;
  readonly modules?: readonly ContextModule[];
  readonly given?: (fakes: SchedulingWorldFakes) => Promise<void>;
}

export async function aSchedulingWorld({ modules = [nobody], given, ...settings }: SchedulingWorldOptions = {}) {
  const context = contextModule('scheduling', schedulingDeclarations);

  const fakes = {
    agenda: new FakeAgenda(),
    appointmentRepository: new FakeAppointmentRepository(),
    attendanceHistory: new FakeAttendanceHistory(),
    attendanceRecordRepository: new FakeAttendanceRecordRepository(),
    calendarRepository: new FakeCalendarRepository(),
    personDirectoryGateway: new FakePersonDirectoryGateway(),
    practitionerDirectory: new FakePractitionerDirectory(),
    schedulingRelationships: new FakeSchedulingRelationships(),
    waitlistRepository: new FakeWaitlistRepository(),
  };

  await given?.(fakes);

  const application = createTestApplication({
    ...settings,
    eventBusFailures: 'as-thrown',
    modules: [platformTestModule, context, ...modules],
    fakes: [
      fake(Agenda, fakes.agenda),
      fake(AppointmentRepository, fakes.appointmentRepository),
      fake(AttendanceHistory, fakes.attendanceHistory),
      fake(AttendanceRecordRepository, fakes.attendanceRecordRepository),
      fake(CalendarRepository, fakes.calendarRepository),
      fake(PersonDirectoryGateway, fakes.personDirectoryGateway),
      fake(PractitionerDirectory, fakes.practitionerDirectory),
      fake(SchedulingRelationships, fakes.schedulingRelationships),
      fake(WaitlistRepository, fakes.waitlistRepository),
    ],
  });

  return { application, ...fakes };
}
