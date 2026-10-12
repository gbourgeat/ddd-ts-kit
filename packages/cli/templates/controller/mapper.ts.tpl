import { RequestMapper, type HttpRequest } from '@ddd-ts-kit/http';
{{route.mapperImports}}

@RequestMapper()
export class {{name.pascal}}Mapper implements RequestMapper<{{route.mapperRequest}}, {{route.input}}> {
  map(request: {{route.mapperRequest}}): {{route.input}} {
    // TODO(domain): hand over what the {{route.messageKind}} needs from `request` (params, query, body){{route.actorNote}}.
    return {{route.mapperMessage}};
  }
}
