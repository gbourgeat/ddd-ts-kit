import type { PersonalDataRetention } from '../ports/personal-data-retention';
import type { PersonalDataPurgeReport } from './personal-data-purge-report';

/**
 * The storage limitation of the whole application: every copy purges the rows that outlived their
 * retention at `now`. A copy that fails does not stop the others, and the first failure is thrown
 * once everything ran: the next run completes it, a purge reaching nothing the second time.
 */
export async function purgeExpiredPersonalData(
  now: Date,
  retentions: readonly PersonalDataRetention[],
): Promise<PersonalDataPurgeReport> {
  const purged: Record<string, number> = {};
  const failures: unknown[] = [];

  for (const retention of retentions) {
    try {
      purged[retention.name] = await retention.purgeExpired(now);
    } catch (error) {
      purged[retention.name] = 0;
      failures.push(error);
    }
  }

  if (failures.length > 0) {
    throw failures[0];
  }

  return { purged };
}
