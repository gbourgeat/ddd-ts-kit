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

describe('config/valid on the profile of the agents', () => {
  const aboutProfile = (root: string): string[] =>
    reported(root, 'config/valid')
      .map(({ message }) => message)
      .filter((message) => message.includes('agents.profile'));

  it('reports a profile init does not write, and accepts the regulated one or none', () => {
    expect(aboutProfile(projectWith({}, { agents: { profile: 'lax' } }))).toEqual(['"agents.profile" is "lax".']);
    expect(aboutProfile(projectWith({}, { agents: { profile: 'none' } }))).toEqual(['"agents.profile" is "none".']);
    expect(aboutProfile(projectWith({}, { agents: { profile: 'regulated' } }))).toEqual([]);
    expect(aboutProfile(projectWith({}, {}))).toEqual([]);
  });
});
