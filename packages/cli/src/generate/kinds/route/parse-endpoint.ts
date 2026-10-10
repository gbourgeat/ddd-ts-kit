import { isOneOf } from '../../../config/index.js';
import { CliError } from '../../../cli-error.js';
import type { KindFlags } from '../../kind.js';
import type { Endpoint } from './endpoint.js';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const ROUTE_PATH = /^\/$|^(\/(:[A-Za-z_][A-Za-z0-9_]*|[A-Za-z0-9._~-]+))+$/;

export function parseEndpoint(flags: KindFlags): Endpoint {
  const method = flags.method?.toUpperCase();

  if (!isOneOf(METHODS, method)) {
    throw new CliError(flags.method === undefined ? 'A route needs --method.' : `Unknown method "${flags.method}".`, `Pass --method with one of: ${METHODS.join(', ')}.`);
  }

  const { path } = flags;

  if (path === undefined || !ROUTE_PATH.test(path)) {
    throw new CliError(
      path === undefined ? 'A route needs --path.' : `"${path}" is not a valid route path.`,
      'Pass --path made of literal segments and ":name" parameters, for example /invoices/:invoiceId.',
    );
  }

  return { method, path, parameters: [...path.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1] ?? '') };
}
