/**
 * The role an instance plays, as a binding declares it at the composition root. Tracing, the
 * dependency injection modules and the aspects all read this one list.
 */
export type DependencyKind =
  | 'repository'
  | 'gateway'
  | 'external'
  | 'use-case'
  | 'publisher'
  | 'consumer'
  | 'job';
