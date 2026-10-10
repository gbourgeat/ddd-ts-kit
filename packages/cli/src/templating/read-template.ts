import fs from 'node:fs';
import { CliError } from '../cli-error.js';
import { TEMPLATES_ROOT } from './templates-root.js';

const cache = new Map<string, string>();

export function readTemplate(name: string): string {
  const cached = cache.get(name);

  if (cached !== undefined) {
    return cached;
  }

  const content = contentOf(name);

  cache.set(name, content);

  return content;
}

function contentOf(name: string): string {
  try {
    return fs.readFileSync(`${TEMPLATES_ROOT}${name}`, 'utf8');
  } catch {
    throw new CliError(
      `Template "${name}" is missing from the package.`,
      'Reinstall ddd-ts-kit; the templates directory is part of the published files.',
    );
  }
}
