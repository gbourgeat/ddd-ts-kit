**A form refuses a body property whose name holds a dot, when the routes are built.** A field of a form is named by its path, whose segments a dot separates, so `address.line1` read as a nested field: the form lost its constraints and changed its key.

To move: rename the property, or keep it out of the body of the form.
