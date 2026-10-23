import path from 'node:path';
import { CONFIG_FILE, restackConfigText, serializeConfig, type Config } from '../config';
import { DEPCRUISE_FILE } from '../depcruise/depcruise-file';
import { renderCruiseFile } from '../depcruise/render-cruise-file';
import { writeDocs } from '../docs/write-docs';
import { declareContextEntries } from '../generate/kinds/declare-context-entries';
import { placeContextFiles } from '../generate/place-context-files';
import { wireContext } from '../generate/kinds/wire-context';
import { formatJson } from '../json/format-json';
import { parseContextName, toName } from '../naming';
import { ignoreCodeTypesWhereTheyAre } from '../knip';
import { inDialect } from '../package-manager/in-dialect';
import { setUpSdk } from '../sdk';
import { readTemplate, renderTemplate, type RenderContext } from '../templating';
import { VERSION } from '../version';
import { Workspace, type WorkspaceReport } from '../workspace';
import { applyPreset } from '../presets/apply-preset';
import { presetNamed } from '../presets/preset-named';
import { addContext } from './add-context';
import { existingName } from './existing-name';
import { initFiles } from './files/init-files';
import { REVIEW_POLICY } from './files/guidance-files';
import { keepFlatPlatform } from '../platform-folders';
import { ignoreWorktrees } from './ignore-worktrees';
import { writeManifest } from './manifest/write-manifest';
import { recordAgentProfile } from './record-agent-profile';
import { recordNoOutbox } from './record-no-outbox';
import { resolveStack, type StackOptions } from './stack/resolve-stack';
import { templateVars } from './template-vars';
import { writeAgentSettings } from './write-agent-settings';
import { writeProfileHooks } from './write-profile-hooks';
import { writeContracts } from './write-contracts';
import { writeCopilotInstructions } from './write-copilot-instructions';
import { writeCopilotSettings } from './write-copilot-settings';
import { writeTypeScriptConfigs } from './write-type-script-configs';
import type { Relocation } from '../platform-folders/moved-specifier';

const KNIP_FILE = 'knip.json';

/** What a new project does next: the recommended path, which the README of the project repeats. */
const NEXT_STEP =
  'Next, follow the recommended steps in order, the supported path: discover the domain, find the bounded contexts, write their glossaries and draw the context map before any code (`/ddd-ts-kit:start` in Claude Code conducts them), then declare each context with `npx ddd-ts-kit generate context`, plan the slices and build them one at a time. `npx ddd-ts-kit status` says which step is next; the steps are in README.md and at https://github.com/gbourgeat/ddd-ts-kit/blob/main/docs/guides/methodology.md.';

export interface InitOptions extends StackOptions {
  /** `<name>:<classification>` entries. */
  readonly contexts: readonly string[];
  /** Presets of the kit, each written into the context of its name (declared by the preset when no `--context` names it). */
  readonly presets?: readonly string[];
  readonly dryRun: boolean;
}

export function runInit(root: string, options: InitOptions): WorkspaceReport {
  const ws = new Workspace(root, options.force);
  const config = { ...recordNoOutbox(ws, resolveStack(root, options), options.allowNoOutbox), initVersion: VERSION };

  const projectName = existingName(root) ?? (toName(path.basename(path.resolve(root))).kebab || 'app');
  const flat = keepFlatPlatform(ws, config);

  ws.create(CONFIG_FILE, configText(ws, config));
  recordAgentProfile(ws, config);
  writeManifest(ws, { config, projectName, force: options.force });
  writeTypeScriptConfigs(ws, config);
  writeFiles(ws, { config, projectName, flat });
  ignoreWorktrees(ws);
  writeCopilotInstructions(ws);
  ws.create(DEPCRUISE_FILE, renderCruiseFile(config));
  writeAgentSettings(ws, config);
  writeProfileHooks(ws, config);
  writeCopilotSettings(ws);
  ws.create(`${config.sharedKernelDir}/.gitkeep`, '');

  if (options.force) {
    rewireContexts(ws, config);
  }

  const declared = addContexts(ws, config, [...options.contexts, ...presetContexts(config, options)]);
  const withContexts = addPresets(ws, declared, [...new Set(options.presets ?? [])]);

  writeDocs(ws, withContexts);
  writeContracts(ws, { config: withContexts, projectName, presetApplied: (options.presets ?? []).length > 0 });
  setUpSdk(ws, withContexts);

  const report = ws.commit(options.dryRun);

  if (!options.dryRun && report.created.includes('package.json')) {
    report.notes.push(inDialect('Run `npm install`, then `npm run verify`.', config.stack.packageManager));
    report.notes.push(inDialect(NEXT_STEP, config.stack.packageManager));
  }

  return report;
}

