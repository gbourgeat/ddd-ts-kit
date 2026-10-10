/** One of the five fields of a cron expression: its bounds and the names it accepts in place of numbers. */
export interface CronField {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly names: readonly string[];
}
