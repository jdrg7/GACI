type DefinedPartial<T> = { [K in keyof T]?: Exclude<T[K], undefined> }

// Filtra las claves con valor `undefined` de un DTO parcial (ej. un update de Zod
// con todos los campos opcionales) antes de pasarlo a Prisma, que con
// `exactOptionalPropertyTypes` no acepta `undefined` explícito en sus *UpdateInput.
export function pickDefined<T extends Record<string, unknown>>(input: T): DefinedPartial<T> {
  const result = {} as DefinedPartial<T>
  for (const key of Object.keys(input) as (keyof T)[]) {
    const value = input[key]
    if (value !== undefined) {
      result[key] = value as Exclude<T[keyof T], undefined>
    }
  }
  return result
}
