import { createApp } from './config/app'
import { env } from './config/env'
import { prisma } from './config/database'

const app = createApp()

const server = app.listen(env.PORT, () => {
  console.log(`🚀 GACI backend escuchando en el puerto ${env.PORT} (${env.NODE_ENV})`)
})

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} recibido. Cerrando servidor...`)
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
