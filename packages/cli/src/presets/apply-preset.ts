import { CONFIG_FILE, parseConfig, type Config } from '../config';
import { CliError } from '../cli-error';
import type { KindFlags } from '../generate/kind';
import { learnTerms } from '../generate/learn-terms';
import type { Scope } from '../generate/scope';
import { vars } from '../generate/vars';
import { parseContextName } from '../naming';
import type { RenderContext } from '../templating';
import { renderTemplate } from '../templating';
import type { Workspace } from '../workspace';
import { applyWiring } from '../generate/apply-wiring';
import { platformPath } from '../generate/platform-path';
import { grantToSignedIn } from './grant-to-signed-in';
import { layOutPrismaModels } from './lay-out-prisma-models';
import { NO_FLAGS } from './no-flags';
import { organisationsAsTenants } from './organisations-as-tenants';
import type { PresetFile } from './preset-file';
import type { Preset } from './preset';
import { presetDecision } from './preset-decision';

/** The context a preset is written into, which `generate context` or `init` declared just before. */
export interface PresetRequest {
  readonly context: string;
  readonly preset: Preset;
}

/**
 * Writes a preset into its context: its glossary, its files, then the generators that wire them
 * (the storage of the platform, the published language, the registries), then the files those
 * generators keep adding to, laid out whole. A file already on disk is kept, as a generator keeps it.
 */
export function applyPreset(ws: Workspace, config: Config, request: PresetRequest): Config {
  const { preset } = request;
  const refusal = preset.refusal(config);

  if (refusal !== undefined) {
    throw new CliError(refusal.message, refusal.fix);
  }

  assertNoTwin(ws, config, request);

  const scope = scopeOf(ws, config, request);
  const adr = presetDecision(scope, preset.name);
  const rendering = { preset: preset.name, context: vars(scope, { preset: { adr, adapter: adapterOf(config) } }) };

  learnTerms(scope);

  writeFiles(
    scope,
    preset.files(config).filter((file) => file.afterSteps !== true),
    rendering,
  );

  const wired = runSteps(scope, preset);

  layOutAfterSteps({ ...scope, config: wired }, preset, rendering);

  describeContext(scope, preset, rendering);

  return wired;
}

/** What the generators started and the preset lays out whole: its files of after the steps, its policies in the explicit style, its models on Prisma. */
function layOutAfterSteps(scope: Scope, preset: Preset, rendering: Rendering): void {
  const render = (template: string): string => renderTemplate(`presets/${preset.name}/${template}`, rendering.context);
  const { style, orm } = scope.config.stack;

  writeFiles(
    scope,
    preset.files(scope.config).filter((file) => file.afterSteps === true),
    rendering,
  );

  if (preset.explicitPolicies !== undefined && style === 'explicit') {
    applyWiring(
      scope.ws,
      platformPath(scope, 'auth/authorization/access-policies.ts'),
      render(preset.explicitPolicies),
    );
  }

  if (preset.prismaModels !== undefined && orm === 'prisma') {
    layOutPrismaModels(scope.ws, render(preset.prismaModels));
  }
}

/** One context of each preset kind: two would declare the same facts, routes and platform files, and could not live together. */
function assertNoTwin(ws: Workspace, config: Config, { context, preset }: PresetRequest): void {
  const own = parseContextName(context).kebab;
  const holds = (other: string) => ws.read(`${config.contextsDir}/${other}/${preset.signature}`) !== undefined;
  const twin = Object.keys(config.contexts).find((other) => other !== own && holds(other));

  if (twin !== undefined) {
    throw new CliError(
      `The context ${twin} is written from the ${preset.name} preset already: a project holds one context of each preset.`,
      `Extend ${twin} instead (its CONTEXT.md says how it is designed), or generate ${own} empty and build it with the generators.`,
    );
  }
}

interface Rendering {
  readonly preset: string;
  readonly context: RenderContext;
}

/** The purpose, the classification and the design of the context, in place of what its CONTEXT.md leaves to write. */
function describeContext(scope: Scope, preset: Preset, rendering: Rendering): void {
  const file = `${scope.dir}/CONTEXT.md`;
  const design = renderTemplate(`presets/${rendering.preset}/design.md.tpl`, rendering.context);

  const text = (scope.ws.read(file) ?? '')
    .replace(/## Purpose\n\n[\s\S]*?\n\n## Classification/, `## Purpose\n\n${preset.purpose}\n\n## Classification`)
    .replace(/TODO\(domain\): say in one sentence why this context is [a-z]+\./, preset.classificationReason)
    .replace(/TODO\(domain\): define the ubiquitous language first[^\n]*\n\n/, '')
    .replace('## Aggregates', `${design}## Aggregates`);

  scope.ws.update(file, text);
}

/** How the generator names the adapters of an ORM whose name is not one word: `TypeOrmAccountRepository` in `type-orm-account.repository.ts`. */
const ADAPTER_NAMES: Readonly<Record<string, RenderContext>> = { typeorm: { pascal: 'TypeOrm', kebab: 'type-orm' } };

/** The prefix of the adapters the persistence of the project names its classes and files by: `Prisma`, `prisma`. */
function adapterOf(config: Config): RenderContext {
  const { orm } = config.stack;

  return ADAPTER_NAMES[orm] ?? { pascal: `${orm.charAt(0).toUpperCase()}${orm.slice(1)}`, kebab: orm };
}

function scopeOf(ws: Workspace, config: Config, { context, preset }: PresetRequest): Scope {
  const name = parseContextName(context);
  const term = preset.terms.map((row) => `${row.term}=${row.meaning}`);

  return { ws, config, context: name, dir: `${config.contextsDir}/${name.kebab}`, flags: { ...NO_FLAGS, term } };
}

function writeFiles(scope: Scope, files: readonly PresetFile[], rendering: Rendering): void {
  for (const file of files) {
    const target = `${scope.dir}/${file.target.replaceAll('__context__', scope.context.kebab)}`;
    const content = renderTemplate(`presets/${rendering.preset}/${file.template}`, rendering.context);

    if (scope.ws.planned(target)) {
      scope.ws.update(target, content);
    } else {
      scope.ws.create(target, content);
    }
  }
}

/** Each generator sees the config as the one before it left it; then the platform grants what the preset asks to every signed-in person, and reads its organisations as tenants. */
function runSteps(scope: Scope, preset: Preset): Config {
  const config = generated(scope, preset);

  if (preset.grantsEverySignedInPerson) {
    grantToSignedIn({ ...scope, config });
  }

  if (preset.organisationsAreTenants) {
    organisationsAsTenants({ ...scope, config });
  }

  return config;
}

function generated(scope: Scope, preset: Preset): Config {
  let config = scope.config;

  for (const step of preset.steps) {
    const own = typeof step.flags === 'function' ? step.flags(config) : step.flags;
    const flags: KindFlags = { ...NO_FLAGS, allowName: true, ...own };

    step.kind.run({ ws: scope.ws, config, args: [scope.context.kebab, ...step.args], flags });
    config = current(scope.ws) ?? config;
  }

  return config;
}

function current(ws: Workspace): Config | undefined {
  const text = ws.read(CONFIG_FILE);

  return text === undefined ? undefined : parseConfig(JSON.parse(text));
}
