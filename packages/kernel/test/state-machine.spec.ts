import { describe, expect, it } from 'vitest';
import {
  ConceptError,
  InvalidStateMachineError,
  defineStateMachine,
  mermaidOfStateMachine,
  type ForbiddenTransition,
} from '../src';

const ParcelStatus = {
  registered: 'registered',
  shipped: 'shipped',
  delivered: 'delivered',
  'lost-in-transit': 'lost-in-transit',
} as const;

type ParcelStatus = (typeof ParcelStatus)[keyof typeof ParcelStatus];

class ParcelError extends ConceptError {
  static cannot({ from, transition }: ForbiddenTransition<string, string>) {
    return ParcelError.refusal('PARCEL_CANNOT', `A ${from} parcel cannot be ${transition}.`, { from, transition });
  }

  static unpaid() {
    return ParcelError.refusal('PARCEL_UNPAID', 'An unpaid parcel is not shipped.');
  }
}

const parcelLifecycle = defineStateMachine({
  states: Object.values(ParcelStatus),
  initial: [ParcelStatus.registered],
  transitions: {
    ship: {
      from: [ParcelStatus.registered],
      to: ParcelStatus.shipped,
      guard: ({ paid }: { readonly paid: boolean }) => (paid ? undefined : ParcelError.unpaid()),
    },
    reroute: { from: [ParcelStatus.shipped] },
    deliver: { from: [ParcelStatus.shipped], to: ParcelStatus.delivered },
    lose: { from: [ParcelStatus.shipped], to: ParcelStatus['lost-in-transit'] },
  },
  refused: ParcelError.cannot,
});

describe('a state machine', () => {
  it('answers the state a transition leads to, and keeps it for a transition that keeps it', () => {
    const shipped = parcelLifecycle.next('registered', 'ship', { paid: true });

    expect([shipped, parcelLifecycle.next(shipped, 'reroute', { paid: true })]).toEqual(['shipped', 'shipped']);
  });

  it('refuses a transition the state does not allow with the refusal of the factory, and a guard with its own', () => {
    expect(() => parcelLifecycle.next('delivered', 'deliver', { paid: true })).toThrow(
      expect.objectContaining({ code: 'PARCEL_CANNOT', facts: { from: 'delivered', transition: 'deliver' } }),
    );

    expect(() => parcelLifecycle.next('registered', 'ship', { paid: false })).toThrow(
      expect.objectContaining({ code: 'PARCEL_UNPAID' }),
    );

    expect([
      parcelLifecycle.can('registered', 'ship', { paid: false }),
      parcelLifecycle.can('shipped', 'lose', { paid: true }),
    ]).toEqual([false, true]);
  });

  it('starts only in an initial state', () => {
    expect(parcelLifecycle.start('registered')).toBe('registered');
    expect(() => parcelLifecycle.start('shipped')).toThrow(InvalidStateMachineError);
  });

  it('says what a state allows and which states are final', () => {
    expect(parcelLifecycle.allowedFrom('shipped')).toEqual(['reroute', 'deliver', 'lose']);

    expect(parcelLifecycle.describe()).toMatchObject({
      initial: ['registered'],
      final: ['delivered', 'lost-in-transit'],
    });
  });

  it('draws itself as a Mermaid state diagram', () => {
    expect(mermaidOfStateMachine(parcelLifecycle.describe())).toBe(
      [
        'stateDiagram-v2',
        '  state "lost-in-transit" as lost_in_transit',
        '  [*] --> registered',
        '  registered --> shipped: ship [guarded]',
        '  shipped --> shipped: reroute',
        '  shipped --> delivered: deliver',
        '  shipped --> lost_in_transit: lose',
        '  delivered --> [*]',
        '  lost_in_transit --> [*]',
      ].join('\n'),
    );
  });

  it('refuses with the transition error of the kernel when it names no refusal of its own', () => {
    const plain = defineStateMachine({
      states: ['open', 'closed'],
      initial: ['open'],
      transitions: { close: { from: ['open'], to: 'closed' } },
    });

    expect(() => plain.next('closed', 'close')).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN_TRANSITION', exposedFacts: { from: 'closed', transition: 'close' } }),
    );
  });

  it('is refused when it names a state it does not list', () => {
    const refused = ParcelError.cannot;

    expect(() => defineStateMachine({ states: ['a', 'a'], initial: ['a'], transitions: {}, refused })).toThrow(
      InvalidStateMachineError,
    );

    expect(() => defineStateMachine({ states: ['a'], initial: [], transitions: {}, refused })).toThrow(
      InvalidStateMachineError,
    );

    expect(() => defineStateMachine({ states: ['a'], initial: ['b' as 'a'], transitions: {}, refused })).toThrow(
      /Initial states/,
    );

    expect(() =>
      defineStateMachine({
        states: ['a'],
        initial: ['a'],
        transitions: { go: { from: ['a'], to: 'b' as 'a' } },
        refused,
      }),
    ).toThrow(/Transition "go"/);

    expect(() =>
      defineStateMachine({ states: ['a'], initial: ['a'], transitions: { go: { from: [] } }, refused }),
    ).toThrow(/Transition "go"/);
  });
});
