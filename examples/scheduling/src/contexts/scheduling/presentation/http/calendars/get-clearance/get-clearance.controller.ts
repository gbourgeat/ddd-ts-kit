import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { GetClearanceQuery } from '@/contexts/scheduling/application/queries/get-clearance/get-clearance.query';
import { CalendarsRoutes } from '@/contexts/scheduling/presentation/http/calendars.routes';
import { GetClearanceParams } from '@/contexts/scheduling/presentation/http/calendars/get-clearance/get-clearance.params';
import { GetClearanceAnswer } from '@/contexts/scheduling/presentation/http/calendars/get-clearance/get-clearance.answer';

const params = classSchema(GetClearanceParams);
const answer = classSchema(GetClearanceAnswer);

@Controller({
  group: CalendarsRoutes,
  method: 'GET',
  path: '/:calendarId/clearances/:clearanceId',
  summary: 'Get clearance',
  params,
  response: { status: 200, description: 'How far the clearance went.', body: answer },
  errors: ['UNKNOWN_CLEARANCE'],
})
export class GetClearanceController {
  constructor(private readonly queries: QueryBus) {}

  async handle(request: HttpRequest<{ params: GetClearanceParams }>): Promise<GetClearanceAnswer> {
    const { calendarId, clearanceId } = request.params;

    return this.queries.execute(new GetClearanceQuery(request.actor, calendarId, clearanceId));
  }
}
