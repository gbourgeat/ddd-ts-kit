import { hookCommand } from './hook-command.js';
import { isRecord } from './is-record.js';
import { PROFILE_HOOKS } from './profile-hooks.js';
import { registeredHookCommands } from './registered-hook-commands.js';

/** The `hooks` of the settings with the two hooks of the profile under `PreToolUse`, each added once, next to what the project registered. */
export function mergeHooks(existing: unknown): Record<string, unknown> {
  const hooks = isRecord(existing) ? existing : {};
  const preToolUse: unknown[] = Array.isArray(hooks['PreToolUse']) ? hooks['PreToolUse'] : [];
  const registered = registeredHookCommands(preToolUse);

  const missing = PROFILE_HOOKS.filter((hook) => !registered.includes(hookCommand(hook))).map((hook) => ({
    matcher: hook.matcher,
    hooks: [{ type: 'command', command: hookCommand(hook), timeout: 10 }],
  }));

  return { ...hooks, PreToolUse: [...preToolUse, ...missing] };
}
