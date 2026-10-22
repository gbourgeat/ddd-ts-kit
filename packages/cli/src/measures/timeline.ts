/** The three durations of a story, each absent while its end has not happened. */
export interface Timeline {
  readonly opened?: string;
  readonly author?: string;
  readonly designHours?: number;
  readonly buildHours?: number;
  readonly leadHours?: number;
  readonly merged?: string;
}
