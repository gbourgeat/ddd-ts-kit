import { formatJson } from '../json/format-json';
import type { Workspace } from '../workspace';
import { isRecord } from './is-record';
import { jsonObject } from './json-object';

const COPILOT_SETTINGS = '.github/copilot/settings.json';
const MARKETPLACE = 'ddd-ts-kit';
const PLUGIN = `ddd-ts-kit@${MARKETPLACE}`;

/**
 * The plugin of the kit, declared for GitHub Copilot: its cloud agent installs it from this file,
 * the Copilot CLI and VS Code recommend it. A project that has the file keeps what it holds and
 * gains the two entries it lacks.
 */
export function writeCopilotSettings(ws: Workspace): void {
  const existing = ws.read(COPILOT_SETTINGS);
  const settings = existing === undefined ? {} : jsonObject(existing);

  if (settings === undefined) {
    ws.note(`${COPILOT_SETTINGS} is not a JSON object: it was left as it is.`);

    return;
  }

  const marketplaces = isRecord(settings['extraKnownMarketplaces']) ? settings['extraKnownMarketplaces'] : {};
  const plugins = isRecord(settings['enabledPlugins']) ? settings['enabledPlugins'] : {};

  const declared = {
    ...settings,
    extraKnownMarketplaces: {
      ...marketplaces,
      [MARKETPLACE]: marketplaces[MARKETPLACE] ?? { source: { source: 'github', repo: 'gbourgeat/ddd-ts-kit' } },
    },
    enabledPlugins: { ...plugins, [PLUGIN]: plugins[PLUGIN] ?? true },
  };

  if (existing === undefined) {
    ws.create(COPILOT_SETTINGS, formatJson(declared));
  } else {
    ws.update(COPILOT_SETTINGS, formatJson(declared));
  }
}
