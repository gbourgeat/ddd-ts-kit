import { CONFIG_FILE, editConfigText, parseConfig, type Config } from '../config';
import type { Workspace } from '../workspace';

/**
 * Records `agents.profile` in the config of a project `init` runs again on: the flag applies
 * without `--force`, and nothing else of the file changes. A new config already holds it.
 */
export function recordAgentProfile(ws: Workspace, config: Config): void {
  const text = ws.read(CONFIG_FILE);

  if (text === undefined) {
    return;
  }

  try {
    if (parseConfig(JSON.parse(text)).agents.profile === config.agents.profile) {
      return;
    }
  } catch {
    return;
  }

  ws.update(
    CONFIG_FILE,
    editConfigText(text, (raw) => {
      if (config.agents.profile === undefined) {
        Reflect.deleteProperty(raw, 'agents');
      } else {
        raw['agents'] = { profile: config.agents.profile };
      }
    }),
  );
}
