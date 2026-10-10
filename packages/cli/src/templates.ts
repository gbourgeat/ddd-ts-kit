import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CliError } from './errors.js';
import { render, type RenderContext } from './render.js';

// `templates/` sits next to both `src/` (tests) and `dist/` (published package).
const TEMPLATES_ROOT = fileURLToPath(new URL('../templates/', import.meta.url));

const cache = new Map<string, string>();

export function readTemplate(name: string): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;
  let content: string;
  try {
    content = fs.readFileSync(`${TEMPLATES_ROOT}${name}`, 'utf8');
  } catch {
    throw new CliError(`Template "${name}" is missing from the package.`, 'Reinstall ddd-ts-kit; the templates directory is part of the published files.');
  }
  cache.set(name, content);
  return content;
}

export function templateExists(name: string): boolean {
  return cache.has(name) || fs.existsSync(`${TEMPLATES_ROOT}${name}`);
}

export function renderTemplate(name: string, context: RenderContext): string {
  // Dropped conditional blocks may leave runs of blank lines behind: keep one, and one final newline.
  return render(readTemplate(name), context, `templates/${name}`).replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '\n');
}

export function listTemplates(directory = ''): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(`${TEMPLATES_ROOT}${directory}`, { withFileTypes: true })) {
    const relative = directory === '' ? entry.name : `${directory}/${entry.name}`;
    if (entry.isDirectory()) found.push(...listTemplates(relative));
    else found.push(relative);
  }
  return found.sort();
}
