import { describe, expect, it } from '{{tests.module}}';
import { DomainError } from '@ddd-ts-kit/kernel';
import { {{name.pascal}}Error } from '{{alias.context}}/domain/errors/{{name.kebab}}.error{{alias.ext}}';

describe('{{name.pascal}}Error', () => {
{{error.case}}
});
