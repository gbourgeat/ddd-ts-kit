/**
 * One thing a project lacks, or writes otherwise, compared with what this version of the kit
 * writes; or one its environment lacks to run it: `node`, `install` and `submodule` are the state
 * of one checkout, not of the project. `guidance` is a file written once for the team to own.
 */
export interface DoctorFinding {
  readonly area:
    | 'script'
    | 'package'
    | 'permission'
    | 'hook'
    | 'guidance'
    | 'folder'
    | 'node'
    | 'install'
    | 'submodule'
    | 'override';
  readonly name: string;
  /**
   * `not installed`: a git hook this clone lacks, or a package of the kit node_modules lacks.
   * `unsupported`: a running Node outside `engines.node`. `outdated`: node_modules installed
   * before the lockfile last changed. `flat`: files of the platform generated before their folders.
   * `no longer needed`: an override of a version its dependency now asks for itself.
   */
  readonly problem:
    | 'missing'
    | 'other version'
    | 'written otherwise'
    | 'not installed'
    | 'unsupported'
    | 'outdated'
    | 'not initialised'
    | 'flat'
    | 'no longer needed';
  /** What this version writes, or what the project asks of its environment. */
  readonly expected: string;
  /** What the project has, when it has something. */
  readonly found?: string;
}
