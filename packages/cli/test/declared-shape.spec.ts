import { describe, expect, it } from 'vitest';
import { declaredShape } from '../src/check/event-sourcing/declared-shape.js';
import { readStoredShape } from '../src/check/event-sourcing/read-stored-shape.js';
import { scan } from '../src/check/scan/scan.js';

describe('the declared shape of a stored type', () => {
  it('is undefined when the file declares no type of that name, an import of it aside', () => {
    const file = scan("import type { Placed } from './placed.js';\nexport interface Other { a: string }\n");

    expect(declaredShape(file, 'Placed')).toBeUndefined();
  });

  it('reads the members of an interface, sorted, and the named types they use', () => {
    const file = scan('export interface Placed {\n  total: Money;\n  at: Date;\n  lines: readonly Line[];\n}\n');

    expect(declaredShape(file, 'Placed')).toEqual({
      members: ['at:Date', 'lines:readonlyLine[]', 'total:Money'],
      references: ['Money', 'Line'],
    });
  });

  it('keeps the literals of a member as they are written, whitespace inside them included', () => {
    const file = scan("export type Status = { kind: 'on hold' | 'paid' };\n");

    expect(declaredShape(file, 'Status')?.members).toEqual(['kind:"on hold"|"paid"']);
  });

  it('splits the members of an object type at commas and semicolons of depth zero only', () => {
    const file = scan('export type Pair = { right: (a: number, b: number) => Side, left: [Side, Side]; };\n');

    expect(declaredShape(file, 'Pair')).toEqual({
      members: ['left:[Side,Side]', 'right:(a:number,b:number)=>Side'],
      references: ['Side', 'Side', 'Side'],
    });
  });

  it('reads an alias that is not an object up to its semicolon, the brackets it opens included', () => {
    const file = scan(
      'export type Amounts = ReadonlyArray<{ value: number; currency: Currency }>;\nconst after = 1;\n',
    );

    expect(declaredShape(file, 'Amounts')).toEqual({
      members: ['ReadonlyArray<{value:number;currency:Currency}>'],
      references: ['Currency'],
    });
  });

  it('reads an alias with no semicolon up to the end of the file', () => {
    const file = scan('export type Amount = Money | Points');

    expect(declaredShape(file, 'Amount')).toEqual({ members: ['Money|Points'], references: ['Money', 'Points'] });
  });

  it('leaves the type parameters of the declaration out of the named types it uses', () => {
    const file = scan('export interface Envelope<T extends Payload = Payload, U> {\n  body: T;\n  meta: U;\n}\n');

    expect(declaredShape(file, 'Envelope')?.references).toEqual(['Payload', 'Payload']);
  });

  it('closes the list of type parameters after the nested angle brackets of a constraint', () => {
    const file = scan('export type Wrapped<T extends Array<Item>> = { value: T; extra: Extra };\n');

    expect(declaredShape(file, 'Wrapped')?.references).toEqual(['Item', 'Extra']);
  });

  it('reads a list of type parameters that never closes up to the end of the file', () => {
    const file = scan('export type Broken<T = Other');

    expect(declaredShape(file, 'Broken')?.references).toEqual(['Other']);
  });

  it('lists no named type for an enum, whose members are values', () => {
    const file = scan("export enum Channel {\n  Email = 'email',\n  Sms = 'sms',\n}\n");

    expect(declaredShape(file, 'Channel')).toEqual({ members: ['Email="email"', 'Sms="sms"'], references: [] });
  });

  it('gives the same fingerprint to two layouts of the same fields and another to a changed literal', () => {
    const compact = readStoredShape(scan("type Placed = { status: 'open'; total: number };"), 'Placed');
    const spread = readStoredShape(scan("type Placed = {\n  total: number\n  status: 'open'\n};"), 'Placed');
    const changed = readStoredShape(scan("type Placed = { status: 'closed'; total: number };"), 'Placed');

    expect(compact?.fingerprint).toBe(spread?.fingerprint);
    expect(changed?.fingerprint).not.toBe(compact?.fingerprint);
  });

  it('follows the named types the file declares and lists the others as unresolved', () => {
    const shape = readStoredShape(
      scan(
        'type Placed = { total: Money; by: Customer; data: PersonalValue };\ntype Money = { amount: number; again: Money };\n',
      ),
      'Placed',
    );

    expect(shape?.unresolved).toEqual(['Customer']);
  });
});
