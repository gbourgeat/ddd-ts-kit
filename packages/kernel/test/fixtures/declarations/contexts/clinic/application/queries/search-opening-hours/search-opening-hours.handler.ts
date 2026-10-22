import { QueryHandler } from '../../../../../../../../src/declarations';
import { SearchOpeningHours } from './search-opening-hours.query';

@QueryHandler(SearchOpeningHours)
export class SearchOpeningHoursHandler implements QueryHandler<SearchOpeningHours> {
  async execute(): Promise<readonly string[]> {
    return ['09:00-18:00'];
  }
}
