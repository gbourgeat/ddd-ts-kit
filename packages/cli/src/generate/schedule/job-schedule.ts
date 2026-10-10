/** The schedule of a job as the flags of `generate job` give it: `--every`, or `--cron` and `--time-zone`. */
export interface JobSchedule {
  readonly every?: string;
  readonly cron?: string;
  readonly timeZone?: string;
}
