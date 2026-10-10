export type ImportKind = 'import' | 'export' | 'side-effect' | 'dynamic' | 'require';

export interface ImportRecord {
  readonly kind: ImportKind;
  readonly specifier: string;
  readonly line: number;
  readonly typeOnly: boolean;
  /** Local names bound by the statement (default, named, namespace). */
  readonly names: readonly string[];
  /** The names among them bound as types only: all of them under `import type`, the ones written `type X` otherwise. */
  readonly typeNames: readonly string[];
}
