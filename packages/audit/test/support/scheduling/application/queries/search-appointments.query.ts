import { AuthorizedQuery } from '@ddd-ts-kit/kernel';

export class SearchAppointmentsQuery extends AuthorizedQuery<readonly string[]> {}
