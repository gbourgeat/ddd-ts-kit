/** One field of a payload a consumer received wrong: the shape `@ddd-ts-kit/validation` reports. */
export interface PayloadIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}
