import { describe, expect, it } from '{{tests.module}}';
import { givenProcess } from '@ddd-ts-kit/testing';
import { {{name.pascal}}Process } from '{{alias.context}}/application/processes/{{name.kebab}}.process{{alias.ext}}';

const deadline = new Date('2026-03-01T12:00:00.000Z');
const process = new {{name.pascal}}Process();
const waiting = { id: '{{name.kebab}}-1', deadline: deadline.toISOString() };

describe('{{name.title}}', () => {
  it('starts and waits until its deadline', () => {
    givenProcess<typeof waiting>(undefined)
      .when((current) => process.started('{{name.kebab}}-1', deadline, current))
      .thenState(waiting)
      .thenTimeouts([{ name: 'deadline', at: deadline }])
      .thenCommands([]);
  });

  it('does not start twice', () => {
    givenProcess(waiting)
      .when((current) => process.started('{{name.kebab}}-1', deadline, current))
      .thenIgnored();
  });

  it('ends in time and disarms its deadline', () => {
    givenProcess(waiting)
      .when((current) => process.completed(current))
      .thenCancelled(['deadline'])
      .thenEnded();
  });

  it('ends at its deadline', () => {
    givenProcess(waiting)
      .when((current) => (current === undefined ? undefined : process.timedOut('deadline', current)))
      .thenEnded();
  });

  it('recognises the state it saved', () => {
    expect({{name.pascal}}Process.isState(waiting)).toBe(true);
    expect({{name.pascal}}Process.isState({ id: 'unknown-1' })).toBe(false);
  });

  // TODO(domain): one case per step, and the commands a missed deadline sends.
  it.todo('sends the command that answers a missed deadline');
});
