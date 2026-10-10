import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { analyticsPermissions } from '../../authorization/analytics.permissions.js';

@Requires(analyticsPermissions['occupancy.verify'], { resource: () => ({ type: 'context', id: 'analytics' }) })
export class VerifyOccupancyCommand extends AuthorizedCommand<void> {
  /** `scheduledAt`: the instant the verification is for; the days of the week before it are counted again. */
  constructor(
    actor: Actor,
    readonly scheduledAt: Date,
  ) {
    super(actor);
  }
}
