  static {{factory.camel}}() {
    // TODO(domain): take as parameters what `{{factory.camel}}` names and the facts that explain the refusal (which {{context.words}} rule, which value), give them as the second argument and write a message a domain expert would recognise; a fact reaches the client only when named: `.exposing('<fact>')`. The code is the stable contract.
    return {{name.pascal}}.refusal('{{name.title}}.');
  }
