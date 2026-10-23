/** What is asked of the measures. */
export interface MeasuresRequest {
  /** Stories whose first commit is on or after this day, ISO. */
  readonly since?: string;
  readonly story?: string;
  readonly byAuthor: boolean;
}
