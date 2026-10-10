import { AuthorizedQuery } from '@ddd-ts-kit/kernel';

/** A query whose name does not say so. */
export class UpcomingAppointments extends AuthorizedQuery<readonly string[]> {}
