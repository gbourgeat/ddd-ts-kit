import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

export class OrganisationSlugTaken extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.OrganisationSlugTaken;

  static forSlug(slug: string) {
    return OrganisationSlugTaken.refusal(`An organisation is already named ${slug}.`, { slug }).exposing('slug');
  }
}
