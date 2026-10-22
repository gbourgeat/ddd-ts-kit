import type { Name } from '../naming';

/** A use case as the authorization sees it: its message class and whether it is a command or a query. */
export interface UseCaseMessage {
  readonly name: Name;
  readonly kind: 'Command' | 'Query';
}
