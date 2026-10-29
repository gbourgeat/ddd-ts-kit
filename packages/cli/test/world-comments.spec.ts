import { describe, expect, it } from 'vitest';
import { isWorldComment } from '../src/generate/kinds/world/is-world-comment';

describe('the comments the generator writes about an arrangement', () => {
  it.each([
    '`pnpm exec ddd-ts-kit generate test-world billing` shortens this: the specs generated after it arrange through the world.',
    'The world of billing gives no refundRepository: `npx ddd-ts-kit generate test-world billing --force` writes it again.',
    'The world of order-fulfilment could not be read by the generator (it looks for `export function anOrderFulfilmentWorld`): this spec arranges itself.',
    'The fakes a spec hands replace those the world builds for the same port.',
  ])('recognises %s', (text) => {
    expect(isWorldComment(text)).toBe(true);
  });

  it('recognises no other comment', () => {
    expect(isWorldComment('The world of billing is fine.')).toBe(false);
    expect(isWorldComment('shortens this: the specs generated after it arrange through the world.')).toBe(false);
  });
});
