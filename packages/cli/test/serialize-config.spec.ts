import { describe, expect, it } from 'vitest';
import { parseConfig, serializeConfig } from '../src/config';

function rewritten(raw: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(serializeConfig(parseConfig(raw))) as Record<string, unknown>;
}

describe('the config written back to disk', () => {
  it('keeps the extra directories of a context, the files allowed several declarations and the allowed names', () => {
    const allowance = { file: 'src/platform/http/routes.ts', reason: 'one table of routes' };

    const written = rewritten({
      contexts: {
        billing: { classification: 'core', upstreams: [], extraDirectories: ['src/legacy/billing'], deployable: true },
      },
      onePerFile: { allow: [allowance] },
      businessNames: { allow: ['Manager'] },
    });

    expect(written['contexts']).toEqual({
      billing: { classification: 'core', upstreams: [], extraDirectories: ['src/legacy/billing'], deployable: true },
    });

    expect(written['onePerFile']).toEqual({ allow: [allowance] });
    expect(written['businessNames']).toEqual({ allow: ['Manager'] });
  });

  it('keeps who may use the client of the contract, and leaves out what the defaults already say', () => {
    expect(rewritten({ sdk: { name: 'shop-client', access: 'restricted' } })['sdk']).toEqual({
      name: 'shop-client',
      access: 'restricted',
    });

    expect(rewritten({ sdk: { name: 'shop-client' } })['sdk']).toEqual({ name: 'shop-client' });
    expect(rewritten({ businessNames: { words: ['Data'] } })['businessNames']).toEqual({ words: ['Data'] });

    expect(rewritten({ contexts: { billing: { classification: 'core', upstreams: [] } } })).not.toHaveProperty(
      'onePerFile',
    );
  });

  it('writes formatOnWrite only when the project set it to true', () => {
    expect(rewritten({ formatOnWrite: true })['formatOnWrite']).toBe(true);
    expect(rewritten({ formatOnWrite: 'yes' })).not.toHaveProperty('formatOnWrite');
    expect(rewritten({})).not.toHaveProperty('formatOnWrite');
  });

  it('keeps the modules of a context, each with its classification when it has one of its own', () => {
    const written = rewritten({
      contexts: {
        billing: {
          classification: 'core',
          upstreams: [],
          modules: { invoices: {}, payments: { classification: 'supporting' } },
        },
      },
    });

    expect(written['contexts']).toEqual({
      billing: {
        classification: 'core',
        upstreams: [],
        modules: { invoices: {}, payments: { classification: 'supporting' } },
      },
    });
  });

  it('keeps the vocabulary and the allowed names of the privacy rules, and leaves out an empty list', () => {
    expect(rewritten({ privacy: { vocabulary: ['Patient'], allow: ['Ssn'] } })['privacy']).toEqual({
      vocabulary: ['Patient'],
      allow: ['Ssn'],
    });

    expect(rewritten({ privacy: { vocabulary: ['Patient'] } })['privacy']).toEqual({ vocabulary: ['Patient'] });
    expect(rewritten({ privacy: { allow: ['Ssn'] } })['privacy']).toEqual({ allow: ['Ssn'] });
    expect(rewritten({ privacy: {} })).not.toHaveProperty('privacy');
  });
});
