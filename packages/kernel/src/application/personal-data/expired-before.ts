import type { RetentionPeriod } from './retention-period';

/** The instant before which a row has outlived its retention: `now` less the period, in calendar months and years, in UTC. */
export function expiredBefore(retention: RetentionPeriod, now: Date): Date {
  const cutoff = new Date(now.getTime());

  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - (retention.years ?? 0));
  cutoff.setUTCMonth(cutoff.getUTCMonth() - (retention.months ?? 0));
  cutoff.setUTCDate(cutoff.getUTCDate() - (retention.days ?? 0));

  return cutoff;
}
