import { describe, expect, it } from 'vitest';
import { AuthorizationSetupError, PermissionRegistry, definePermissions, isPermission } from '../src';
import { billingPermissions, catalogPermissions } from './support/billing';

describe('definePermissions', () => {
  it('gives each permission a stable id made of its context and its name', () => {
    expect(billingPermissions['invoice.issue']).toEqual({
      id: 'billing:invoice.issue',
      context: 'billing',
      name: 'invoice.issue',
      description: 'Issue an invoice to a customer',
    });
  });

  it('types the id, so a mistyped permission does not compile', () => {
    const id: 'billing:invoice.read' = billingPermissions['invoice.read'].id;

    expect(id).toBe('billing:invoice.read');
  });

  it('hands out permissions nobody can alter', () => {
    expect(Object.isFrozen(billingPermissions)).toBe(true);
    expect(Object.isFrozen(billingPermissions['invoice.issue'])).toBe(true);
  });

  it.each([
    ['Billing', 'invoice.issue'],
    ['billing', 'invoice:issue'],
    ['billing', 'Invoice.Issue'],
    ['billing', '*'],
    ['', 'invoice.issue'],
  ])('refuses the names %j and %j', (context, name) => {
    expect(() => definePermissions(context, { [name]: { description: 'x' } })).toThrow(AuthorizationSetupError);
  });

  it('recognizes its permissions among unknown values', () => {
    expect(isPermission(billingPermissions['invoice.read'])).toBe(true);
    expect(isPermission({ id: 'billing:invoice.read' })).toBe(false);
    expect(isPermission({ id: 'x', context: 'billing', name: 'invoice.read', description: '' })).toBe(false);
    expect(isPermission('billing:invoice.read')).toBe(false);
  });
});

describe('PermissionRegistry', () => {
  const registry = PermissionRegistry.of(catalogPermissions, billingPermissions);

  it('lists every permission of the application, in a stable order', () => {
    expect(registry.all().map((permission) => permission.id)).toEqual([
      'billing:invoice.issue',
      'billing:invoice.read',
      'billing:invoice.void',
      'catalog:product.edit',
    ]);
  });

  it('lists the contexts and the permissions of one of them', () => {
    expect(registry.contexts()).toEqual(['billing', 'catalog']);
    expect(registry.inContext('catalog')).toEqual([catalogPermissions['product.edit']]);
  });

  it('finds a permission by its id', () => {
    expect(registry.find('billing:invoice.void')).toBe(billingPermissions['invoice.void']);
    expect(registry.find('billing:invoice.pay')).toBeUndefined();
  });

  it('refuses a context declared twice with the same permission', () => {
    const again = definePermissions('billing', { 'invoice.issue': { description: 'Again' } });

    expect(() => PermissionRegistry.of(billingPermissions, again)).toThrow('"billing:invoice.issue" is declared twice');
  });
});
