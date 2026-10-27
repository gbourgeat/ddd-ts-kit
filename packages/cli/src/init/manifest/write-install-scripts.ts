import type { Config } from '../../config';
import { formatJson } from '../../json/format-json';
import type { Workspace } from '../../workspace';
import { isRecord } from '../is-record';
import { allowBuildsBlock } from './allow-builds-block';
import { allowBuildsEntries } from './allow-builds-entries';
import { installScriptsOf, type InstallScript } from './install-scripts-of';
import { namesPackage } from './names-package';

const PNPM_WORKSPACE = 'pnpm-workspace.yaml';

/**
 * Allows the install scripts the stack needs where its package manager reads the list:
 * `allowScripts` of package.json under npm, `allowBuilds` of pnpm-workspace.yaml under pnpm. By
 * name: the version of a package is known once the install resolved its range, and npm drops an
 * entry with a range. An entry the project has for the package, a pin or a denial, is kept.
 */
export function writeInstallScripts(ws: Workspace, config: Config): void {
  const scripts = installScriptsOf(config.stack);

  if (scripts.length === 0) {
    return;
  }

  if (config.stack.packageManager === 'pnpm') {
    inPnpmWorkspace(ws, scripts);
  } else {
    inManifest(ws, scripts);
  }
}

function inManifest(ws: Workspace, scripts: readonly InstallScript[]): void {
  const manifest: unknown = JSON.parse(ws.read('package.json') ?? '{}');

  if (!isRecord(manifest)) {
    return;
  }

  const current = isRecord(manifest['allowScripts']) ? { ...manifest['allowScripts'] } : {};
  const keyed = (name: string): string[] => Object.keys(current).filter((key) => namesPackage(key, name));

  for (const script of scripts.filter(({ name }) => keyed(name).some((key) => current[key] === false))) {
    ws.note(denied('package.json denies, in `allowScripts`', script));
  }

  const missing = scripts.filter(({ name }) => keyed(name).length === 0);

  if (missing.length === 0) {
    return;
  }

  const added = Object.fromEntries(missing.map(({ name }) => [name, true]));

  ws.update('package.json', formatJson({ ...manifest, allowScripts: { ...current, ...added } }));

  ws.note(
    `package.json allows by name, in \`allowScripts\`, the install scripts the stack needs: ${listed(missing)}. npm 11 lists every other dependency with an install script as not yet reviewed (11.19 still runs it, with a warning, and says a later release blocks it): the kit needs none of them. Read them with \`npm install-scripts ls\`, then approve or deny each with \`npm install-scripts approve <package>\` or \`npm install-scripts deny <package>\`.`,
  );
}

/** The file is written by hand as well: the block is added when it has none, and what an existing one lacks is said. */
function inPnpmWorkspace(ws: Workspace, scripts: readonly InstallScript[]): void {
  const text = ws.read(PNPM_WORKSPACE) ?? '';
  const block = allowBuildsBlock(text);

  if (block !== undefined) {
    const entries = allowBuildsEntries(block);

    for (const script of scripts) {
      const own = entries.filter(({ key }) => namesPackage(key, script.name));

      if (own.length === 0) {
        ws.note(
          `${PNPM_WORKSPACE} has an \`allowBuilds\` block of its own: add \`'${script.name}': true\` to it, which the stack needs (its script ${script.does}), then run \`pnpm rebuild ${script.name}\`.`,
        );
      } else if (own.some(({ allowed }) => !allowed)) {
        ws.note(denied(`${PNPM_WORKSPACE} denies, in \`allowBuilds\``, script));
      }
    }

    return;
  }

  const lines = scripts.map(({ name }) => `  '${name}': true`);
  const written = `# The build scripts the stack needs, allowed by name: pnpm runs no other (\`pnpm ignored-builds\` lists them).\nallowBuilds:\n${lines.join('\n')}\n`;
  const content = `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${written}`;

  if (ws.exists(PNPM_WORKSPACE)) {
    ws.update(PNPM_WORKSPACE, content);
  } else {
    ws.create(PNPM_WORKSPACE, content);
  }

  ws.note(
    `${PNPM_WORKSPACE} allows by name, in \`allowBuilds\`, the build scripts the stack needs: ${listed(scripts)}. pnpm runs the script of no other dependency, and the kit needs none of those: \`pnpm ignored-builds\` lists the ones it skipped.`,
  );
}

function listed(scripts: readonly InstallScript[]): string {
  return scripts.map(({ name, does }) => `${name}, whose script ${does}`).join('; ');
}

function denied(where: string, { name, does }: InstallScript): string {
  return `${where}, the install script of ${name}, which the stack needs: its script ${does}. The entry is kept as the project wrote it.`;
}
