export interface GroupDescription {
  readonly stream: string;

  /** The consumer name. */
  readonly name: string;

  readonly startFrom: 'new' | 'beginning';
}
