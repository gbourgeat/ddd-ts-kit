import { Query } from '../../../../../../../../src';
import { Public } from '../../../../../../../../src/declarations';

@Public()
export class SearchOpeningHours extends Query<readonly string[]> {}
