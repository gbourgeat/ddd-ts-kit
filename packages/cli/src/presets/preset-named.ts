import { CliError } from '../cli-error';
import { identityPreset } from './identity-preset';
import type { Preset } from './preset';

/** Every preset of the kit, by name. */
export const PRESETS: readonly Preset[] = [identityPreset];

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
