import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE, restackConfigText, serializeConfig, type Config } from '../config';
import { DEPCRUISE_FILE } from '../depcruise/depcruise-file';
import { renderCruiseFile } from '../depcruise/render-cruise-file';
import { writeDocs } from '../docs/write-docs';
import { declareContextEntries } from '../generate/kinds/declare-context-entries';
import { keptWiring } from './kept-wiring';
import type { OrphanedWiring } from './orphaned-wiring-notes';
import { rewireContexts } from './rewire-contexts';
import { stackBefore } from './stack-before';
import { wiringNotes } from './wiring-notes';
import { formatJson } from '../json/format-json';
import { toName } from '../naming';
import { ignoreCodeTypesWhereTheyAre } from '../knip';
import { inDialect } from '../package-manager/in-dialect';
import { setUpSdk } from '../sdk';
import { readTemplate, renderTemplate, type RenderContext } from '../templating';
import { VERSION } from '../version';
import { Workspace, type DiskWrites, type WorkspaceReport } from '../workspace';
import { applyPreset } from '../presets/apply-preset';
import { presetNamed } from '../presets/preset-named';
import { addContext } from './add-context';
import { existingName } from './existing-name';
import { initFiles } from './files/init-files';
import { REVIEW_POLICY } from './files/guidance-files';
import { keepFlatPlatform } from '../platform-folders';
import { ignoreWorktrees } from './ignore-worktrees';
import { isTeamFile } from './is-team-file';
import { forcedNote } from './forced-note';
import { keptCombinationNotes } from './kept-combination-notes';
import { keptOrMerged } from './kept-or-merged';
import { writeManifest } from './manifest/write-manifest';
import { dependenciesAgainstStack } from './manifest/dependencies-against-stack';
import { writeOverrides } from './manifest/write-overrides';
import { writeInstallScripts } from './manifest/write-install-scripts';
import { recordAgentProfile } from './record-agent-profile';
import { recordNoOutbox } from './record-no-outbox';
import { refuseUnprojectedRoot } from './refuse-unprojected-root';
import { resolveStack, type StackOptions } from './stack/resolve-stack';
import { templateVars } from './template-vars';
import { writeAgentSettings } from './write-agent-settings';
import { writeProfileHooks } from './write-profile-hooks';
import { writeContracts } from './write-contracts';
import { writeCopilotInstructions } from './write-copilot-instructions';
import { writeCopilotSettings } from './write-copilot-settings';
import { writeTypeScriptConfigs } from './write-type-script-configs';
import type { Relocation } from '../platform-folders/moved-specifier';
import {
  keepsSinglePrismaSchema,
  PRISMA_MAIN_SCHEMA,
  singlePrismaSchemaFound,
  singlePrismaSchemaSteps,
} from '../prisma-schema';
import { ownEntry } from '../config/values/own-entry';
import { generatedFilesNamed } from '../review';

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
  /** This very command, as the person runs it again outside the sandbox that kept files from being written. */
  readonly rerun?: string;
}

