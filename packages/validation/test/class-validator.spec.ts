import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import { classSchema } from '../src/class-validator';

class OrderItemDto {
  @IsString()
  @MinLength(1)
  declare sku: string;

  @IsInt()
  @Min(1)
  declare quantity: number;
}

class PlaceOrderDto {
  @IsUUID()
  declare customerId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  declare note?: string;

  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @ArrayMinSize(1)
  declare items: OrderItemDto[];
}

const order = classSchema(PlaceOrderDto);

/** The same fields under another name, as a presentation type often does. */
class RushOrderDto extends PlaceOrderDto {}

class OptionalNoteDto {
  @IsOptional()
  @IsString()
  declare note?: string;
}

class LaterNoteDto extends OptionalNoteDto {}

/** A route that reads nothing yet: no field declared. */
class NothingDto {}

/** A nested field whose class class-transformer is not told, so it stays a plain object. */
class UntypedNestedDto {
  @ValidateNested()
  declare item: OrderItemDto;
}

/** As the generated projects write it: a class with no decorated field is not refused for having none. */
const UNKNOWN_VALUES_ALLOWED = { validator: { forbidUnknownValues: false } };

/** As a team writes a DTO by hand: a reason and an amount that class-transformer would keep when the input lacks them. */
class InitializedRefundDto {
  @IsString()
  reason = '';

  @IsInt()
  amount = 0;

  @IsOptional()
  @IsString()
  note?: string;
}

/** A slot of an order, nested: once required, once left to nested validation alone. */
class SlotDto {
  @IsString()
  declare startsAt: string;
}

class RequiredSlotDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => SlotDto)
  declare slot: SlotDto;
}

class NestedOnlySlotDto {
  @ValidateNested()
  @Type(() => SlotDto)
  declare slot: SlotDto;
}

class GiftOrderDto extends PlaceOrderDto {
  @IsString()
  declare message: string;
}

describe('the class-validator adapter', () => {
  it('returns an instance of the class with nested instances', () => {
    const result = order.parse({
      customerId: '0b8f6e0e-2f4b-4c58-9c0e-6f1d2a3b4c5d',
      items: [{ sku: 'A-1', quantity: 2 }],
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value).toBeInstanceOf(PlaceOrderDto);
      expect(result.value.items[0]).toBeInstanceOf(OrderItemDto);
      expect(result.value.items[0]?.quantity).toBe(2);
    }
  });

  it('flattens nested errors into dotted paths, one issue per constraint', () => {
    const result = order.parse({ customerId: 'nope', items: [{ sku: '', quantity: 0 }] });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'customerId', code: 'isUuid' }),
          expect.objectContaining({ path: 'items.0.sku', code: 'minLength' }),
          expect.objectContaining({ path: 'items.0.quantity', code: 'min' }),
        ]),
      );
    }
  });

  it('refuses a property the class does not declare', () => {
    const result = order.parse({
      customerId: '0b8f6e0e-2f4b-4c58-9c0e-6f1d2a3b4c5d',
      items: [{ sku: 'A-1', quantity: 1 }],
      admin: true,
    });

    expect(result).toMatchObject({
      ok: false,
      error: [{ path: 'admin', code: 'whitelistValidation' }],
    });
  });

  it('lets the caller relax the whitelist', () => {
    const relaxed = classSchema(OrderItemDto, { validator: { forbidNonWhitelisted: false } });
    const result = relaxed.parse({ sku: 'A-1', quantity: 1, extra: true });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value).not.toHaveProperty('extra');
    }
  });

  it('accepts the empty object alone for a class with no field, when unknown values are allowed', () => {
    const nothing = classSchema(NothingDto, UNKNOWN_VALUES_ALLOWED);

    expect(nothing.parse({}).ok).toBe(true);

    expect(nothing.parse({ admin: true })).toMatchObject({
      ok: false,
      error: [{ path: 'admin', code: 'whitelistValidation' }],
    });
  });

  it('refuses every field of a nested object it cannot check, when unknown values are allowed', () => {
    const untyped = classSchema(UntypedNestedDto, UNKNOWN_VALUES_ALLOWED);

    expect(untyped.parse({ item: { sku: 'A-1', quantity: 1 } })).toMatchObject({
      ok: false,
      error: [
        { path: 'item.sku', code: 'whitelistValidation' },
        { path: 'item.quantity', code: 'whitelistValidation' },
      ],
    });
  });

  it('refuses an input that is not an object', () => {
    expect(order.parse([])).toMatchObject({ ok: false, error: [{ path: '', code: 'isObject' }] });
    expect(order.parse(null).ok).toBe(false);
  });

  it('produces a self-contained JSON Schema carrying the nested class', () => {
    const schema = order.toJsonSchema();

    expect(schema).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        customerId: { type: 'string', format: 'uuid' },
        note: { type: 'string', maxLength: 200 },
        items: { type: 'array', minItems: 1, items: { $ref: '#/$defs/OrderItemDto' } },
      },
      $defs: {
        OrderItemDto: {
          type: 'object',
          properties: { sku: { type: 'string', minLength: 1 }, quantity: { type: 'integer', minimum: 1 } },
          required: ['sku', 'quantity'],
        },
      },
    });

    expect(schema['required']).toEqual(['customerId', 'items']);
    expect(Object.keys(schema['$defs'] ?? {})).toEqual(['OrderItemDto']);
  });

  it('carries no definitions when the class has no nested class', () => {
    expect(classSchema(OrderItemDto).toJsonSchema()).not.toHaveProperty('$defs');
  });
});

