import { CliError } from '../cli-error';
import { readConfig, type Config } from '../config';
import { formatJson } from '../json/format-json';
import { applyNamedPlan } from '../refusals/apply-named-plan';
import { applyPlan } from '../refusals/apply-plan';
import { conceptErrors } from '../refusals/concept-errors';
import { legacyErrors } from '../refusals/legacy-errors';
import { MIGRATION_TARGETS } from '../refusals/migration-targets';
import { MigrationDraft } from '../refusals/migration-draft';
import { PLAN_FILE } from '../refusals/plan-file';
import { planTarget } from '../refusals/plan-target';
import { proposeNamedPlan } from '../refusals/propose-named-plan';
import { proposePlan } from '../refusals/propose-plan';
import { readNamedPlan } from '../refusals/read-named-plan';
import { readPlan } from '../refusals/read-plan';
import { undefinedWords } from '../refusals/undefined-words';
import { Workspace } from '../workspace';
import { Arguments } from './arguments';
import type { Command } from './command';
import type { Io } from './io';

type Target = (typeof MIGRATION_TARGETS)[number];

const MANUAL: Record<Target, readonly string[]> = {
  named: [
    'Run the formatter, then the checks: each class reads its code from the codes.ts of its context (errors/code-listed), each factory keeps the parameters, the message and the facts it had.',
    'Decide which facts a client may read where no factory exposes any yet: add `.exposing(..)` in the factory of each one that may.',
    'Assert the facts in the specs (`expectRefusal`, `thenError(code, facts)`), and delete the plan file.',
  ],
  factories: [
    'Run the formatter, then the checks: a factory keeps the parameters and the message of its constructor.',
    'Decide which facts a client may read: none is exposed, add `.exposing(..)` in the factory of each one that may.',
    'A factory whose only parameter is a sentence (`rule: string`) still takes an ad hoc message: split it into one factory per rule when the rules are few.',
    'Assert the facts in the specs (`expectRefusal`, `thenError(code, facts)`), and delete the plan file.',
  ],
};

/**
 * Moves the refusals of a project to one class per refusal, from classes per error or from error
 * classes per concept (`--to named`, the default), or from classes per error to static factories
 * on one error class per concept (`--to factories`): `--plan` writes the proposal to edit,
 * `--apply` follows it.
 */
export const errorFactoriesCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    plan: { type: 'boolean', default: false },
    apply: { type: 'boolean', default: false },
    to: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  });

  const ws = new Workspace(args.projectRoot, false);
  const { config } = readConfig(args.projectRoot);
  const draft = new MigrationDraft(ws);
  const asked = askedTarget(args.text('to'));

  if (args.flag('plan') === args.flag('apply')) {
    throw new CliError(
      'error-factories needs --plan or --apply.',
      `Run \`ddd-ts-kit error-factories --plan\`, check the names each entry of ${PLAN_FILE} proposes, then run \`ddd-ts-kit error-factories --apply\`.`,
    );
  }

  const target = args.flag('plan') ? (asked ?? 'named') : followed(planTarget(ws.read(PLAN_FILE)), asked);

  if (args.flag('plan')) {
    draft.write(PLAN_FILE, formatJson(proposal({ ws, config }, target, draft)));
  }

  const moved = args.flag('apply') ? applied({ ws, config }, target, draft) : [];

  report(io, { json: args.json, dryRun: args.flag('dry-run') }, { draft, moved: { target, moves: moved } });

  return 0;
};

interface Done {
  readonly draft: MigrationDraft;
  readonly moved: { readonly target: Target; readonly moves: readonly string[] };
}

/** Commits the draft unless it is a dry run, and prints what was moved, written, removed and left to a person. */
function report(io: Io, output: { json: boolean; dryRun: boolean }, { draft, moved }: Done): void {
  const outcome = {
    dryRun: output.dryRun,
    moved: moved.moves,
    written: draft.written,
    removed: draft.removed,
    manual: [...draft.manual, ...(moved.moves.length > 0 ? MANUAL[moved.target] : [])],
  };

  if (!outcome.dryRun) {
    draft.commit();
  }

  print(io, output.json, outcome);
}

interface Tree {
  readonly ws: Workspace;
  readonly config: Config;
}

function askedTarget(text: string | undefined): Target | undefined {
  const target = MIGRATION_TARGETS.find((candidate) => candidate === text);

  if (text !== undefined && target === undefined) {
    throw new CliError(
      `"${text}" is not a form error-factories moves a project to.`,
      `Use --to ${MIGRATION_TARGETS.join(' or --to ')}.`,
    );
  }

  return target;
}

/** `--apply` follows the form the plan was written for; one asked otherwise is refused. */
function followed(planned: Target, asked: Target | undefined): Target {
  if (asked !== undefined && asked !== planned) {
    throw new CliError(
      `${PLAN_FILE} moves the project to "${planned}", not to "${asked}".`,
      `Run \`ddd-ts-kit error-factories --plan --to ${asked}\` to write the plan again.`,
    );
  }

  return planned;
}

/** The plan to write; under the named form, each proposed class the glossary does not speak is left to a person. */
function proposal(tree: Tree, target: Target, draft: MigrationDraft): object {
  const legacy = legacyErrors(tree.ws, tree.config);

  if (target !== 'named') {
    return { to: 'factories', ...proposePlan(legacy, tree) };
  }

  const plan = proposeNamedPlan({ legacy, concepts: conceptErrors(tree.ws, tree.config) }, tree);

  const classes = Object.entries(plan.contexts).flatMap(([context, entries]) =>
    entries.map((entry) => ({ context, className: entry.class })),
  );

  draft.manual.push(...undefinedWords(classes, tree.config, draft));

  return plan;
}

function applied(tree: Tree, target: Target, draft: MigrationDraft): string[] {
  const text = tree.ws.read(PLAN_FILE);

  if (target === 'named') {
    const moves = applyNamedPlan(tree, readNamedPlan(text), draft);

    draft.manual.push(...undefinedWords(moves, tree.config, draft));

    return moves.map((move) => `${move.from} -> ${move.className}.${move.factory}`);
  }

  return applyPlan(tree, readPlan(text), draft).map(
    ({ move }) => `${move.className} -> ${move.conceptClass}.${move.factory}`,
  );
}

interface Outcome {
  readonly dryRun: boolean;
  readonly moved: readonly string[];
  readonly written: readonly string[];
  readonly removed: readonly string[];
  readonly manual: readonly string[];
}

function print(io: Io, json: boolean, outcome: Outcome): void {
  if (json) {
    io.out(JSON.stringify(outcome, null, 2));

    return;
  }

  const verb = (done: string): string => (outcome.dryRun ? `would ${done}` : done).padEnd(14);

  const lines = [
    ...outcome.moved.map((move) => `${verb('move')}${move}`),
    ...outcome.written.map((file) => `${verb('write')}${file}`),
    ...outcome.removed.map((file) => `${verb('remove')}${file}`),
    ...(outcome.manual.length > 0 ? ['', 'Left to you:', ...outcome.manual.map((line) => `  - ${line}`)] : []),
  ];

  io.out(lines.length > 0 ? lines.join('\n') : 'Nothing to do.');
}
