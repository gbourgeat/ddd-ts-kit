/** An incident record of `docs/architecture/incidents/`, by what makes two of them the same incident. */
export interface IncidentRecord {
  readonly file: string;
  /** When its file was first committed; the end of time when it never was. */
  readonly at: number;
  readonly message?: string;
  readonly errorCode?: string;
}
