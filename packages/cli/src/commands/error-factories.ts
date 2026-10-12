import { CliError } from '../cli-error.js';
import { readConfig } from '../config/index.js';
import { formatJson } from '../json/format-json.js';
import { applyPlan } from '../refusals/apply-plan.js';
import { legacyErrors } from '../refusals/legacy-errors.js';
import { MigrationDraft } from '../refusals/migration-draft.js';
import { PLAN_FILE } from '../refusals/plan-file.js';
import { proposePlan } from '../refusals/propose-plan.js';
import { readPlan } from '../refusals/read-plan.js';
import { Workspace } from '../workspace/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';
import type { Io } from './io.js';

const MANUAL = [
  'Run the formatter, then the checks: a factory keeps the parameters and the message of its constructor.',
  'Decide which facts a client may read: none is exposed, add `.exposing(..)` in the factory of each one that may.',
  'A factory whose only parameter is a sentence (`rule: string`) still takes an ad hoc message: split it into one factory per rule when the rules are few.',
  'Assert the facts in the specs (`expectRefusal`, `thenError(code, facts)`), and delete the plan file.',
];

/**
 * Moves a project from one class per error to static factories on one error class per concept:
 * `--plan` writes the proposal to edit, `--apply` follows it.
 */
export const errorFactoriesCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    plan: { type: 'boolean', default: false },
    apply: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  });

  const ws = new Workspace(args.projectRoot, false);
  const { config } = readConfig(args.projectRoot);
  const draft = new MigrationDraft(ws);

  if (args.flag('plan') === args.flag('apply')) {
    throw new CliError(
      'error-factories needs --plan or --apply.',
      `Run \`ddd-ts-kit error-factories --plan\`, give each entry of ${PLAN_FILE} its concept, then run \`ddd-ts-kit error-factories --apply\`.`,
    );
  }

  if (args.flag('plan')) {
    draft.write(PLAN_FILE, formatJson(proposePlan(legacyErrors(ws, config), { ws, config })));
  }

  const moves = args.flag('apply') ? applyPlan({ ws, config }, readPlan(ws.read(PLAN_FILE)), draft) : [];

  const outcome = {
    dryRun: args.flag('dry-run'),
    moved: moves.map(({ move }) => `${move.className} -> ${move.conceptClass}.${move.factory}`),
    written: draft.written,
    removed: draft.removed,
    manual: [...draft.manual, ...(moves.length > 0 ? MANUAL : [])],
  };

  if (!outcome.dryRun) {
    draft.commit();
  }

  print(io, args.json, outcome);

  return 0;
};

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
