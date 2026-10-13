export interface BackgroundJobFacts {
  /** `<context>.<job-name>`, the static `jobName` of the class; the class when it is not a literal. */
  readonly name: string;
  readonly className: string;
  readonly file: string;
}
