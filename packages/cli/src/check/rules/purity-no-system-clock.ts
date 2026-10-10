import { definePurityRule } from '../purity/define-purity-rule.js';

export const purityNoSystemClock = definePurityRule({
  id: 'purity/no-system-clock',
  description:
    'No new Date() without argument, Date.now() or performance.now() in domain/ or application/: time comes from the Clock port.',
  code: [
    { pattern: /(?<![\w$.])new\s+Date\s*(?:\(\s*\)|(?![\s(\w$.<]))/g, what: 'new Date() without argument' },
    { pattern: /(?<![\w$.])Date\s*\.\s*now(?![\w$])/g, what: 'Date.now()' },
    { pattern: /(?<![\w$.])performance\s*\.\s*now(?![\w$])/g, what: 'performance.now()' },
  ],
  modules: [],
  fix: 'Receive the instant as a parameter in the domain, and take it from the Clock port (`this.clock.now()`) in a handler, so that a test fixes time with FixedClock.',
});
