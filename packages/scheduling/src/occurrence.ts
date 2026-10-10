/** One occurrence to run: due by time, or asked for with `runNow`. */
export interface Occurrence {
  readonly scheduledAt: Date;
  readonly manual: boolean;
}
