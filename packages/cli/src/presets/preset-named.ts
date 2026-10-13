import { CliError } from '../cli-error.js';
import { identityPreset } from './identity-preset.js';
import type { Preset } from './preset.js';

/** Every preset of the kit, by name. */
const PRESETS: readonly Preset[] = [identityPreset];

export function presetNamed(name: string): Preset {
  const found = PRESETS.find((preset) => preset.name === name);

  if (found === undefined) {
    throw new CliError(
      `Unknown preset "${name}".`,
      `Use one of: ${PRESETS.map((preset) => preset.name).join(', ')}; any other context starts empty.`,
    );
  }

  return found;
}
