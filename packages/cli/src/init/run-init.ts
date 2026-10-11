import path from 'node:path';
import { CONFIG_FILE, serializeConfig, type Config } from '../config/index.js';
import { DEPCRUISE_FILE } from '../depcruise/depcruise-file.js';
import { renderCruiseFile } from '../depcruise/render-cruise-file.js';
import { writeDocs } from '../docs/write-docs.js';
import { toName } from '../naming/index.js';
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
import { writeTypeScriptConfigs } from './write-type-script-configs.js';

export interface InitOptions extends StackOptions {
  /** `<name>:<classification>` entries. */
  readonly contexts: readonly string[];
  readonly dryRun: boolean;
}

export function runInit(root: string, options: InitOptions): WorkspaceReport {
  const ws = new Workspace(root, options.force);
  const config = recordNoOutbox(ws, resolveStack(root, options), options.allowNoOutbox);
  const projectName = existingName(root) ?? (toName(path.basename(path.resolve(root))).kebab || 'app');

  ws.create(CONFIG_FILE, serializeConfig(config));
  writeManifest(ws, { config, projectName, force: options.force });
  writeTypeScriptConfigs(ws, config);
  writeFiles(ws, config, projectName);
  ws.create(DEPCRUISE_FILE, renderCruiseFile(config));
  writeAgentSettings(ws);
  ws.create(`${config.sharedKernelDir}/.gitkeep`, '');

  const withContexts = options.contexts.reduce((current, entry) => addContext(ws, current, entry), config);

  ws.update(DEPCRUISE_FILE, renderCruiseFile(withContexts));
  writeDocs(ws, withContexts);

  const report = ws.commit(options.dryRun);

  if (!options.dryRun && report.created.includes('package.json')) {
    report.notes.push(inDialect('Run `npm install`, then `npm run verify`.', config.stack.packageManager));
  }

  return report;
}

/** A template ending in `.tpl` is rendered; any other is copied as it is. */
function writeFiles(ws: Workspace, config: Config, projectName: string): void {
  const context = templateVars(config, projectName);

  for (const [target, template] of initFiles(config, projectName)) {
    ws.create(target, template.endsWith('.tpl') ? renderTemplate(template, context) : readTemplate(template));
  }
}
