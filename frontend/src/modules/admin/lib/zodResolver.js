// A resolver adapter for react-hook-form, so every admin form validates
// against the same zod schemas the services use.
//
// This is deliberately hand-rolled rather than pulling in
// @hookform/resolvers: the adapter is fifteen lines, and the project already
// carries both halves. If that package is ever added for another reason,
// delete this file and swap the import — the call sites do not change.

export function zodResolver(schema) {
  return async (values) => {
    const result = schema.safeParse(values)

    if (result.success) {
      return { values: result.data, errors: {} }
    }

    const errors = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join('.')
      // First message per field wins — a field showing three errors at once
      // is noise, not help.
      if (path && !errors[path]) {
        errors[path] = { type: issue.code, message: issue.message }
      }
    }

    return { values: {}, errors }
  }
}
