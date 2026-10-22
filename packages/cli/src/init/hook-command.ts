import type { ProfileHook } from './profile-hooks';

/** The command of a hook, as `.claude/settings.json` registers it: run by node from the root of the project. */
export function hookCommand(hook: ProfileHook): string {
  return `node "$CLAUDE_PROJECT_DIR/${hook.file}"`;
}
