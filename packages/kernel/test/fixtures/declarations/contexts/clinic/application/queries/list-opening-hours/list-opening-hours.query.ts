import { Query } from '../../../../../../../../src/index.js';
import { Public } from '../../../../../../../../src/declarations.js';

@Public()
export class ListOpeningHours extends Query<readonly string[]> {}
