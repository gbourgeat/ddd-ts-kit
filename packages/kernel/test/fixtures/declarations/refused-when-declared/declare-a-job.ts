import { Scheduled } from '../../../../src/declarations.js';

export function declareAJob(name: `${string}.${string}`, cron: string, timeZone: string): void {
  Scheduled(name, { cron, timeZone });
}
