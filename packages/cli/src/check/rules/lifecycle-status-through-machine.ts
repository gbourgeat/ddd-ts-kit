import { isAggregateFile } from '../lifecycle/is-aggregate-file.js';
import { machinesImported } from '../lifecycle/machines-imported.js';
import { statusWrites } from '../lifecycle/status-writes.js';
import type { Finding } from '../model/finding.js';
import type { Project } from '../model/project.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { perFile } from '../support/per-file.js';
import { escapeRegExp } from '../text/escape-reg-exp.js';

const COPIED = /^(?:[\w$]+(?:\s*\.\s*[\w$]+)*\s*\.\s*)?status$/;

export const lifecycleStatusThroughMachine: Rule = {
  id: 'lifecycle/status-through-machine',
  description:
    'The status of an aggregate that has a state machine changes only through it: the aggregate imports domain/state-machines/<aggregate>.state-machine.ts and writes its status from machine.next(..) or machine.start(..), or copies a status already read.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => (isAggregateFile(file) ? byHand(file) : []));
  },
  acrossProject(project) {
    return perFile(project, this.id, (file) => (isAggregateFile(file) ? machineUnused(file, project) : []));
  },
};

function byHand(file: SourceFile): Finding[] {
  const machines = machinesImported(file);
  const [machine] = machines;

  if (machine === undefined) {
    return [];
  }

  const through = new RegExp(`^(?:${machines.map(escapeRegExp).join('|')})\\s*\\.\\s*(?:next|start)\\s*\\(`);

  return statusWrites(file)
    .filter(({ value }) => !through.test(value) && !COPIED.test(value))
    .map(({ line, value }) => ({
      line,
      message: `The status is written without the state machine: ${value}.`,
      fix: `Ask the machine for the next status, \`status: ${machine}.next(this.state.status, '<transition>')\`, and let it refuse a forbidden transition: the lifecycle is declared once, and the diagram of CONTEXT.md is drawn from it.`,
    }));
}

/** `domain/aggregates/appointment.aggregate.ts` and `domain/state-machines/appointment.state-machine.ts` go together. */
function machineUnused(file: SourceFile, project: Project): Finding[] {
  const machine = file.path
    .replace('/domain/aggregates/', '/domain/state-machines/')
    .replace(/\.aggregate\.ts$/, '.state-machine.ts');

  if (
    machine === file.path ||
    !project.files.some(({ path }) => path === machine) ||
    machinesImported(file).length > 0
  ) {
    return [];
  }

  return [
    {
      line: 1,
      message: `The aggregate has a state machine, ${machine}, and does not use it.`,
      fix: 'Import the machine and write the status from it (`machine.next(..)`, `machine.start(..)`): a machine nobody asks is a second, silent copy of the lifecycle.',
    },
  ];
}
