/** One hook of the regulated profile: the script under `.claude/hooks/` and the tools it runs before. */
export interface ProfileHook {
  readonly name: string;
  readonly file: string;
  readonly template: string;
  readonly matcher: string;
}

/** Where the hooks of the profile live in the project; `init` writes them once, the team owns them. */
const HOOKS_DIR = '.claude/hooks';

/** The production gate on every shell command, the change reference on every write of a file. */
export const PROFILE_HOOKS: readonly ProfileHook[] = [
  {
    name: 'production-gate',
    file: `${HOOKS_DIR}/production-gate.mjs`,
    template: 'init/hooks/production-gate.mjs',
    matcher: 'Bash',
  },
  {
    name: 'change-reference',
    file: `${HOOKS_DIR}/change-reference.mjs`,
    template: 'init/hooks/change-reference.mjs',
    matcher: 'Edit|Write',
  },
];
