import { purityRule } from '../support/purity-rule';

export const purityNoSystemClock = purityRule({
  id: 'purity/no-system-clock',
  description:
    'No new Date() without argument, Date.now(), Date() or performance.now() in domain/ or application/: time comes from the Clock port.',
  instead:
    'Receive the instant as a parameter in the domain, and take it from the Clock port (`this.clock.now()`) in a handler, so that a test fixes time with FixedClock.',
  members: { Date: ['now'], performance: ['now', 'timeOrigin'] },
  calls: ['Date'],
  constructions: [],
  bareConstructions: ['Date'],
  modules: [],
  namedImports: {},
});

export const purityNoAmbientRandomness = purityRule({
  id: 'purity/no-ambient-randomness',
  description:
    'No Math.random, crypto.randomUUID or id library in domain/ or application/: identifiers come from the IdGenerator port.',
  instead:
    'Receive the identifier as a parameter in the domain, and take it from the IdGenerator port (`this.ids.next()`) in a handler, so that a test gets predictable identifiers.',
  members: { Math: ['random'], crypto: ['randomUUID', 'getRandomValues', 'randomBytes', 'randomInt'] },
  calls: ['randomUUID'],
  constructions: [],
  bareConstructions: [],
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
  namedImports: { crypto: ['randomUUID', 'getRandomValues', 'randomBytes', 'randomInt', 'webcrypto'] },
});

export const purityNoEnvironment = purityRule({
  id: 'purity/no-environment',
  description: 'No process.env, console, file system or network access in domain/ or application/.',
  instead:
    'Declare what is needed as a port in application/ports (a configuration value object, a logger, a gateway), implement it in infrastructure/ and bind it in the module file.',
  members: { process: ['env', 'argv', 'cwd', 'exit', 'stdout', 'stderr', 'stdin'], console: [] },
  calls: ['fetch'],
  constructions: ['XMLHttpRequest', 'WebSocket', 'EventSource'],
  bareConstructions: [],
  modules: [
    'fs',
    'http',
    'https',
    'http2',
    'net',
    'dgram',
    'dns',
    'tls',
    'child_process',
    'worker_threads',
    'os',
    'readline',
    'axios',
    'node-fetch',
    'undici',
    'got',
    'dotenv',
  ],
  namedImports: {},
});
