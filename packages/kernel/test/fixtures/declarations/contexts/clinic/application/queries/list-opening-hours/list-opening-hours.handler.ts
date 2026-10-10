import { QueryHandler } from '../../../../../../../../src/declarations.js';
import { ListOpeningHours } from './list-opening-hours.query.js';

@QueryHandler(ListOpeningHours)
export class ListOpeningHoursHandler implements QueryHandler<ListOpeningHours> {
  async execute(): Promise<readonly string[]> {
    return ['09:00-18:00'];
  }
}
