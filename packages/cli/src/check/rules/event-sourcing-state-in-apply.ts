import { eventSourcedClasses } from '../event-sourcing/event-sourced-classes.js';
import { isApplyMethod } from '../event-sourcing/is-apply-method.js';
import { stateWrites } from '../event-sourcing/state-writes.js';
import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import type { ClassShape } from '../structure/class-shape.js';
import type { MethodShape } from '../structure/method-shape.js';
import { perFile } from '../support/per-file.js';

const RECORD = /(?<![\w$.])this\s*\.\s*record\s*\(/g;

const COMMAND_FIX =
  'Decide in the command, then `this.record(new <Fact>(...))`: the state changes in the apply method `appliers()` names for that event, `apply<Fact>(event)`, the only place that writes it, so a replay rebuilds exactly what the command produced.';

const APPLY_FIX =
  'An apply method only changes the state from the event it is given: recording an event there records it again at every replay. Record the follow-up fact from the command that decided it.';

export const eventSourcingStateInApply: Rule = {
  id: 'event-sourcing/state-in-apply',
  description:
    'An event-sourced aggregate changes its state only in its apply methods (`apply<Fact>`, and `restore` for a snapshot), and an apply method records no event.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) =>
      eventSourcedClasses(file).flatMap((shape) => shape.methods.flatMap((method) => judged(file, shape, method))),
    );
  },
};

function judged(file: SourceFile, shape: ClassShape, method: MethodShape): Finding[] {
  if (method.isConstructor || method.isStatic) {
    return [];
  }

  const { code } = file.scan;

  if (isApplyMethod(method.name)) {
    return [...code.slice(method.bodyStart, method.end).matchAll(RECORD)].map((match) => ({
      line: file.scan.lineAt(method.bodyStart + match.index),
      message: `The apply method ${method.name} of ${shape.name} records an event.`,
      fix: APPLY_FIX,
    }));
  }

  return stateWrites(code, method.bodyStart, method.end).map((offset) => ({
    line: file.scan.lineAt(offset),
    message: `${method.name} of the event-sourced aggregate ${shape.name} changes its state outside an apply method.`,
    fix: COMMAND_FIX,
  }));
}
