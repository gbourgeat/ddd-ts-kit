  it('refuses "{{refusal.words}}" with the code {{error.code}}', () => {
    const error = {{name.pascal}}Error.{{refusal.camel}}();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('{{error.code}}');
    expect(error.message).toBe('{{refusal.title}}.');
    expect(error.facts).toEqual({});
  });
