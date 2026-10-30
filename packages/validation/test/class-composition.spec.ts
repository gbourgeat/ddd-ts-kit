import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Transform, Type } from 'class-transformer';
import { IsISO8601, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { classSchema, omitClass, partialClass, pickClass } from '../src/class-validator';

class PlaceDto {
  @IsString()
  declare room: string;
}

class AppointmentDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  declare patientId: string;

  @IsISO8601()
  declare startsAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare reason?: string;

  @ValidateNested()
  @Type(() => PlaceDto)
  declare place: PlaceDto;

  declare undecorated: number;
}

const ISO_8601 = {
  oneOf: [
    { type: 'string', format: 'date' },
    { type: 'string', format: 'date-time' },
  ],
};

class RescheduleBody extends pickClass(AppointmentDto, ['startsAt', 'place']) {}

class BookBody extends omitClass(AppointmentDto, ['reason']) {}

class EditBody extends partialClass(AppointmentDto) {}

describe('a class derived from a DTO class', () => {
  it('picks the properties named, with their constraints and their nested type', () => {
    const reschedule = classSchema(RescheduleBody);

    expect(reschedule.parse({ startsAt: '2026-10-13T09:00:00Z', place: { room: 'A' } }).ok).toBe(true);

    expect(reschedule.parse({ startsAt: 'soon', place: { room: 1 } })).toMatchObject({
      ok: false,
      error: [
        { path: 'startsAt', code: 'isIso8601' },
        { path: 'place.room', code: 'isString' },
      ],
    });

    expect(reschedule.parse({ startsAt: '2026-10-13T09:00:00Z', place: { room: 'A' }, patientId: 'p' })).toMatchObject({
      ok: false,
      error: [{ path: 'patientId', code: 'whitelistValidation' }],
    });
  });

  it('documents what it picked under the name of the class that extends it', () => {
    expect(classSchema(RescheduleBody, { shared: true }).toJsonSchema()).toEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $ref: '#/$defs/RescheduleBody',
      $defs: {
        PlaceDto: { type: 'object', properties: { room: { type: 'string' } }, required: ['room'] },
        RescheduleBody: {
          type: 'object',
          properties: { startsAt: ISO_8601, place: { $ref: '#/$defs/PlaceDto' } },
          required: ['startsAt', 'place'],
        },
      },
    });
  });

  it('omits the properties named and keeps the transformations of the others', () => {
    const book = classSchema(BookBody);
    const parsed = book.parse({ patientId: '  p-1 ', startsAt: '2026-10-13T09:00:00Z', place: { room: 'A' } });

    expect(parsed).toMatchObject({ ok: true, value: { patientId: 'p-1' } });

    expect(book.parse({ patientId: 'p', startsAt: '2026-10-13T09:00:00Z', place: { room: 'A' }, reason: 'x' }).ok).toBe(
      false,
    );
  });

  it('makes every property optional, still checked when present', () => {
    const edit = classSchema(EditBody);

    expect(edit.parse({}).ok).toBe(true);
    expect(edit.parse({ reason: 'x'.repeat(501) })).toMatchObject({ ok: false, error: [{ path: 'reason' }] });
    expect(edit.toJsonSchema()).not.toHaveProperty('required');
  });

  it('refuses to pick a property that carries no constraint, which validation would strip', () => {
    expect(() => pickClass(AppointmentDto, ['undecorated'])).toThrow(/declares no constraint on undecorated/);
  });

  it('refuses to keep nothing', () => {
    expect(() => omitClass(PlaceDto, ['room'])).toThrow(/keeps no property of PlaceDto/);
  });

  it('is documented as an object when nothing in its ancestry is', () => {
    class Bare {}

    expect(classSchema(Bare, { validator: { forbidUnknownValues: false } }).toJsonSchema()).toEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
    });
  });
});