/** `disk` puts each file in place: a spec gives one that fails in the middle of a file, the way a process killed there would. */
export function runInit(root: string, options: InitOptions, disk: DiskWrites = fs): WorkspaceReport {
  refuseUnprojectedRoot(root);

  const ws = new Workspace(root, options.force, disk);
  const config = { ...recordNoOutbox(ws, resolveStack(root, options), options.allowNoOutbox), initVersion: VERSION };

  const projectName = existingName(root) ?? (toName(path.basename(path.resolve(root))).kebab || 'app');
  const flat = keepFlatPlatform(ws, config);
  const earlier = keptPrismaFiles(ws, config);

  writeConfig(ws, config);
  recordAgentProfile(ws, config);
  writeManifest(ws, { config, projectName, force: options.force });
  writeTypeScriptConfigs(ws, config);
  const orphaned = writeFiles(ws, { config, projectName, flat, force: options.force, earlier });

  ignoreWorktrees(ws);
  writeCopilotInstructions(ws);
  ws.create(DEPCRUISE_FILE, renderCruiseFile(config));
  writeAgentSettings(ws, config);
  writeProfileHooks(ws, config);
  writeCopilotSettings(ws);
  ws.create(`${config.sharedKernelDir}/.gitkeep`, '');

  const rewired = options.force ? rewireContexts(ws, config) : { contexts: [], repositories: [] };

  const declared = addContexts(ws, config, [...options.contexts, ...presetContexts(config, options)]);
  const withContexts = addPresets(ws, declared, [...new Set(options.presets ?? [])]);

  writeDocs(ws, withContexts);
  writeContracts(ws, { config: withContexts, projectName, presetApplied: (options.presets ?? []).length > 0 });
  setUpSdk(ws, withContexts);

  wiringNotes(ws, rewired, orphaned).forEach((note) => ws.note(note));

  const report = ws.commit(options.dryRun);

  report.notes.push(...keptCombinationNotes(config, flat), ...closingNotes(report, options, config));

  return report;
}

/** What the person does next: write what a sandbox kept from being written, then install and verify a new project. */
function closingNotes(report: WorkspaceReport, options: InitOptions, config: Config): string[] {
  const unwritable = report.unwritable.length > 0 ? [unwritableNote(report.unwritable, options)] : [];
  const created = !options.dryRun && report.created.includes('package.json');

  return [
    ...unwritable,
    ...(options.force ? [forcedNote(report, options.dryRun)] : []),
    ...(created
      ? [
          inDialect('Run `npm install`, then `npm run verify`.', config.stack.packageManager),
          inDialect(NEXT_STEP, config.stack.packageManager),
        ]
      : []),
  ];
}

/**
 * What a sandbox kept `init` from writing, such as `.claude/settings.json` and `.claude/hooks/`
 * that the sandbox of Claude Code protects from the agent: every other file is written, and the
 * same command run outside the sandbox adds these and keeps the ones written.
 */
function unwritableNote(files: readonly string[], options: InitOptions): string {
  const command = options.rerun ?? 'npx ddd-ts-kit init <the same flags>';
  const listed = `${files.length} file(s) ${options.dryRun ? 'cannot' : 'could not'} be written here, where a sandbox or the permissions protect them: ${files.join(', ')}.`;

  return options.dryRun
    ? `${listed} The real run would write every other file and skip these; to write them all, the owner runs it from a terminal outside the sandbox: \`${command}\`.`
    : `${listed} Every other file is written. To finish, the owner runs the same command from a terminal outside the sandbox, which writes these and keeps the files already written: \`${command}\`.`;
}

/**
 * The config of the project. An existing project initialised for the first time is told what its
 * dependencies say against the stack about to be written, a dry run included, so that the owner
 * passes the flags before anything is written; an initialised project is not read again.
 */
