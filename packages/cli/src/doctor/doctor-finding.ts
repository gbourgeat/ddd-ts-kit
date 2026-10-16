/** One thing a project lacks, or writes otherwise, compared with what this version of the kit writes. */
export interface DoctorFinding {
  readonly area: 'script' | 'package' | 'permission';
  readonly name: string;
  readonly problem: 'missing' | 'other version' | 'written otherwise';
  /** What this version writes. */
  readonly expected: string;
  /** What the project has, when it has something. */
  readonly found?: string;
}
