  it('refuses {{factory.words}} with the code {{error.code}}', () => {
    const error = {{name.pascal}}.{{factory.camel}}();

    expect(error).toBeInstanceOf(DomainRefusal);
    expect(error.code).toBe('{{error.code}}');
    expect(error.facts).toEqual({});
  });
