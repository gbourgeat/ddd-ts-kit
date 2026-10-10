import { definePurityRule } from '../purity/define-purity-rule.js';

export const purityNoAmbientRandomness = definePurityRule({
  id: 'purity/no-ambient-randomness',
  description:
    'No Math.random, crypto.randomUUID or id library in domain/ or application/: identifiers come from the IdGenerator port.',
  code: [
    { pattern: /(?<![\w$.])Math\s*\.\s*random(?![\w$])/g, what: 'Math.random' },
    {
      pattern: /(?<![\w$])crypto\s*\.\s*(?:randomUUID|getRandomValues|randomBytes|randomInt)(?![\w$])/g,
      what: 'The random source of crypto',
    },
    { pattern: /(?<![\w$.])randomUUID\s*\(/g, what: 'randomUUID()' },
  ],
  modules: [
    'uuid',
    'nanoid',
    'ulid',
    'ulidx',
    'cuid',
    '@paralleldrive/cuid2',
    'ksuid',
    'shortid',
    'uuidv7',
    'hyperid',
    'bson',
  ],
  fix: 'Receive the identifier as a parameter in the domain, and take it from the IdGenerator port (`this.ids.next()`) in a handler, so that a test gets predictable identifiers.',
});
