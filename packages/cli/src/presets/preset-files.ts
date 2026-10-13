import type { Config } from '../config/index.js';
import { listTemplates } from '../templating/index.js';
import type { PresetFile } from './preset-file.js';

/** The variant a template is written for, by the segment before its extension: `account.mapper.knex.ts.tpl`. */
const VARIANTS: Readonly<Record<string, (config: Config) => boolean>> = {
  knex: (config) => config.stack.orm === 'knex',
  drizzle: (config) => config.stack.orm === 'drizzle',
  zod: (config) => config.stack.validation === 'zod',
  'class-validator': (config) => config.stack.validation === 'class-validator',
};

const VARIANT = new RegExp(`\\.(${Object.keys(VARIANTS).join('|')})(?=\\.[a-z]+$)`);

/**
 * The files of a preset, read from `templates/presets/<name>/context/`: each template lands at the
 * same path in the context, `__context__` standing for its name, and a template of a variant only
 * in a project of that stack. The paths of `afterSteps` are written after the generators ran.
 */
export function presetFiles(preset: string, config: Config, afterSteps: readonly string[]): PresetFile[] {
  const root = `presets/${preset}/`;

  return listTemplates(`${root}context`).flatMap((template) => {
    const path = template.slice(`${root}context/`.length).replace(/\.tpl$/, '');
    const variant = VARIANT.exec(path)?.[1];

    if (variant !== undefined && !(VARIANTS[variant]?.(config) ?? false)) {
      return [];
    }

    const target = path.replace(VARIANT, '');

    return [{ template: template.slice(root.length), target, afterSteps: afterSteps.includes(target) }];
  });
}
