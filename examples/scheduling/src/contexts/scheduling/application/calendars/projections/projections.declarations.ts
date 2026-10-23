import { injected } from '@ddd-ts-kit/kernel/declarations';
import { Agenda } from '@/contexts/scheduling/application/calendars/ports/agenda.port';
import { AttendanceHistory } from '@/contexts/scheduling/application/calendars/ports/attendance-history.port';
import { PractitionerDirectory } from '@/contexts/scheduling/application/calendars/ports/practitioner-directory.port';
import { AgendaProjection } from '@/contexts/scheduling/application/calendars/projections/agenda.projection';
import { AttendanceHistoryProjection } from '@/contexts/scheduling/application/calendars/projections/attendance-history.projection';
import { PractitionersProjection } from '@/contexts/scheduling/application/calendars/projections/practitioners.projection';

export * from '@/contexts/scheduling/application/calendars/projections/agenda.projection';
export * from '@/contexts/scheduling/application/calendars/projections/attendance-history.projection';
export * from '@/contexts/scheduling/application/calendars/projections/practitioners.projection';

injected(AgendaProjection, [Agenda]);
injected(AttendanceHistoryProjection, [AttendanceHistory]);
injected(PractitionersProjection, [PractitionerDirectory]);
