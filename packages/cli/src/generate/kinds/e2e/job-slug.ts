import { toName } from '../../../naming';

/** `ShipDailyJob`, `ImportRowsBackgroundJob` and `import-rows-background-job` name the jobs `ShipDaily` and `ImportRows`. */
const ROLE_SUFFIX = /(?:[-_]?background)?[-_]?job$/i;

/** A job as a file name carries it, from its class or from what a person calls it: `ship-daily` of `ShipDailyJob`, `import-rows` of `ImportRowsBackgroundJob`. */
export function jobSlug(className: string): string {
  return toName(className.replace(ROLE_SUFFIX, '')).kebab;
}
