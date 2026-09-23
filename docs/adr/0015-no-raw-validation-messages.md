# 0015 — No raw validation message ever reaches a person

## Context

On a real iPhone, saving an edited task showed:

> Invalid input: expected string, received undefined

Two things lined up. The couple app's edit form sent a PATCH without the `id`
its schema requires (a client bug). And core's `fields.id()` and
`fields.version()` name a message only for a *malformed* value, not for a
*missing* one, so Zod fell back to its own English default. `useSubmit` then did
what it is designed to do with an error for a field the form does not show: it
surfaced the message at the top of the form.

Every other field in `core/validation/fields` names its message. The gap was
that nothing guaranteed the fallback.

## Decision

`core/validation/fields.ts` installs a global Zod error map:

```ts
z.config({ customError: () => copy.errors.validation });
```

Zod's precedence keeps every explicit message (a field's own `error`, a
refinement's message) and uses this only where a schema named nothing. The
fallback is the platform's generic Hebrew sentence ("חלק מהשדות לא מולאו
כראוי."), never Zod's text.

The client bug is fixed where it was (the form now sends `id`), and a unit test
(`tests/unit/core/validation.test.ts`) asserts that a missing id or version
yields no Latin text.

## Consequences

- A client bug that omits a required key now shows a calm generic sentence
  instead of an internal one. It is still a bug, and still logged server-side
  as a validation failure.
- The config is global to the Zod instance. Any schema imported through
  `fields` gets it; schemas elsewhere in the process do too, which is the
  intent.
