import type { Config } from '../config/index.js';
import { readTemplate } from '../templating/index.js';
import type { Workspace } from '../workspace/index.js';
import { PROFILE_HOOKS } from './profile-hooks.js';

/** Under the regulated profile, the two hooks of `.claude/hooks/`, written once for the team to own. */
export function writeProfileHooks(ws: Workspace, config: Config): void {
  if (config.agents.profile !== 'regulated') {
    return;
  }

  for (const hook of PROFILE_HOOKS) {
    ws.create(hook.file, readTemplate(hook.template));
  }
}
