/** How an entry of the branch differs from the base. */
export type Change = 'added' | 'changed' | 'removed';

/** An entry of the description, with how the branch changed it: the value of HEAD, or the one of the base for a removal. */
export type Changed<T> = T & { readonly change: Change };

/**
 * What a branch changes, for its reviewer, read before the diff: the description of each context
 * between the merge base and HEAD, the spec titles the branch writes, and its files in reading
 * order, those a command of the kit writes listed apart.
 */
export interface Digest {
  /** The ref given to `--base`. */
  readonly base: string;
  /** The merge base of that ref and HEAD, which the branch is compared with. */
  readonly baseCommit: string;
  readonly head: string;
  /** The branch checked out, or `HEAD` when it is detached. */
  readonly branch: string;
  /** The contexts whose description changed, by name. */
  readonly contexts: readonly ContextChanges[];
  readonly specs: readonly NewSpecTitles[];
  /** The files the branch changes and a person wrote, in reading order. */
  readonly review: readonly ReviewedFile[];
  /** The files the branch changes that a command of the kit writes, by path: regenerated, not reviewed. */
  readonly regenerated: readonly string[];
  readonly notes: readonly string[];
}

export interface ContextChanges {
  readonly name: string;
  readonly change: Change;
  readonly useCases: readonly Changed<UseCaseEntry>[];
  readonly permissions: readonly Changed<PermissionEntry>[];
  readonly routes: readonly Changed<RouteEntry>[];
  readonly publishedEvents: readonly Changed<PublishedEventEntry>[];
  readonly consumedEvents: readonly Changed<ConsumedEventEntry>[];
  readonly ports: readonly Changed<PortEntry>[];
}

export interface UseCaseEntry {
  readonly kind: 'command' | 'query';
  readonly name: string;
  readonly permission: string;
}

export interface PermissionEntry {
  /** The key of the permission in the set of its context: `invoice.issue`. */
  readonly name: string;
  /** Who holds it by name: each role of the platform (`Role.Accountant`), and `signed-in` for every signed-in person. */
  readonly grants: readonly string[];
}

export interface RouteEntry {
  readonly method: string;
  readonly path: string;
  readonly useCase: string;
  readonly permission: string;
  readonly errors: readonly string[];
}

export interface PublishedEventEntry {
  readonly type: string;
  readonly versions: readonly number[];
}

export interface ConsumedEventEntry {
  readonly type: string;
  readonly from: string;
  readonly handler: string;
}

export interface PortEntry {
  readonly name: string;
  readonly kind: string;
  readonly adapters: readonly string[];
}

/** The titles a spec file of the branch states that the base did not. */
export interface NewSpecTitles {
  readonly file: string;
  /** Those written for the project, in the order of the file. */
  readonly titles: readonly SpecTitle[];
  /** How many new titles are as a template of the kit wrote them, counted and not listed. */
  readonly generated: number;
}

export interface SpecTitle {
  readonly title: string;
  readonly state: 'stated' | 'planned' | 'aside';
}

/** Where a file is read in a review: the language and rights of a context first, the tests last. */
export type ReadingPart =
  | 'context'
  | 'domain'
  | 'application'
  | 'presentation'
  | 'infrastructure'
  | 'tests'
  | 'elsewhere';

export interface ReviewedFile {
  readonly path: string;
  readonly part: ReadingPart;
  readonly change: Change;
}
