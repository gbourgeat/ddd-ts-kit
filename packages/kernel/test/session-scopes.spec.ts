import { describe, expect, it } from 'vitest';
import { hasScope, type Session } from '../src';

const granted: Session = {
  id: 'session-1',
  actor: { id: 'ada', type: 'user', roles: [], attributes: {} },
  issuedAt: new Date(0),
  authenticationMethod: 'token',
  scopes: ['invoices:read'],
  extensions: {},
};

describe('the scopes of a session', () => {
  it('say what the credential was granted, and nothing for a session without any', () => {
    expect(hasScope(granted, 'invoices:read')).toBe(true);
    expect(hasScope(granted, 'invoices:write')).toBe(false);
    expect(hasScope({ ...granted, scopes: [] }, 'invoices:read')).toBe(false);
    expect(hasScope(undefined, 'invoices:read')).toBe(false);
  });
});
