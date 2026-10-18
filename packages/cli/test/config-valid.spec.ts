import { describe, expect, it } from 'vitest';
import { projectWith, reported } from './rules-support.js';

describe('config/valid on the contexts and the rules a team wrote', () => {
  it('reports a context upstream of itself, an unknown relationship, a missing classification and folder, and unknown severities', () => {
    const root = projectWith(
      { 'src/contexts/billing/README.md': 'Billing.\n' },
      {
        contexts: {
          billing: {
            classification: 'core',
            upstreams: [
              { context: 'billing', relationship: 'conformist' },
              { context: 'shipping', relationship: 'friendship' },
            ],
          },
          shipping: { upstreams: [] },
        },
        rules: {
          'clean/blank-lines': 'loud',
          'clean/no-hash-private': { severity: 'quiet', files: ['src/**'] },
        },
      },
    );

    expect(reported(root, 'config/valid').map(({ message }) => message)).toEqual([
      'The context "billing" lists itself as an upstream.',
      'The context "shipping" has the classification "".',
      'The context "shipping" is declared but src/contexts/shipping does not exist.',
      'The relationship "friendship" between "billing" and "shipping" is unknown.',
      'The rule "clean/blank-lines" has the severity "loud".',
      'The rule "clean/no-hash-private" has the severity "quiet".',
    ]);
  });
});
