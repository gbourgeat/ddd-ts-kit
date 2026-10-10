import { AuthorizedQuery } from '@ddd-ts-kit/kernel';

export class ListAppointmentsQuery extends AuthorizedQuery<readonly string[]> {}
