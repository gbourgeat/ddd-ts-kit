/**
 * What `wire` registers: the kind whose templates say it, and the line it needs in the same module
 * file, when it has one, such as the constant of a repository a hand-wired handler is given; the
 * registration then goes to the module file of the context that already holds that line.
 */
export interface Registration {
  readonly kind: string;
  readonly holding?: string;
}
