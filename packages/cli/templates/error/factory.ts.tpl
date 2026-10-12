  static {{refusal.camel}}() {
    // TODO(domain): take as parameters the facts that explain this refusal (which {{context.words}} rule, which value), give them as the third argument and write a message a domain expert would recognise; a fact reaches the client only when named: `.exposing('<fact>')`. The code is the stable contract.
    return {{name.pascal}}Error.refusal('{{error.code}}', '{{refusal.title}}.');
  }
