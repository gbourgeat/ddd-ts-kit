  it('refuses {{factory.words}} with the code {{error.code}}', () => {
    const error = {{name.pascal}}.{{factory.camel}}();

    expect(error).toBeInstanceOf(DomainRefusal);
    expect(error.code).toBe({{codes.list}}.{{name.pascal}});
    expect(error.facts).toEqual({});
  });