describe('the JSON Schema of a class that extends another', () => {
  it('holds the properties of the class it extends, when it declares none of its own', () => {
    expect(classSchema(RushOrderDto).toJsonSchema()).toMatchObject({
      type: 'object',
      properties: { customerId: {}, note: {}, items: {} },
      required: expect.arrayContaining(['customerId', 'items']),
    });
  });

  it('requires nothing when no class of its lineage does, and is an object when none declares a field', () => {
    class NothingDto {}

    expect(classSchema(LaterNoteDto).toJsonSchema()).not.toHaveProperty('required');
    expect(classSchema(NothingDto).toJsonSchema()).toMatchObject({ type: 'object' });
  });

  it('holds its own properties next to those it inherits', () => {
    const schema = classSchema(GiftOrderDto).toJsonSchema();

    expect(Object.keys(schema['properties'] as object).sort()).toEqual(['customerId', 'items', 'message', 'note']);
    expect(schema['required']).toEqual(expect.arrayContaining(['customerId', 'items', 'message']));
  });
});

describe('the class-validator adapter, on a field the input lacks', () => {
  it('refuses at construction a class whose fields have an initial value, naming the class, the fields and the fix', () => {
    expect(() => classSchema(InitializedRefundDto)).toThrow(DeclarationError);

    expect(() => classSchema(InitializedRefundDto)).toThrow(
      'InitializedRefundDto gives `reason`, `amount` an initial value, which class-transformer keeps for a field the input lacks: an input without it would pass. Declare each without an initial value, `declare reason: <its type>;`; a field whose absence means a default is `@IsOptional()` and read with `?? <default>`.',
    );
  });

  it('lets through a class whose optional field holds no value on a fresh instance', () => {
    expect(classSchema(OptionalNoteDto).parse({})).toMatchObject({ ok: true });
  });

  it('refuses an input that leaves out a nested object it requires with @IsDefined(), which nested validation alone lets through', () => {
    expect(classSchema(RequiredSlotDto).parse({})).toMatchObject({
      ok: false,
      error: [{ path: 'slot', code: 'isDefined' }],
    });

    expect(classSchema(NestedOnlySlotDto).parse({})).toMatchObject({ ok: true });
  });
});