function writeConfig(ws: Workspace, config: Config): void {
  const manifest = ws.read(CONFIG_FILE) === undefined ? ws.read('package.json') : undefined;

  for (const line of manifest === undefined ? [] : dependenciesAgainstStack(manifest, config.stack)) {
    ws.note(line);
  }

  ws.create(CONFIG_FILE, configText(ws, config));
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
    .filter((name) => !named.has(name) && ownEntry(config.contexts, name) === undefined)
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
function writeFiles(ws: Workspace, { config, projectName, flat, force, earlier }: Written): OrphanedWiring[] {
  const context = templateVars(config, projectName);
  const rewriting: Rewriting = { config, force, earlier: stackBefore(ws.root), orphaned: [] };

  for (const [target, template] of initFiles(config, projectName).filter(([file]) => !earlier.includes(file))) {
    const content = template.endsWith('.tpl') ? renderTemplate(template, context) : readTemplate(template);
    const kept = flat.moved.get(target.replace(/\.ts$/, ''));
    const file = kept === undefined ? target : `${kept}.ts`;

    if (!(force && keptOrMerged(ws, config, { target, content }))) {
      // Without --force, a file of the team that exists is skipped as any other, and said to be the team's.
      if (isTeamFile(config, target) && ws.exists(target)) {
        ws.keep(target);
      }

      const text = withWiringKept(ws, rewriting, { target, file, content });

      ws.create(file, target === KNIP_FILE ? laidOut(text) : text);
    }
  }

  // After the files: under pnpm the overrides join the pnpm-workspace.yaml just written.
  writeOverrides(ws, config, force);
  writeInstallScripts(ws, config);

  // Initialised again, a project may keep code lists where 0.86 and 0.87 wrote them: knip is told of both places.
  ignoreCodeTypesWhereTheyAre(ws, config);

  if (flat.moved.size > 0) {
    ws.note(
      `Files of ${config.platformDir} are flat, as a version before their folders wrote them: --force rewrote them there. \`npx ddd-ts-kit platform-folders\` moves them to their folders, with every import.`,
    );
  }

  writeReviewPolicy(ws, config, context);

  return rewriting.orphaned;
}

/** What a run of `init` needs to take over what a file holds. */
interface Rewriting {
  readonly config: Config;
  readonly force: boolean;
  /** The stack the config recorded before this run. */
  readonly earlier: Config['stack'] | undefined;
  /** Filled with what a rewritten file held in a place this version no longer has. */
  readonly orphaned: OrphanedWiring[];
}

/** What a file is written with: its template and, under --force, what the file before held. */
function withWiringKept(
  ws: Workspace,
  { config, force, earlier, orphaned }: Rewriting,
  { target, file, content }: { readonly target: string; readonly file: string; readonly content: string },
): string {
  const existing = force ? ws.read(file) : undefined;

  if (existing === undefined) {
    return content;
  }

  const wiring = keptWiring(config, earlier, { target, written: content, existing });

  orphaned.push(...wiring.orphaned.map((region) => ({ ...region, file })));

  return wiring.text;
}

/**
 * The review policy is the team's once written: created when missing, never replaced, not even
 * with --force. It names the generated files from the list `digest` lists apart.
 */
function writeReviewPolicy(ws: Workspace, config: Config, context: RenderContext): void {
  const [target, template] = REVIEW_POLICY;

  if (!ws.exists(target)) {
    ws.create(
      target,
      renderTemplate(template, { ...context, review: { generatedFiles: generatedFilesNamed(config) } }),
    );
  }
}

interface Written {
  readonly config: Config;
  readonly projectName: string;
  readonly flat: Relocation;
  readonly force: boolean;
  /** Files of the stack the project keeps in an earlier layout: not written, not even with --force. */
  readonly earlier: readonly string[];
}

/**
 * A project on Prisma that keeps its schema in one file, as versions before 0.95 laid it out, keeps
 * it with the config that names it: the main file of the folder written beside it would be a second
 * generator and datasource, and would stand where the move puts the file. The move is the team's,
 * since it parts the models by context and edits files they may have changed: the steps are said.
 */
function keptPrismaFiles(ws: Workspace, config: Config): readonly string[] {
  if (config.stack.orm !== 'prisma' || !keepsSinglePrismaSchema((file) => ws.exists(file))) {
    return [];
  }

  ws.note(
    `${singlePrismaSchemaFound()} init left it, prisma.config.ts and the \`db:client\` script as they are, and wrote nothing under prisma/schema/. ${singlePrismaSchemaSteps(Object.keys(config.contexts))} Until then \`generate repository\` refuses to write a model.`,
  );

  return [PRISMA_MAIN_SCHEMA, 'prisma.config.ts'];
}

/** The lists of knip.json depend on the stack: they are laid out as the formatter of the project would, whatever their length. */
function laidOut(json: string): string {
  const value: unknown = JSON.parse(json);

  return formatJson(value);
}
