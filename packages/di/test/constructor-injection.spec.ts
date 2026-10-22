import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { Adapter, injected } from '@ddd-ts-kit/kernel/declarations';
import {
  contextModule,
  createApplication,
  createTestApplication,
  declaredTokens,
  fake,
  kernelModule,
  type DeclaredSource,
} from '../src';
import { discoverContext } from '../src/discovery';
import * as billing from './fixtures/contexts/billing/billing.declarations';
import * as mistakes from './fixtures/contexts/wiring-mistakes';
import { wiringFailure } from './support/failure';

const workspace = mkdtempSync(path.join(os.tmpdir(), 'constructor-injection-'));

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

abstract class Stamp {
  abstract next(): string;
}

type StampClass = new (clock: Clock, ids: IdGenerator) => Stamp;

/** A class declared as the generated code declares it: no list, the constructor states what it takes. */
function stamping(): StampClass {
  const ClockedStamp = stamping.undeclared();

  Adapter(Stamp)(ClockedStamp);

  return ClockedStamp;
}

stamping.undeclared = (): StampClass =>
  class ClockedStamp implements Stamp {
    constructor(
      readonly clock: Clock,
      readonly ids: IdGenerator,
    ) {}

    next(): string {
      return `${this.ids.next()} at ${this.clock.now().toISOString()}`;
    }
  };

function composing(declared: DeclaredSource): () => unknown {
  return () => createApplication({ modules: [kernelModule(), contextModule('stamps', declared)] });
}

describe('a class whose constructor states its dependencies', () => {
  it('is given what the generated file of its context registered, in the order of its parameters', () => {
    const ClockedStamp = stamping();

    injected(ClockedStamp, [Clock, IdGenerator]);

    const app = createTestApplication({ modules: [contextModule('stamps', [ClockedStamp])], idPrefix: 'stamp' });

    expect(app.resolve(Stamp).next()).toBe(`stamp-1 at ${app.clock.now().toISOString()}`);

    expect(app.describe().bindings).toContainEqual(
      expect.objectContaining({ token: 'Stamp', dependencies: ['Clock', 'IdGenerator'] }),
    );
  });

  it('stops the composition, by name and with the command to run, when no list was registered for it', () => {
    const failure = wiringFailure(composing([mistakes.GetInvoiceWithoutList]));

    expect(failure.code).toBe('MISSING_DEPENDENCIES');

    expect(failure.message).toBe(
      'Class GetInvoiceWithoutList of module "stamps" takes 1 constructor parameter and no dependency list is known for it: its decorator names none, and no generated file that was loaded registered one. Run `ddd-ts-kit docs`, which reads the constructors and rewrites the generated files of the context (the <folder>.declarations.ts of each role folder, which <context>.declarations.ts re-exports, or <context>.dependencies.ts under discovery), and assemble the context from <context>.declarations.ts or by discovery; the composition root then injects each parameter by its type.',
    );
  });

  it('stops the composition when the registered list was read from another constructor: nothing is injected as undefined', () => {
    const [Short, Long] = [stamping(), stamping()];

    Reflect.apply(injected, undefined, [Short, [Clock]]);
    Reflect.apply(injected, undefined, [Long, [Clock, IdGenerator, Clock]]);

    const short = wiringFailure(composing([Short]));

    expect(short.code).toBe('DEPENDENCY_ARITY');

    expect(short.message).toBe(
      'Class ClockedStamp of module "stamps" takes 2 constructor parameters and the generated file of its context registered 1 ([Clock]): a parameter would be left undefined. The generated file is stale. Run `ddd-ts-kit docs`, which reads the constructors and rewrites the generated files of the context (the <folder>.declarations.ts of each role folder, which <context>.declarations.ts re-exports, or <context>.dependencies.ts under discovery), and assemble the context from <context>.declarations.ts or by discovery.',
    );

    expect(wiringFailure(composing([Long])).code).toBe('DEPENDENCY_ARITY');
  });

  it('keeps the list of its decorator when it has one, which wins over what was registered', () => {
    class Listed implements Stamp {
      constructor(
        readonly clock: Clock,
        readonly ids: IdGenerator,
      ) {}

      next(): string {
        return this.ids.next();
      }
    }

    Adapter(Stamp, [Clock, IdGenerator])(Listed);
    Reflect.apply(injected, undefined, [Listed, [IdGenerator, Clock]]);

    const app = createTestApplication({ modules: [contextModule('stamps', [Listed])], idPrefix: 'stamp' });

    expect(app.resolve(Stamp).next()).toBe('stamp-1');
  });

  it('refuses a list of a decorator shorter than the constructor, which a cast or plain JavaScript lets through', () => {
    const ShortListed = stamping.undeclared();

    Reflect.apply(Adapter(Stamp, [Clock]), undefined, [ShortListed]);

    const failure = wiringFailure(composing([ShortListed]));

    expect(failure.code).toBe('DEPENDENCY_ARITY');

    expect(failure.message).toBe(
      'Class ClockedStamp of module "stamps" takes 2 constructor parameters and its decorator lists 1 ([Clock]): a parameter would be left undefined. Name one token per constructor parameter, in order, or remove the list and let the constructor state the dependencies.',
    );
  });
});

