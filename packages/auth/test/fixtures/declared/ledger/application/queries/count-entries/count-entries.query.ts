import { Query } from '@ddd-ts-kit/kernel';
import { Public } from '@ddd-ts-kit/kernel/declarations';

@Public()
export class CountEntries extends Query<number> {}
