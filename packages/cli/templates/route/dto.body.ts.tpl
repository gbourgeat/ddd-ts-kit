{{#if route.writesBody}}
{{route.dtoBodyImports}}

export class {{name.pascal}}Body {
{{route.dtoBodyFields}}
}
{{/if}}
{{#unless route.writesBody}}
export class {{name.pascal}}Body {
  // TODO(domain): declare the fields the client sends for "{{name.words}}", each with its class-validator decorators and `declare`d without an initial value, so that a request without it is refused (shape constraints only; business rules stay in the domain).
}
{{/unless}}
