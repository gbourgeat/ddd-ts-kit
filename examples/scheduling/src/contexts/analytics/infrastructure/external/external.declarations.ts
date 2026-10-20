import { injected } from '@ddd-ts-kit/kernel/declarations';
import { InProcessAppointmentExportGateway } from '@/contexts/analytics/infrastructure/external/in-process-appointment-export.gateway';
import { AppointmentExportContract } from '@/contexts/scheduling/published-language/index';

export * from '@/contexts/analytics/infrastructure/external/in-process-appointment-export.gateway';

injected(InProcessAppointmentExportGateway, [AppointmentExportContract]);
