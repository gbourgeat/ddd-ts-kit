/** The stories of one author, with `--by-author` only. */
export interface AuthorMeasures {
  readonly stories: number;
  readonly closed: number;
  readonly medianLeadHours?: number;
}
