/** One thing a project lacks, or writes otherwise, compared with what this version of the kit writes. */
export interface DoctorFinding {
  readonly area: 'script' | 'package' | 'permission' | 'hook';
  readonly name: string;
  /** `not installed`: a git hook this clone lacks, a state of the clone rather than of the project. */
  readonly problem: 'missing' | 'other version' | 'written otherwise' | 'not installed';
  /** What this version writes. */
  readonly expected: string;
  /** What the project has, when it has something. */
  readonly found?: string;
}
