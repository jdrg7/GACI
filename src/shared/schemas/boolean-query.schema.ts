import { z } from 'zod'

// z.coerce.boolean() coacciona con Boolean(str), y Boolean('false') es true —
// hay que comparar el string explícitamente en vez de castear.
export const booleanQueryParam = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'))
