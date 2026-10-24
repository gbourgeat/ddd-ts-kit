import type { Config } from '../config';
import { listTemplates } from '../templating';
import type { PresetFile } from './preset-file';

/**
 * The variants a template is written for, by the segments before its extension:
 * `account.mapper.knex.ts.tpl`, `open-organisation.accepted.class-validator.per-route.ts.tpl`,
 * `unknown-account.error.named.ts.tpl`.
 */
const VARIANTS: Readonly<Record<string, (config: Config) => boolean>> = {
  knex: (config) => config.stack.orm === 'knex',
  drizzle: (config) => config.stack.orm === 'drizzle',
  zod: (config) => config.stack.validation === 'zod',
  'class-validator': (config) => config.stack.validation === 'class-validator',
  'per-route': (config) => config.stack.schemas === 'per-route',
  shared: (config) => config.stack.schemas === 'shared',
  named: (config) => config.stack.refusals === 'named',
  factories: (config) => config.stack.refusals === 'factories',
  privacy: (config) => config.stack.privacy === 'on',
};

const NAMES = Object.keys(VARIANTS).join('|');

/** One variant segment, followed by others or by the extension only. */
const VARIANT = new RegExp(`\\.(${NAMES})(?=(?:\\.(?:${NAMES}))*\\.[a-z]+$)`, 'g');

/**
 * The files of a preset, read from `templates/presets/<name>/context/`: each template lands at the
 * same path in the context, `__context__` standing for its name, and a template of variants only
 * in a project of every one of them. The paths of `afterSteps` are written after the generators ran.
 */
export function presetFiles(preset: string, config: Config, afterSteps: readonly string[]): PresetFile[] {
  const root = `presets/${preset}/`;

  return listTemplates(`${root}context`).flatMap((template) => {
    const path = template.slice(`${root}context/`.length).replace(/\.tpl$/, '');
    const variants = [...path.matchAll(VARIANT)].map((found) => found[1] ?? '');

    if (!variants.every((variant) => VARIANTS[variant]?.(config) ?? false)) {
      return [];
    }

    const target = path.replace(VARIANT, '');

    return [{ template: template.slice(root.length), target, afterSteps: afterSteps.includes(target) }];
  });
}
