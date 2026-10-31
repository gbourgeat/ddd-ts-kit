import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE, readConfig } from '../../config';
import type { StackOptions } from './stack-options';

const CAPITAL = /[A-Z]/g;

/**
 * `init` run again on a project keeps the stack recorded in its config: a flag that names another
 * choice than the recorded one changes nothing, and is said in a note with the command that does.
 */
export function keptFlagNotes(root: string, options: StackOptions): string[] {
  if (options.force || !fs.existsSync(path.join(root, CONFIG_FILE))) {
    return [];
  }

  const recorded: Record<string, unknown> = { ...readConfig(root).config.stack };

  return Object.entries(options).flatMap(([key, value]) => {
    if (typeof value !== 'string' || !(key in recorded) || recorded[key] === value) {
      return [];
    }

    const flag = `--${key.replace(CAPITAL, (letter) => `-${letter.toLowerCase()}`)}`;

    return [
      `\`${flag} ${value}\` is kept as recorded (${String(recorded[key])}): \`npx ddd-ts-kit init --force ${flag} ${value}\` changes it.`,
    ];
  });
}
