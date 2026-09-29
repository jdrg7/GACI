import { PrismaClient } from '@prisma/client'
import { isProduction } from './env'

export const prisma = new PrismaClient({
  log: isProduction ? ['error', 'warn'] : ['error', 'warn', 'query'],
})
