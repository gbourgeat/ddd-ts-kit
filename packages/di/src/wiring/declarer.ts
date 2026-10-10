/** The class whose decorator made a binding, and the file discovery loaded it from. */
export interface Declarer {
  readonly className: string;
  readonly file?: string;
}
