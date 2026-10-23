import { describe, expect, it } from 'vitest';
import { personalData, type StoredEventData } from '@ddd-ts-kit/kernel';
import { expectSnapshotEquivalence, givenEvents } from '../src';
import { Tally, TallyClosed, TallyClosedError, closed, counted } from './support/tally';

const rehydrate = (id: string, history: Parameters<typeof Tally.rehydrate>[1]): Tally => Tally.rehydrate(id, history);

describe('givenEvents', () => {
  it('rebuilds the aggregate from its history and asserts only what the command records', () => {
    givenEvents(rehydrate, [counted(2), counted(3)])
      .when((tally) => tally.close())
      .thenEvents([TallyClosed])
      .thenState((tally) => expect(tally.toState()).toEqual({ votes: 5, closed: true }));
  });

  it('asserts the refusal a history leads to', () => {
    givenEvents(rehydrate, [counted(1), closed()])
      .when((tally) => tally.count(4))
      .thenError(TallyClosedError);
  });

  it('starts from an empty history under the id it is given, and needs it', () => {
    givenEvents(rehydrate, [], 't9')
      .when((tally) => tally.count(1))
      .thenEvents([{ name: 'votes.tally.counted', aggregateId: 't9' }]);

    expect(() => givenEvents(rehydrate, [])).toThrow('needs the id');
  });
});

describe('expectSnapshotEquivalence', () => {
  const history = [counted(1), counted(2), closed()];

  it('passes when every snapshot rebuilds the state of the full replay', () => {
    expect(() =>
      expectSnapshotEquivalence({
        events: history,
        rehydrate,
        policy: {
          encode: (tally) => tally.toState(),
          decode: (data) => ({ votes: data.number('votes'), closed: data.flag('closed') }),
        },
        state: (tally) => tally.toState(),
      }),
    ).not.toThrow();
  });

  it('reads a personal value of a snapshot back as given, as a cipher would', () => {
    expect(() =>
      expectSnapshotEquivalence({
        events: history,
        rehydrate,
        policy: {
          encode: (tally) => ({
            votes: tally.toState().votes,
            closed: tally.toState().closed,
            by: [personalData('t1', 'Ada')],
          }),
          decode: (data) => ({
            votes: data.number('votes'),
            closed: data.flag('closed') && data.texts('by')[0] === 'Ada',
          }),
        },
        state: (tally) => tally.toState(),
      }),
    ).not.toThrow();
  });

  it('reads a nested record of a snapshot back as stored, and has nothing to prove on an empty history', () => {
    const nested = {
      events: history,
      rehydrate,
      policy: {
        encode: (tally: Tally) => ({ tally: { votes: tally.toState().votes, closed: tally.toState().closed } }),
        decode: (data: StoredEventData) => ({
          votes: data.record('tally').number('votes'),
          closed: data.record('tally').flag('closed'),
        }),
      },
      state: (tally: Tally) => tally.toState(),
    };

    expect(() => expectSnapshotEquivalence(nested)).not.toThrow();
    expect(() => expectSnapshotEquivalence({ ...nested, events: [] })).not.toThrow();
  });

  it('names the first version whose snapshot loses part of the state', () => {
    expect(() =>
      expectSnapshotEquivalence({
        events: history,
        rehydrate,
        policy: {
          encode: (tally) => ({ votes: tally.toState().votes }),
          decode: (data) => ({ votes: data.number('votes'), closed: false }),
        },
        state: (tally) => tally.toState(),
      }),
    ).toThrow('after event 3 of 3');
  });
});
