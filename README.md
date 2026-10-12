# GACI Backend

API REST del sistema **GACI — Gestión Automatizada de Costos de Importación**.

## Stack

- Node.js 24 (LTS) + Express 5 + TypeScript 6 (`strict: true`)
- Prisma ORM 6.19.3 + PostgreSQL
- Zod para validación
- JWT (access token en header + refresh token en cookie HttpOnly)

## Requisitos

- Node.js ≥ 20
- PostgreSQL 16+ corriendo localmente
- pnpm (`corepack enable` o `npm install -g pnpm`)

## Setup inicial

```bash
pnpm install
cp .env.example .env   # completar con valores reales (ver abajo)
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm dev
```

El servidor queda en `http://localhost:3000`. Verificar con:

```bash
curl http://localhost:3000/health
```

### Variables de entorno

Ver [.env.example](.env.example). Los secrets de JWT deben generarse con:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

`.env` nunca se sube a control de versiones.

### Usuario admin inicial

El seed crea `admin@gaci.local` con la contraseña definida en `ADMIN_INITIAL_PASSWORD`.
**Debe cambiarse en el primer inicio de sesión.**

## Scripts

| Script | Descripción |
|---|---|
| `pnpm dev` | Servidor en modo desarrollo (watch) |
| `pnpm build` | Compila a `dist/` |
| `pnpm start` | Corre el build compilado |
| `pnpm typecheck` | Verifica tipos sin emitir |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |
| `pnpm prisma:migrate` | Aplica migraciones (desarrollo) |
| `pnpm prisma:studio` | Explorador visual de la BD |
| `pnpm prisma:seed` | Ejecuta `prisma/seed.ts` (datos base y tarifas; solo desarrollo) |
| `pnpm prisma:samples` | Productos y cotizaciones de ejemplo; `--reset` borra todas las cotizaciones antes |
| `pnpm test` | Suite de pruebas (motor de cálculo, paridad con el Excel de PFI, escenarios) |

## Documentación

- [Cálculo de flete y cotizaciones multimodo (PFI)](docs/calculo-flete-pfi.md): reglas del
  consolidador, modelo de escenarios, API, operación y verificación.
- `GACI-Architecture.md` en la raíz del proyecto: diseño general (su sección de cálculo fue
  superada por el documento anterior).
