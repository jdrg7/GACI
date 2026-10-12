# Cálculo de flete y cotizaciones multimodo (PFI)

Fuente de verdad del flete del consolidador: el calculador de PFI
(`CALCULATOR TECNASA HONDURAS.xlsx`). Este documento describe cómo el sistema lo reproduce,
cómo se modelan las cotizaciones con varios modos de transporte y cómo operar/verificar todo.

## 1. Reglas de cálculo del consolidador (PFI)

Entradas por embarque: libras reales (lb), pies cúbicos (CFT) y, derivados de ellos:

| Valor | Fórmula |
|---|---|
| kg reales | `lb / 2.2046` |
| lb volumétricas | `CFT × 1728 / divisor` (divisor de la tarifa; PFI = 166) |
| kg volumétricos | `lb volumétricas / 2.2046` |
| peso cobrable (aéreo) | `MAX(kg reales, kg volumétricos)` |

Cada línea cuesta `MAX(tarifa × base, mínimo)`. **No** hay "mínimo + excedente".

**Aéreo** (base: peso cobrable salvo Cartage):

| Línea | Tarifa | Mínimo |
|---|---|---|
| Air Freight Regular | $1.85/kg | $210 |
| Air Freight Priority | $2.80/kg | $270 |
| Fuel Surcharge | $0.55/kg | $50 |
| Security Surcharge | $0.15/kg | $25 |
| Cartage (`MAX(lb reales, lb volumétricas)`) | $0.04/lb | $75 |
| Fuel Index Surcharge | $0.20/kg | $20 |
| Screening Surcharge | $0.12/kg | $10 |
| Forwarding Fee / TSA | fijo $50 / $55 | — |

**Marítimo** (cada línea cobra el mayor entre la tarifa por CFT y la tarifa por LB):

| Línea | Por CFT | Por LB | Mínimo |
|---|---|---|---|
| Ocean Freight | $3.29 | $0.10 | $221 |
| Fuel Surcharge | $1.367 | $0.10 | $50 |
| Security | $0.14 | $0.10 | $50 |
| Delivery (solo lb reales) | — | $0.06 | $125 |
| B/L, Forwarding, Accessorial | fijo $20 / $85 / $25 | | |

El **agente aduanero** siempre cobra sobre **peso real** (nunca el cobrable/volumétrico).

## 2. Cómo se modela (datos, no código)

- `ConsolidatorTariffComponent.basis_candidates` (JSON): lista de `{ basis, rate, minimum }` con
  `basis ∈ KG | LB | CFT | VOL_KG | VOL_LB`. Un `MAX_OF` con candidatas cobra la mayor.
  Ej.: aéreo = `[{KG,1.85,210},{VOL_KG,1.85,210}]`; Ocean = `[{CFT,3.29,221},{LB,0.10,221}]`.
- `ConsolidatorTariffComponent.service_level` (`REGULAR` | `PRIORITY` | null): un componente con
  nivel solo aplica cuando la cotización tiene ese nivel. Air Freight Priority **reemplaza** al
  regular; el resto de líneas no cambia.
- `ConsolidatorTariff.volumetric_divisor` (default 166).
- `volume_cft` tiene 6 decimales (producto, pallet, cotización).
- Las bases de cobro usan valores físicos **sin redondear**; solo los totales guardados se
  redondean a 3 decimales.

## 3. Cotización multimodo

- Una cotización calcula **todos los modos con tarifa vigente** (Aéreo y Marítimo) y guarda un
  `QuotationScenario` por modo con sus totales y líneas de costo. El CIF cambia con el flete, por
  eso el agente se recalcula por escenario.
- `Quotation.transport_type` es el modo **elegido**; sus totales (`total_cost`, `sale_price`, …)
  reflejan ese escenario, así que listas, dashboard y comparador no cambian.
- Por defecto queda el más barato (`scenario_chosen = false`); el comercial lo confirma o cambia
  (`scenario_chosen = true`). **No se puede enviar sin confirmar el modo.**
- `service_level` (Regular/Priority) solo mueve el escenario aéreo.
- Si un modo no tiene tarifa vigente, solo aparece el disponible.
- "Otros costos internacionales" está fuera del flujo por ahora (la API los ignora y quedan en 0).
- El **margen** y el **precio de venta** están ocultos en la UI por ahora: no se pide al crear ni
  se muestra en detalle, lista, comparador ni dashboard (se usa el costo total). La API sigue
  aceptando `margin_amount` (opcional, default 0), así que reactivarlo es solo cuestión de UI.
