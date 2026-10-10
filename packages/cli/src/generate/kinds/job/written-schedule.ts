import type { JobSchedule } from '../../schedule/job-schedule.js';

/** The schedule as the source of a job writes it: `{ every: '15m' }`, `{ every: 900000 }`, `{ cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' }`. */
export function writtenSchedule({ every, cron, timeZone }: JobSchedule): string {
  if (every !== undefined) return `{ every: ${/^\d+$/.test(every.trim()) ? Number(every) : `'${every.trim()}'`} }`;

  return `{ cron: '${(cron ?? '').trim().split(/\s+/).join(' ')}'${timeZone === undefined ? '' : `, timeZone: '${timeZone}'`} }`;
}
