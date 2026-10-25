import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fromYaml } from '../src/yaml/from-yaml';
import { read, REPO_ROOT, write } from './helpers';
import { CLASHING_CONTRACT } from './support/clashing-contract';
import { writtenClient } from './support/written-client';

const COMPILER = path.join(REPO_ROOT, 'node_modules/@typescript/native/bin/tsc');

/** A consumer of the example's client, under the compiler options of a generated project: every narrowing it relies on. */
const CONSUMER = `import { createClient, isProblem, UnexpectedResponseError, unwrap, type ErrorCode } from 'scheduling-api-client';

const api = createClient({ baseUrl: 'http://127.0.0.1:3000', credentials: { bearer: () => 'token' } });

export async function opened(): Promise<string> {
  const result = await api.openPractice({ body: { name: 'Riverside', timeZone: 'Europe/Paris', managerId: 'ada' } });

  if (result.ok) {
    return result.data.id;
  }

  if (result.status === 404) {
    const code: 'PERSON_NOT_REGISTERED' = result.problem.code;

    return code;
  }

  return result.status === 422 && result.problem.code === 'VALIDATION_FAILED' ? (result.problem.issues?.[0]?.path ?? '') : '';
}

export async function firstStatus(): Promise<string> {
  try {
    const page = await unwrap(api.searchAppointments({ query: { 'filter[status]': 'booked', sort: ['-startsAt'], limit: 10 } }));

    return page.items[0]?.status ?? 'none';
  } catch (error) {
    if (isProblem(error, 'INVALID_CRITERIA')) {
      const code: ErrorCode = error.code;

      return code;
    }

    if (error instanceof UnexpectedResponseError) {
      const reference: string | undefined = error.requestId;

      return reference ?? String(error.status);
    }

    throw error;
  }
}

type NotFound = Extract<Awaited<ReturnType<typeof api.openPractice>>, { readonly status: 404 }>;

export const declared: NotFound['problem']['code'] = 'PERSON_NOT_REGISTERED';

// @ts-expect-error a code the operation does not declare for this status, the only error of the line
export const wrong: NotFound['problem']['code'] = 'SLOT_TAKEN';
`;

describe('the client of the example contract', () => {
  const contract = fromYaml(read(REPO_ROOT, 'examples/scheduling/openapi/openapi.yaml'));
  const root = writtenClient(contract, 'scheduling-api-client');

  it('compiles on its own, for a browser as for Node, with its declarations', () => {
    expect(compile(root, '-p', 'tsconfig.json')).toBe('');
    expect(read(root, 'dist/index.d.ts')).toContain('createClient');
  });

  it('type-checks a consumer under the options of a generated project, each refusal narrowed to its codes', () => {
    write(root, 'consumer/consumer.ts', CONSUMER);

    write(
      root,
      'consumer/tsconfig.json',
      JSON.stringify({
        compilerOptions: {
          target: 'ES2023',
          lib: ['ES2023'],
          module: 'ESNext',
          moduleResolution: 'Bundler',
          strict: true,
          noUncheckedIndexedAccess: true,
          exactOptionalPropertyTypes: true,
          noImplicitOverride: true,
          verbatimModuleSyntax: true,
          noEmit: true,
          types: ['node'],
          typeRoots: [path.join(REPO_ROOT, 'node_modules/@types')],
          paths: { 'scheduling-api-client': ['../src/index.ts'] },
        },
        include: ['consumer.ts'],
      }),
    );

    expect(compile(path.join(root, 'consumer'), '-p', 'tsconfig.json')).toBe('');
  });
});

/** A consumer of the procedures of the example, through the oRPC contract of its client. */
const RPC_CONSUMER = `import { isDefinedError, safe } from '@orpc/client';
import { createRpcClient } from 'scheduling-api-client/orpc';

const rpc = createRpcClient({ url: 'http://127.0.0.1:3000/rpc', headers: () => ({ authorization: 'Bearer token' }) });

export async function opened(): Promise<string> {
  const [error, practice] = await safe(rpc.openPractice({ body: { name: 'Riverside', timeZone: 'Europe/Paris', managerId: 'ada' } }));

  if (error === null) {
    return practice.id;
  }

  if (isDefinedError(error) && error.code === 'PERSON_NOT_REGISTERED') {
    const status: number = error.status;

    return \`\${error.data.requestId} \${String(status)}\`;
  }

  return error.message;
}

export async function refusedForAnotherSlot(): Promise<boolean> {
  const [error] = await safe(rpc.openPractice({ body: { name: 'Riverside', timeZone: 'Europe/Paris', managerId: 'ada' } }));

  // @ts-expect-error a code no refusal of the procedure carries, the only error of the line
  return isDefinedError(error) && error.code === 'SLOT_TAKEN';
}

// @ts-expect-error a procedure the API does not serve
export const missing = rpc.noSuchProcedure;
`;

describe('the oRPC contract of the client of the example', () => {
  const contract = fromYaml(read(REPO_ROOT, 'examples/scheduling/openapi/openapi.yaml'));
  const root = writtenClient(contract, 'scheduling-api-client', 'orpc');

  // The packages of oRPC, as a workspace that installed the client finds them.
  fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');

  it('compiles with its oRPC entry, for a browser as for Node', () => {
    expect(compile(root, '-p', 'tsconfig.json')).toBe('');
    expect(read(root, 'dist/orpc.d.ts')).toContain('createRpcClient');
  });

  it('type-checks a consumer of the procedures, each refusal of the contract narrowed to its codes', () => {
    write(root, 'consumer/consumer.ts', RPC_CONSUMER);

    write(
      root,
      'consumer/tsconfig.json',
      JSON.stringify({
        compilerOptions: {
          target: 'ES2023',
          lib: ['ES2023', 'DOM'],
          module: 'ESNext',
          moduleResolution: 'Bundler',
          strict: true,
          noUncheckedIndexedAccess: true,
          exactOptionalPropertyTypes: true,
          verbatimModuleSyntax: true,
          noEmit: true,
          skipLibCheck: true,
          types: [],
          paths: { 'scheduling-api-client/orpc': ['../src/orpc.ts'] },
        },
        include: ['consumer.ts'],
      }),
    );

    expect(compile(path.join(root, 'consumer'), '-p', 'tsconfig.json')).toBe('');
  });
});

describe('the client of a contract whose names would clash', () => {
  it('compiles, each operation named apart and each schema kept apart from the exports of the client', () => {
    const root = writtenClient(CLASHING_CONTRACT, 'clashes-api-client');

    expect(compile(root, '-p', 'tsconfig.json')).toBe('');
    expect(read(root, 'src/schemas.ts')).toContain('export type ErrorCode_ = string;');
    expect(read(root, 'dist/index.d.ts')).toContain('createClient');
  });
});

/** What the compiler says in a directory; empty when it is satisfied. */
function compile(root: string, ...args: string[]): string {
  try {
    execFileSync(process.execPath, [COMPILER, ...args], { cwd: root, encoding: 'utf8', stdio: 'pipe' });

    return '';
  } catch (error) {
    return error instanceof Error && 'stdout' in error ? String(error.stdout) : String(error);
  }
}
