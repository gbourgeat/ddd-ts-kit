import { describe, expect, it } from '{{tests.module}}';
import { DomainError } from '@ddd-ts-kit/kernel';
import { {{name.pascal}}Error } from '../../domain/errors/{{name.kebab}}.error.js';

describe('{{name.pascal}}Error', () => {
  it('carries its stable code', () => {
    const error = new {{name.pascal}}Error();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('{{error.code}}');
  });
});
