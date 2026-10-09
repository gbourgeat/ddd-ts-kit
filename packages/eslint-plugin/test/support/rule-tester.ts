import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

export const ruleTester = new RuleTester({ linterOptions: { reportUnusedDisableDirectives: 'off' } });

export const SAMPLE_CONFIG = {
  contexts: {
    billing: { classification: 'core', upstreams: [{ context: 'catalog', relationship: 'published-language' }] },
    catalog: { classification: 'supporting', upstreams: [] },
    shipping: { classification: 'supporting', upstreams: [] },
  },
};

interface Sample {
  readonly code: string;
  readonly settings: Record<string, unknown>;
}

/** A source placed at a virtual path of a project described by `config`: nothing is read from disk. */
export function at(file: string, code: string, config: Record<string, unknown> = SAMPLE_CONFIG): Sample {
  return { code, settings: { 'ddd-ts-kit': { config, filename: file } } };
}

export const BILLING = 'src/contexts/billing';
