import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerido'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1),

  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  CORS_ORIGIN: z.string().min(1),

  ADMIN_INITIAL_PASSWORD: z.string().min(8).optional(),
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas o faltantes:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
export const isProduction = env.NODE_ENV === 'production'
