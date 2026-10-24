import type { Config } from '../../config';
import { formatJson } from '../../json/format-json';
import type { Workspace } from '../../workspace';
import { isRecord } from '../is-record';
import { overridesFor } from './overrides-for';

const PNPM_WORKSPACE = 'pnpm-workspace.yaml';

/**
 * Writes the overrides of the stack where its package manager reads them: `overrides` of
 * package.json under npm, `overrides` of pnpm-workspace.yaml under pnpm, which reads nothing of
 * package.json. An override the project already sets for the same package is kept, and said.
 */
export function writeOverrides(ws: Workspace, config: Config, force: boolean): void {
  const overrides = overridesFor(config);

  if (Object.keys(overrides).length === 0) {
    return;
  }

  if (config.stack.packageManager === 'pnpm') {
    inPnpmWorkspace(ws, overrides);
  } else {
    inManifest(ws, overrides, force);
  }
}

function inManifest(ws: Workspace, overrides: Record<string, string>, force: boolean): void {
  const manifest: unknown = JSON.parse(ws.read('package.json') ?? '{}');

  if (!isRecord(manifest)) {
    return;
  }

  const current = isRecord(manifest['overrides']) ? { ...manifest['overrides'] } : {};

  for (const [name, range] of Object.entries(overrides)) {
    if (current[name] === undefined || force) {
      current[name] = range;
    } else if (current[name] !== range) {
      ws.note(
        `package.json overrides ${name} with a range of its own: the kit forces ${range}, which closes a vulnerability its stack still installs.`,
      );
    }
  }

  ws.update('package.json', formatJson({ ...manifest, overrides: current }));
}

/** The file is written by hand as well: the block is added when it has none, and what an existing one lacks is said. */
function inPnpmWorkspace(ws: Workspace, overrides: Record<string, string>): void {
  const text = ws.read(PNPM_WORKSPACE) ?? '';

  if (/^overrides:/m.test(text)) {
    for (const [name, range] of Object.entries(overrides)) {
      if (!new RegExp(`^\\s+['"]?${name}['"]?:`, 'm').test(text)) {
        ws.note(
          `${PNPM_WORKSPACE} has overrides of its own: add \`${name}: '${range}'\` to them, which closes a vulnerability the stack still installs.`,
        );
      }
    }

    return;
  }

  const lines = Object.entries(overrides).map(([name, range]) => `  ${name}: '${range}'`);
  const block = `# Versions forced under a dependency that pins one below a security fix, until it asks for the fixed one itself.\noverrides:\n${lines.join('\n')}\n`;
  const content = `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${block}`;

  if (ws.exists(PNPM_WORKSPACE)) {
    ws.update(PNPM_WORKSPACE, content);
  } else {
    ws.create(PNPM_WORKSPACE, content);
  }
}