/**
 * A new project gets its config whole, its code written in worktrees only and each written file
 * laid out by the editor hook; one that is
 * initialised again with --force keeps what its team wrote around the stack. Both record the
 * version of the CLI that wrote the files.
 */
function configText(ws: Workspace, config: Config): string {
  const recorded = ws.read(CONFIG_FILE);
  const fresh = serializeConfig({ ...config, worktrees: 'required', formatOnWrite: true });

  try {
    return recorded === undefined ? fresh : restackConfigText(recorded, config);
  } catch {
    return fresh;
  }
}

/**
 * `--force` just rewrote the composition root, the proof that each context wires alone and the
 * registry of permissions from their templates: the contexts the config declares, which it kept,
 * are wired into them again. What another generator had added to a file of the platform (the
 * value a gateway is given, the settings of a job) is not known here, and is said.
 */
function rewireContexts(ws: Workspace, config: Config): void {
  // A project initialised again may keep its code lists and permission sets where 0.86 and 0.87 wrote them.
  placeContextFiles(ws, config);

  const present = Object.entries(config.contexts).filter(([name]) => ws.exists(`${config.contextsDir}/${name}`));

  for (const [name, { classification, upstreams }] of present) {
    wireContext(ws, { config, context: parseContextName(name), request: { name, classification, upstreams } });
  }

  if (present.length > 0) {
    ws.note(
      `--force rewrote the files of the platform from their templates and wired the declared contexts again (${present.map(([name]) => name).join(', ')}). What a generator had added to one of those files besides (the value of a gateway, the settings of a job, the grant of a role, a policy of its own) is gone: run \`npm run verify\`, and generate again what it reports missing.`,
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

/** The context of each preset that no `--context` and no config declares yet, under the classification of the preset. */
function presetContexts(config: Config, options: InitOptions): string[] {
  const named = new Set(options.contexts.map((entry) => entry.split(':')[0]));

  return (options.presets ?? [])
    .filter((name) => !named.has(name) && config.contexts[name] === undefined)
    .map((name) => `${name}:${presetNamed(name).classification}`);
}

/** Each preset is written into the context of its name, which `addContexts` declared. */
function addPresets(ws: Workspace, config: Config, names: readonly string[]): Config {
  return names.reduce(
    (current, name) => applyPreset(ws, current, { context: name, preset: presetNamed(name) }),
    config,
  );
}

/**
 * A template ending in `.tpl` is rendered; any other is copied as it is. A file of the platform a
 * version before the folders wrote flat is written flat again, its imports with it.
 */
function writeFiles(ws: Workspace, { config, projectName, flat }: Written): void {
  const context = templateVars(config, projectName);

  for (const [target, template] of initFiles(config, projectName)) {
    const content = template.endsWith('.tpl') ? renderTemplate(template, context) : readTemplate(template);
    const kept = flat.moved.get(target.replace(/\.ts$/, ''));

    ws.create(kept === undefined ? target : `${kept}.ts`, target === KNIP_FILE ? laidOut(content) : content);
  }

  // Initialised again, a project may keep code lists where 0.86 and 0.87 wrote them: knip is told of both places.
  ignoreCodeTypesWhereTheyAre(ws, config);

  if (flat.moved.size > 0) {
    ws.note(
      `Files of ${config.platformDir} are flat, as a version before their folders wrote them: --force rewrote them there. \`npx ddd-ts-kit platform-folders\` moves them to their folders, with every import.`,
    );
  }

  writeReviewPolicy(ws, context);
}

/** The review policy is the team's once written: created when missing, never replaced, not even with --force. */
function writeReviewPolicy(ws: Workspace, context: RenderContext): void {
  const [target, template] = REVIEW_POLICY;

  if (!ws.exists(target)) {
    ws.create(target, renderTemplate(template, context));
  }
}

interface Written {
  readonly config: Config;
  readonly projectName: string;
  readonly flat: Relocation;
}

/** The lists of knip.json depend on the stack: they are laid out as the formatter of the project would, whatever their length. */
function laidOut(json: string): string {
  const value: unknown = JSON.parse(json);

  return formatJson(value);
}
