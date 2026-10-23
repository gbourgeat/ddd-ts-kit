// The production gate of the regulated profile: a PreToolUse hook of Claude Code on the Bash tool,
// registered in .claude/settings.json by `ddd-ts-kit init --agent-profile regulated`. A command
// that names the production environment of the project with a release action is blocked (exit 2,
// the reason to the agent) unless RELEASE_APPROVAL names who approved the release and the change
// it belongs to. Owned by the team: edit the lists below to your environments and actions.
import { readFileSync } from 'node:fs';
import process from 'node:process';

// The words that name the production environment in a command, as a whole word, in any case.
const PRODUCTION_ENVIRONMENTS = ['production'];
// The actions a release makes: a command that carries one of them with one of the words above is gated.
const RELEASE_ACTIONS = ['deploy', 'migrate', 'rollback'];
// Where the release checklist of the team is, named in the refusal.
const RELEASE_CHECKLIST = 'the release checklist of the team';
// `RELEASE_APPROVAL="<approver> <change id>"`: who approved, and the change (a ticket, a story) it belongs to.
const APPROVAL = /^\s*([^\s:]+)[\s:]+(\S+)\s*$/;

const words = (listed, variable) =>
  (process.env[variable] ?? '')
    .split(',')
    .map((word) => word.trim())
    .filter((word) => word !== '')
    .concat(listed);

function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return undefined;
  }
}

function named(command, list) {
  return list.find((word) => new RegExp(`(^|[^\\w-])${word}([^\\w-]|$)`, 'i').test(command));
}

const input = readInput();

if (input === undefined || input.tool_name !== 'Bash' || typeof input.tool_input?.command !== 'string') {
  process.exit(0);
}

const command = input.tool_input.command;
const environment = named(command, words(PRODUCTION_ENVIRONMENTS, 'PRODUCTION_GATE_ENVIRONMENTS'));
const action = named(command, words(RELEASE_ACTIONS, 'PRODUCTION_GATE_ACTIONS'));

if (environment === undefined || action === undefined) {
  process.exit(0);
}

const approval = APPROVAL.exec(process.env.RELEASE_APPROVAL ?? '');

if (approval !== null) {
  process.stderr.write(
    `production-gate: ${action} on ${environment} approved by ${approval[1]} for change ${approval[2]} (RELEASE_APPROVAL).\n`,
  );
  process.exit(0);
}

process.stderr.write(
  [
    `production-gate: the command names the production environment ("${environment}") with a release action ("${action}"), and no approval is set. Nothing was run.`,
    `A release of this project runs only once a person approved it after ${RELEASE_CHECKLIST}: that person sets RELEASE_APPROVAL="<approver> <change id>" (who approved, and the change the release belongs to) in the environment of this session, then the command runs.`,
    'Do not set the variable yourself and do not work around the gate: report the need to the person who releases.',
  ].join('\n') + '\n',
);
process.exit(2);