describe('every declared class of a context', () => {
  it('is built from its barrel, each constructor given what it takes', () => {
    const app = createTestApplication({
      modules: [contextModule('billing', billing)],
      fakes: [fake(billing.CustomerDirectory, { exists: async () => true })],
    });

    const built = declaredTokens(billing).map((token) => app.resolve(token));

    expect(built).toHaveLength(10);
    expect(built.every((instance) => typeof instance === 'object' && instance !== null)).toBe(true);
    expect(declaredTokens([billing.IssueInvoice, billing.GetInvoice])).toEqual([]);
  });

  it('is built under discovery from the generated dependencies file, and refused by name without it', async () => {
    const handler = 'application/queries/get-invoice/get-invoice.handler.mjs';

    const load = async (file: URL): Promise<unknown> => {
      if (file.pathname.endsWith('billing.dependencies.mjs')) {
        return Reflect.apply(injected, undefined, [mistakes.GetInvoiceWithoutList, [billing.InvoiceRepository]]);
      }

      return file.pathname.endsWith(handler)
        ? { GetInvoiceWithoutList: mistakes.GetInvoiceWithoutList }
        : { InMemoryInvoiceRepository: billing.InMemoryInvoiceRepository };
    };

    const files = { [handler]: '', 'infrastructure/persistence/in-memory-invoice.repository.mjs': '' };
    const without = await discoverContext('billing', contextWith(files), { load });

    expect(wiringFailure(() => createApplication({ modules: [kernelModule(), without] })).code).toBe(
      'MISSING_DEPENDENCIES',
    );

    const sidecar = { ...files, 'billing.dependencies.mjs': '' };
    const withIt = await discoverContext('billing', contextWith(sidecar), { load });
    const app = createApplication({ modules: [kernelModule(), withIt] });

    expect(app.resolve(mistakes.GetInvoiceWithoutList)).toBeInstanceOf(mistakes.GetInvoiceWithoutList);
  });

  it('says which generated dependencies file failed to load, and how to rewrite it', async () => {
    const directory = contextWith({
      'infrastructure/persistence/in-memory-invoice.repository.mjs': '',
      'billing.dependencies.mjs': "throw new Error('InvoiceRepository is not exported');",
    });

    const load = async (file: URL): Promise<unknown> =>
      file.pathname.endsWith('.dependencies.mjs')
        ? import(/* @vite-ignore */ file.href)
        : { InMemoryInvoiceRepository: billing.InMemoryInvoiceRepository };

    await expect(discoverContext('billing', directory, { load })).rejects.toMatchObject({
      code: 'DISCOVERY_FAILED',
      message: `${path.join(directory, 'billing.dependencies.mjs')} could not be loaded: InvoiceRepository is not exported. It is generated: run \`ddd-ts-kit docs\` to rewrite it.`,
    });
  });
});

/** A context directory on disk, written for one spec: paths relative to it, with their text. */
function contextWith(files: Readonly<Record<string, string>>): string {
  const directory = mkdtempSync(path.join(workspace, 'context-'));

  for (const [relative, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(directory, relative)), { recursive: true });
    writeFileSync(path.join(directory, relative), text);
  }

  return directory;
}
