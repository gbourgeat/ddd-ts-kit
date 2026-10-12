import { Serializer } from '@ddd-ts-kit/http';
{{route.serializerImports}}

@Serializer()
export class {{name.pascal}}Serializer implements Serializer<{{route.resultType}}, {{route.serializedType}}> {
  serialize(_result: {{route.resultType}}): {{route.serializedType}} {
    // TODO(domain): copy the public fields of the result, dates as ISO text; what the contract does not declare stays inside.
    return {};
  }
}
