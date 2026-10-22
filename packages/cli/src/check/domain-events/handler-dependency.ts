import type { ImportTarget } from '../model/import-target';

/** Something a domain event handler is given, with where the file that names it imports it from. */
export interface HandlerDependency {
  readonly name: string;
  readonly line: number;
  readonly target: ImportTarget;
}
