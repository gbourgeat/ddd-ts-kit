import type { Config } from '../config';
import { applyPreset } from '../presets/apply-preset';
import { presetNamed } from '../presets/preset-named';
import type { Workspace } from '../workspace';

/**
 * Each preset is written into the context of its name, which `addContexts` declared. A preset is applied once: the
 * context of one already written is the team's, and `init --force` with the flags of the first init leaves it alone.
 */
export function addPresets(ws: Workspace, config: Config, names: readonly string[]): Config {
  return names.reduce((current, name) => {
    const preset = presetNamed(name);

    if (ws.exists(`${current.contextsDir}/${name}/${preset.signature}`)) {
      ws.note(
        `the ${name} preset is already applied: its context is yours, \`--force\` rewrote the platform only and did not write the preset again.`,
      );

      return current;
    }

    return applyPreset(ws, current, { context: name, preset });
  }, config);
}
