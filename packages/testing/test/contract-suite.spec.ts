import { describe, expect, it } from 'vitest';
import { ContractSuite, type ContractRunner } from '../src/contracts';
import { CollectingRunner } from './support/collecting-runner';

/** A suite that reads its subject while it declares its tests, before any of them runs. */
class ReadingTooEarly extends ContractSuite<string> {
  protected tests(): void {
    this.it(`reads ${this.subject}`, async () => undefined);
  }
}

/** A suite whose one case waits for what it needs. */
class Waiting extends ContractSuite<string> {
  protected tests(): void {
    this.todo('waits for what it needs');
  }
}

describe('ContractSuite', () => {
  it('has a subject while a test runs, and none outside', () => {
    expect(() => new ReadingTooEarly(new CollectingRunner(), () => 'a subject').describe('too early')).toThrow(
      'The subject of a contract suite only exists while a test runs',
    );
  });

  it('declares a pending case as a todo of the runner, or as a placeholder that passes where the runner has none', async () => {
    const withTodo = new CollectingRunner();

    new Waiting(withTodo, () => 'a subject').describe('with a todo');

    expect(withTodo.pending).toEqual(['waits for what it needs']);
    expect(await withTodo.run()).toEqual({ failed: [], passed: [], messages: [] });

    const collecting = new CollectingRunner();

    const withoutTodo: ContractRunner = {
      describe: (name, suite) => collecting.describe(name, suite),
      it: (name, test) => collecting.it(name, test),
      beforeEach: (setup) => collecting.beforeEach(setup),
      expect: collecting.expect,
    };

    new Waiting(withoutTodo, () => 'a subject').describe('without a todo');

    expect(collecting.pending).toEqual([]);
    expect(await collecting.run()).toEqual({ failed: [], passed: ['waits for what it needs'], messages: [] });
  });
});
