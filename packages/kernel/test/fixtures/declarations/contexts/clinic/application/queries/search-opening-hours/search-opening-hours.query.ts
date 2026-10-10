import { Query } from '../../../../../../../../src/index.js';
import { Public } from '../../../../../../../../src/declarations.js';

@Public()
export class SearchOpeningHours extends Query<readonly string[]> {}
