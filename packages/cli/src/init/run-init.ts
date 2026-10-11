import path from 'node:path';
import { CONFIG_FILE, restackConfigText, serializeConfig, type Config } from '../config/index.js';
import { DEPCRUISE_FILE } from '../depcruise/depcruise-file.js';
import { renderCruiseFile } from '../depcruise/render-cruise-file.js';
import { writeDocs } from '../docs/write-docs.js';
import { declareContextEntries } from '../generate/kinds/declare-context-entries.js';
import { wireContext } from '../generate/kinds/wire-context.js';
import { formatJson } from '../json/format-json.js';
import { parseContextName, toName } from '../naming/index.js';
import { inDialect } from '../package-manager/in-dialect.js';
import { readTemplate, renderTemplate } from '../templating/index.js';
import { Workspace, type WorkspaceReport } from '../workspace/index.js';
import { addContext } from './add-context.js';
import { existingName } from './existing-name.js';
import { initFiles } from './files/init-files.js';
import { writeManifest } from './manifest/write-manifest.js';
import { recordNoOutbox } from './record-no-outbox.js';
import { resolveStack, type StackOptions } from './stack/resolve-stack.js';
import { templateVars } from './template-vars.js';
import { writeAgentSettings } from './write-agent-settings.js';
import { writeContracts } from './write-contracts.js';
import { writeTypeScriptConfigs } from './write-type-script-configs.js';

const KNIP_FILE = 'knip.json';

export interface InitOptions extends StackOptions {
  /** `<name>:<classification>` entries. */
  readonly contexts: readonly string[];
  readonly dryRun: boolean;
}

export function runInit(root: string, options: InitOptions): WorkspaceReport {
  const ws = new Workspace(root, options.force);
  const config = recordNoOutbox(ws, resolveStack(root, options), options.allowNoOutbox);
  const projectName = existingName(root) ?? (toName(path.basename(path.resolve(root))).kebab || 'app');

  ws.create(CONFIG_FILE, configText(ws, config));
  writeManifest(ws, { config, projectName, force: options.force });
  writeTypeScriptConfigs(ws, config);
  writeFiles(ws, config, projectName);
  ws.create(DEPCRUISE_FILE, renderCruiseFile(config));
  writeAgentSettings(ws);
  ws.create(`${config.sharedKernelDir}/.gitkeep`, '');

  if (options.force) {
    rewireContexts(ws, config);
  }

  const withContexts = addContexts(ws, config, options.contexts);

  writeDocs(ws, withContexts);
  writeContracts(ws, withContexts, projectName);

  const report = ws.commit(options.dryRun);

  if (!options.dryRun && report.created.includes('package.json')) {
    report.notes.push(inDialect('Run `npm install`, then `npm run verify`.', config.stack.packageManager));
  }

  return report;
}

/** A new project gets its config whole; one that is initialised again with --force keeps what its team wrote around the stack. */
function configText(ws: Workspace, config: Config): string {
  const recorded = ws.read(CONFIG_FILE);

  try {
    return recorded === undefined ? serializeConfig(config) : restackConfigText(recorded, config);
  } catch {
    return serializeConfig(config);
  }
}

/**
 * `--force` just rewrote the composition root, the proof that each context wires alone and the
 * registry of permissions from their templates: the contexts the config declares, which it kept,
 * are wired into them again. What another generator had added to a file of the platform (the
 * value a gateway is given, the settings of a job) is not known here, and is said.
 */
function rewireContexts(ws: Workspace, config: Config): void {
  const present = Object.entries(config.contexts).filter(([name]) => ws.exists(`${config.contextsDir}/${name}`));

  for (const [name, { classification, upstreams }] of present) {
    wireContext(ws, { config, context: parseContextName(name), request: { name, classification, upstreams } });
  }

  if (present.length > 0) {
    ws.note(
      `--force rewrote the files of the platform from their templates and wired the declared contexts again (${present.map(([name]) => name).join(', ')}). What a generator had added to one of those files besides (the value of a gateway, the settings of a job, a policy of its own) is gone: run \`npm run verify\`, and generate again what it reports missing.`,
    );
  }
}

/** The contexts asked of this run, then what every context of the project needs from the analyzers: one that is initialised again keeps its own. */
function addContexts(ws: Workspace, config: Config, entries: readonly string[]): Config {
  const withContexts = entries.reduce((current, entry) => addContext(ws, current, entry), config);

  if (Object.keys(withContexts.contexts).length > 0) {
    declareContextEntries(ws, withContexts);
  }

  ws.update(DEPCRUISE_FILE, renderCruiseFile(withContexts));

  return withContexts;
}

/** A template ending in `.tpl` is rendered; any other is copied as it is. */
function writeFiles(ws: Workspace, config: Config, projectName: string): void {
  const context = templateVars(config, projectName);

  for (const [target, template] of initFiles(config, projectName)) {
    const content = template.endsWith('.tpl') ? renderTemplate(template, context) : readTemplate(template);

    ws.create(target, target === KNIP_FILE ? laidOut(content) : content);
  }
}

/** The lists of knip.json depend on the stack: they are laid out as the formatter of the project would, whatever their length. */
function laidOut(json: string): string {
  const value: unknown = JSON.parse(json);

  return formatJson(value);
}
