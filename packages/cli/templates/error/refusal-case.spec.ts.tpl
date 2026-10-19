  it('refuses {{factory.words}} with the code {{error.code}}', () => {
    const error = {{name.pascal}}.{{factory.camel}}();

    expect(error).toBeInstanceOf(DomainRefusal);
    expect(error.code).toBe('{{error.code}}');
    expect(error.message).toBe('{{name.title}}.');
    expect(error.facts).toEqual({});
  });
