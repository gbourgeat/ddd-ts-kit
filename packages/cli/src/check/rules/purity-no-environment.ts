import { definePurityRule } from '../purity/define-purity-rule';

export const purityNoEnvironment = definePurityRule({
  id: 'purity/no-environment',
  description: 'No process.env, console, file system or network access in domain/ or application/.',
  code: [
    {
      pattern: /(?<![\w$.])process\s*\.\s*(?:env|argv|cwd|exit|stdout|stderr|stdin)(?![\w$])/g,
      what: 'The process object',
    },
    { pattern: /(?<![\w$.])console\s*\.\s*[a-zA-Z]+/g, what: 'console' },
    { pattern: /(?<![\w$.])fetch\s*\(/g, what: 'fetch()' },
    { pattern: /(?<![\w$.])new\s+(?:XMLHttpRequest|WebSocket|EventSource)(?![\w$])/g, what: 'A network client' },
  ],
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
  fix: 'Declare what is needed as a port in application/ports (an abstract class: a configuration value, a logger, a gateway), implement it in infrastructure/ and bind it at the composition root.',
});
