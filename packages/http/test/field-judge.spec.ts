import { describe, expect, it } from 'vitest';
import type { Actor } from '@ddd-ts-kit/kernel';
import { assertWritable } from '../src/field-access/assert-writable.js';
import type { FieldDecider } from '../src/field-access/field-decider.js';
import { FieldJudge } from '../src/field-access/field-judge.js';
import { FieldTree } from '../src/field-access/field-tree.js';
import { visibleBody } from '../src/field-access/visible-body.js';
import { isAsyncIterable } from '../src/support/is-async-iterable.js';

const actor: Actor = { id: 'ana', type: 'user', roles: [], attributes: {} };
const reads = { permission: { id: 'notes:read' } };
const writes = { permission: { id: 'notes:write' } };

/** Answers yes to `notes:read` and records every question, with the element it was about. */
function recordingDecider(asked: unknown[]): FieldDecider {
  return async ({ requirement, subject }) => {
    asked.push(subject);

    return 'permission' in requirement && requirement.permission.id === 'notes:read';
  };
}

describe('the judge of the fields of one request', () => {
  it('lets anybody see a field without a read requirement, and set one without a write requirement', async () => {
    const judge = new FieldJudge(actor, undefined);

    expect(await judge.reads({}, {})).toBe(true);
    expect(await judge.writes({}, {})).toBe(true);
    expect(await judge.writes({ read: reads }, {})).toBe(false);
  });

  it('asks once per element, an element named by a reference of its own or by any other value', async () => {
    const asked: unknown[] = [];
    const judge = new FieldJudge(actor, recordingDecider(asked));
    const rule = { read: reads, subject: (row: unknown) => row };

    await judge.reads(rule, { type: 'calendar', id: 'c1' });
    await judge.reads(rule, { type: 'calendar', id: 'c1' });
    await judge.reads(rule, { type: 'calendar', id: 2 });
    await judge.reads(rule, 'c1');
    await judge.reads(rule, 'c1');
    await judge.reads(rule, null);

    expect(asked).toEqual([{ type: 'calendar', id: 'c1' }, { type: 'calendar', id: 2 }, 'c1', null]);
  });

  it('refuses to set a field the actor may read but not write', async () => {
    const judge = new FieldJudge(actor, recordingDecider([]));
    const tree = FieldTree.of([{ path: ['note'], rule: { read: reads, write: writes } }]);

    await expect(assertWritable({ note: 'x' }, tree, judge)).rejects.toThrow('The field body.note may not be set');
    await expect(assertWritable('no object', tree, judge)).resolves.toBeUndefined();
    await expect(assertWritable({ note: 'x' }, FieldTree.of([]), judge)).resolves.toBeUndefined();
  });

  it('leaves a value that holds no object as it is', async () => {
    const tree = FieldTree.of([{ path: ['at', 'note'], rule: { read: reads } }]);
    const at = new Date(0);

    expect(await visibleBody({ at }, tree, new FieldJudge(actor, undefined))).toEqual({ at });
  });

  it('remembers a bounded number of elements: a long export with one per row asks once per row, never holds them all', async () => {
    const asked: unknown[] = [];
    const judge = new FieldJudge(actor, recordingDecider(asked));
    const tree = FieldTree.of([{ path: ['*', 'note'], rule: { read: reads, subject: (row: unknown) => row } }]);
    const rows = 10 * FieldJudge.rememberedSubjects;

    async function* exported(): AsyncIterable<{ id: number; note: string }> {
      for (let id = 0; id < rows; id += 1) {
        yield { id, note: 'n' };
      }
    }

    const visible = await visibleBody(exported(), tree, judge);
    let read = 0;

    for await (const row of isAsyncIterable(visible) ? visible : []) {
      read += row === undefined ? 0 : 1;
    }

    await judge.reads({ read: reads, subject: () => 'last' }, {});
    await judge.reads({ read: reads, subject: () => 'last' }, {});

    expect([read, asked.length]).toEqual([rows, rows + 1]);
  });

  it('asks again about an element it has forgotten, and says whether its decisions are acts to record', async () => {
    const questions: boolean[] = [];

    const decide: FieldDecider = async ({ recorded }) => {
      questions.push(recorded);

      return true;
    };

    const quiet = new FieldJudge(actor, decide);
    const rule = { read: reads, subject: (id: unknown) => id };

    for (let id = 0; id <= FieldJudge.rememberedSubjects; id += 1) {
      await quiet.reads(rule, id);
    }

    await quiet.reads(rule, 0);
    await new FieldJudge(actor, decide, true).reads(rule, 0);

    expect(questions).toHaveLength(FieldJudge.rememberedSubjects + 3);
    expect(questions.slice(-2)).toEqual([false, true]);
  });
});
