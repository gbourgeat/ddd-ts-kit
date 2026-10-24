import { describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  InMemorySubjectKeyStore,
  NotADataSubjectIdError,
  UnknownDataSubjectError,
  eraseDataSubject,
  executionContext,
  inEachTenant,
  isDataSubjectId,
  systemActor,
  type ProjectionToRebuild,
} from '../src';

describe('eraseDataSubject, the key and the rebuilds', () => {
  it('destroys the key of the subject, then rebuilds every projection fed by the store', async () => {
    const keys = new InMemorySubjectKeyStore();
    const order: string[] = [];

    await keys.keyFor('patient-1');

    const erasure = await eraseDataSubject('patient-1', {
      keys,
      rebuilds: [projection('scheduling.history', 4, order), projection('scheduling.counts', 7, order)],
    });

    expect(erasure).toEqual({ erased: true, copies: {}, rebuilt: { 'scheduling.history': 4, 'scheduling.counts': 7 } });
    expect(order).toEqual(['scheduling.history', 'scheduling.counts']);
  });

  it('rebuilds again for a subject already erased, which completes an erasure whose rebuild failed', async () => {
    const order: string[] = [];

    const erasure = await eraseDataSubject('patient-2', {
      keys: new InMemorySubjectKeyStore(),
      rebuilds: [projection('scheduling.history', 0, order)],
    });

    expect(erasure).toEqual({ erased: false, copies: {}, rebuilt: { 'scheduling.history': 0 } });
    expect(order).toEqual(['scheduling.history']);
  });

  it('rebuilds nothing when nothing is fed by the store', async () => {
    const keys = new InMemorySubjectKeyStore();

    await keys.keyFor('patient-1');

    expect(await eraseDataSubject('patient-1', { keys })).toEqual({ erased: true, copies: {}, rebuilt: {} });
  });

  it('refuses a subject that is not an opaque identifier before any key is touched: a name or an email', async () => {
    const keys = new InMemorySubjectKeyStore();
    const order: string[] = [];
    const pasted = await keys.keyFor('Ada Lovelace');

    await expect(
      eraseDataSubject('Ada Lovelace', { keys, rebuilds: [projection('scheduling.history', 0, order)] }),
    ).rejects.toThrow(NotADataSubjectIdError);

    await expect(
      eraseDataSubject('ada@example.org', { keys, rebuilds: [projection('scheduling.history', 0, order)] }),
    ).rejects.toThrow(NotADataSubjectIdError);

    await expect(keys.find(pasted.id)).resolves.toEqual(pasted);
    expect(order).toEqual([]);

    expect([isDataSubjectId('patient-1'), isDataSubjectId('ada@example.org'), isDataSubjectId(42)]).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('refuses an id that destroys no key and that nobody knows, before any rebuild', async () => {
    const order: string[] = [];

    await expect(
      eraseDataSubject('patinet-1', {
        keys: new InMemorySubjectKeyStore(),
        rebuilds: [projection('scheduling.history', 0, order)],
        isKnown: async () => false,
      }),
    ).rejects.toThrow(UnknownDataSubjectError);

    expect(order).toEqual([]);
  });

  it('erases a subject nobody knows any more, as long as it has a key: the key comes first, the record after', async () => {
    const keys = new InMemorySubjectKeyStore();
    const order: string[] = [];

    await keys.keyFor('patient-gone');

    const erasure = await eraseDataSubject('patient-gone', {
      keys,
      rebuilds: [projection('scheduling.history', 2, order)],
      isKnown: async () => false,
    });

    expect(erasure).toEqual({ erased: true, copies: {}, rebuilt: { 'scheduling.history': 2 } });
    expect(order).toEqual(['scheduling.history']);
  });

  it('rebuilds even when the erasure fails, since its key may be gone already, then throws its failure', async () => {
    const order: string[] = [];

    await expect(
      eraseDataSubject('patient-3', {
        keys: new UnrecordedErasureKeyStore(),
        rebuilds: [projection('scheduling.history', 0, order)],
      }),
    ).rejects.toThrow('audit database unreachable');

    expect(order).toEqual(['scheduling.history']);
  });
});

describe('eraseDataSubject, the copies the contexts keep of the person', () => {
  it('erases every copy once per tenant, after the key and before the rebuilds, and counts the rows of each', async () => {
    const keys = new InMemorySubjectKeyStore();
    const order: string[] = [];

    await keys.keyFor('patient-4');

    const erasure = await eraseDataSubject('patient-4', {
      keys,
      rebuilds: [projection('scheduling.history', 1, order)],
      copies: [copy('identity.persons', 1, order), copy('scheduling.patient', 3, order)],
      inEveryTenant: inTenants(['acme', 'north'], order),
    });

    expect(erasure).toEqual({
      erased: true,
      copies: { 'identity.persons': 2, 'scheduling.patient': 6 },
      rebuilt: { 'scheduling.history': 1 },
    });

    expect(order).toEqual([
      'acme',
      'identity.persons',
      'north',
      'identity.persons',
      'acme',
      'scheduling.patient',
      'north',
      'scheduling.patient',
      'scheduling.history',
    ]);
  });

  it('takes a subject whose copies alone are left for a run again, not for a mistyped id', async () => {
    const order: string[] = [];

    const erasure = await eraseDataSubject('patient-5', {
      keys: new InMemorySubjectKeyStore(),
      copies: [copy('notification.contacts', 1, order)],
      isKnown: async () => false,
    });

    expect(erasure).toEqual({ erased: false, copies: { 'notification.contacts': 1 }, rebuilt: {} });
  });

  it('runs the other copies and the rebuilds when one copy fails, then throws that failure: running again completes', async () => {
    const order: string[] = [];

    await expect(
      eraseDataSubject('patient-6', {
        keys: new InMemorySubjectKeyStore(),
        rebuilds: [projection('scheduling.history', 0, order)],
        copies: [failingCopy('identity.persons'), copy('notification.contacts', 1, order)],
        isKnown: async () => false,
      }),
    ).rejects.toThrow('identity unreachable');

    expect(order).toEqual(['notification.contacts', 'scheduling.history']);
  });

  it('throws the failure of the key before the one of a copy, once everything ran', async () => {
    await expect(
      eraseDataSubject('patient-7', {
        keys: new UnrecordedErasureKeyStore(),
        copies: [failingCopy('identity.persons')],
      }),
    ).rejects.toThrow('audit database unreachable');
  });
});

describe('inEachTenant', () => {
  it('runs the work once per tenant, in the context of the work given that tenant, and sums what it answers', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const seen: (string | undefined)[] = [];
    const operator = executionContext({ correlationId: 'erasure-1', actor: systemActor('erasure'), origin: 'cli' });

    const total = await scope.run(operator, () =>
      inEachTenant(scope, ['acme', 'north'])(async () => {
        const current = scope.require();

        seen.push(`${current.tenantId}:${current.correlationId}:${current.origin}`);

        return current.tenantId === 'acme' ? 2 : 3;
      }),
    );

    expect(total).toBe(5);
    expect(seen).toEqual(['acme:erasure-1:cli', 'north:erasure-1:cli']);
    expect(scope.current()).toBeUndefined();
  });

  it('needs a context to run in: the operator and the correlation of the erasure are its', async () => {
    const scope = new AsyncLocalStorageExecutionScope();

    await expect(inEachTenant(scope, ['acme'])(async () => 1)).rejects.toThrow();
  });
});

/** A key store that destroys the key, then fails, as the audited store does when its entry cannot be written. */
class UnrecordedErasureKeyStore extends InMemorySubjectKeyStore {
  override async erase(subject: string): Promise<boolean> {
    await super.erase(subject);

    throw new Error('audit database unreachable');
  }
}

function projection(name: string, replayed: number, order: string[]): ProjectionToRebuild {
  return {
    name,
    rebuild: async () => {
      order.push(name);

      return { replayed };
    },
  };
}

function copy(name: string, rows: number, order: string[]) {
  return {
    name,
    erase: async () => {
      order.push(name);

      return rows;
    },
  };
}

function failingCopy(name: string) {
  return { name, erase: () => Promise.reject(new Error('identity unreachable')) };
}

/** Runs the work once per tenant, naming the tenant before, as `inEachTenant` does with the execution scope. */
function inTenants(tenants: readonly string[], order: string[]) {
  return async (work: () => Promise<number>): Promise<number> => {
    let total = 0;

    for (const tenant of tenants) {
      order.push(tenant);
      total += await work();
    }

    return total;
  };
}