- Costo total = flete del consolidador + agente aduanero **sin ISV**. El CIF y el ISV son solo base
  de cálculo / referencia y no se suman.

### Congelamiento
- Antes de enviar (BORRADOR, PENDIENTE, ALTERNATIVA) cualquier recálculo usa tarifas y tipo de
  cambio **vigentes**.
- Al pasar a **ENVIADA** se recalcula una última vez y todo queda congelado. Se audita:
  `sent_scenario` (modo, nivel, costo, venta, tipo de cambio) y, si cambió, `total_cost` /
  `exchange_rate`.
- Al marcar **GANADA** se indica el modo que aceptó el cliente (`accepted_scenario`).
- Los overrides manuales sobreviven a recálculos (mismo escenario + categoría + nombre).

## 4. API

| Endpoint | Cambio |
|---|---|
| `POST /api/quotations` | `transport_type` opcional (modo preferido), `service_level` (default REGULAR); `other_international_costs` se ignora |
| `GET /api/quotations/:id` | Añade `scenarios[]` (totales + `cost_details` por modo), `service_level`, `scenario_chosen`; `cost_details` de primer nivel = escenario elegido |
| `PATCH /api/quotations/:id` | Acepta `service_level`; recalcula todos los escenarios |
| `POST /api/quotations/:id/scenario` | `{ transport_type, reason? }` elige/confirma el modo |
| `POST /api/quotations/:id/state` | `transport_type` opcional, solo para ENVIADA y GANADA; ENVIADA exige modo confirmado |
| `GET /api/quotations/compare` | Cada cotización incluye `scenarios` (totales) |

## 5. Operación

- **Datos de ejemplo (solo desarrollo):** `pnpm prisma:samples` agrega 6 productos `SAMPLE-*` y 5
  cotizaciones (casos A–E); con `--reset` borra TODAS las cotizaciones antes.
- **Actualizar una tarifa:** crear una versión nueva desde el admin (nueva vigencia) y cerrar la
  anterior; las cotizaciones ya enviadas conservan su tarifa congelada. El componente MAX_OF
  admite varias bases candidatas y nivel de servicio desde el formulario.
- **No reejecutar `prisma:seed` en producción:** recrea los componentes de las tarifas PFI y
  sobrescribe cambios hechos desde el admin. Es un seed de desarrollo.
- **Migraciones:** `pnpm prisma migrate deploy` (las dos últimas son aditivas; la de escenarios
  incluye backfill de un escenario por cotización existente).

## 6. Verificación

```bash
pnpm vitest run                       # toda la suite
pnpm vitest run src/modules/calculation-engine   # solo el motor
```

- `engine.pfi-excel.test.ts`: 5 casos de oro (A = el Excel de PFI) en aéreo, Priority y marítimo.
- `engine.pfi-parity.test.ts`: 500 embarques aleatorios (semilla fija) contra un oráculo que
  transcribe las fórmulas del Excel, más puntos de quiebre. Tolerancia $0.001; la diferencia
  máxima observada es ~$0.0002 (redondeo a 4 decimales por línea).
- `pfi-fixtures.ts`: tarifas y oráculo compartidos; deben mantenerse iguales a `prisma/seed.ts`.

### Casos de oro (flete del consolidador, USD)

| Caso | Carga | Aéreo | Aéreo Priority | Marítimo |
|---|---|---|---|---|
| A — Excel de PFI | 452 lb · 68.49 CFT | 1,108.09 | 1,415.30 | 623.94 |
| B — caja pequeña | 10 lb · 1 CFT | 495.00 | 555.00 | 576.00 |
| C — carga densa | 500 lb · 26.67 CFT | 830.91 | 1,046.37 | 576.00 |
| D — voluminosa | 300 lb · 444.44 CFT | 6,312.95 | 8,306.60 | 2,387.00 |
| E — pesada | 2,500 lb · 208.33 CFT | 3,459.56 | 4,536.85 | 1,500.21 |

## 7. Pendientes conocidos

- Confirmar con PFI que Priority solo cambia Air Freight (hoy así está modelado).
- Las columnas "COST/MINIMUM" del aéreo en el Excel de PFI no alimentan ningún total y se ignoran.
- "Otros gastos" (cargos adicionales al llegar la mercadería) queda para una fase posterior.
- La hoja interna `CALCULO DE FACTURACION.xlsx` queda superada por el calculador de PFI en lo
  referente al flete (su lectura "mínimo + excedente" no corresponde a la tarifa real).
