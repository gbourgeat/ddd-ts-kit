import { AuthorizedCommand } from '@ddd-ts-kit/kernel';

/** A command whose name ends like a query. */
export class SaveSearchQuery extends AuthorizedCommand {}
