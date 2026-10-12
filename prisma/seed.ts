// ============================================================
// GACI — Seed inicial
// ============================================================
// Qué carga este seed:
//   1. Usuario Admin inicial
//   2. Monedas (USD + 5 centroamericanas)
//   3. Países (Honduras activo + 6 inactivos para expansión)
//   4. Tipo de cambio USD→HNL de referencia
//   5. Pallet estándar
//   6. Consolidador PFI con tarifas aéreo y marítimo 2026
//   7. Agente aduanero base con tarifa Honduras 2026
//
// Todas las reglas de negocio aquí están verificadas contra
// el caso de prueba real (300 KG, CIF $13,035, TC L27.004).
//
// IMPORTANTE: Este seed usa upsert en todos los modelos para
// ser idempotente — se puede ejecutar múltiples veces sin
// duplicar datos.
// ============================================================

import { PrismaClient, CalculationType, CostCategory, ServiceLevel, TariffBasis, TransportType } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de GACI...')

  // ──────────────────────────────────────────────────────────
  // 1. MONEDAS
  // ──────────────────────────────────────────────────────────
  console.log('  → Monedas...')

  const usd = await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: { code: 'USD', name: 'Dólar Estadounidense', symbol: '$' },
  })

  const hnl = await prisma.currency.upsert({
    where: { code: 'HNL' },
    update: {},
    create: { code: 'HNL', name: 'Lempira Hondureño', symbol: 'L' },
  })

  const gtq = await prisma.currency.upsert({
    where: { code: 'GTQ' },
    update: {},
    create: { code: 'GTQ', name: 'Quetzal Guatemalteco', symbol: 'Q' },
  })

  const crc = await prisma.currency.upsert({
    where: { code: 'CRC' },
    update: {},
    create: { code: 'CRC', name: 'Colón Costarricense', symbol: '₡' },
  })

  const nio = await prisma.currency.upsert({
    where: { code: 'NIO' },
    update: {},
    create: { code: 'NIO', name: 'Córdoba Nicaragüense', symbol: 'C$' },
  })

  const pab = await prisma.currency.upsert({
    where: { code: 'PAB' },
    update: {},
    create: { code: 'PAB', name: 'Balboa Panameño', symbol: 'B/.' },
  })

  const usd_sv = await prisma.currency.upsert({
    where: { code: 'USD' }, // El Salvador usa USD
    update: {},
    create: { code: 'USD', name: 'Dólar Estadounidense', symbol: '$' },
  })

  // ──────────────────────────────────────────────────────────
  // 2. PAÍSES
  // ──────────────────────────────────────────────────────────
  console.log('  → Países...')

  const honduras = await prisma.country.upsert({
    where: { code: 'HN' },
    update: {},
    create: { code: 'HN', name: 'Honduras', currency_id: hnl.id, is_active: true },
  })

  // Países inactivos — disponibles para expansión futura sin tocar código
  await prisma.country.upsert({
    where: { code: 'GT' },
    update: {},
    create: { code: 'GT', name: 'Guatemala', currency_id: gtq.id, is_active: false },
  })

  await prisma.country.upsert({
    where: { code: 'SV' },
    update: {},
    create: { code: 'SV', name: 'El Salvador', currency_id: usd.id, is_active: false },
  })

  await prisma.country.upsert({
    where: { code: 'CR' },
    update: {},
    create: { code: 'CR', name: 'Costa Rica', currency_id: crc.id, is_active: false },
  })

  await prisma.country.upsert({
    where: { code: 'NI' },
    update: {},
    create: { code: 'NI', name: 'Nicaragua', currency_id: nio.id, is_active: false },
  })

  await prisma.country.upsert({
    where: { code: 'PA' },
    update: {},
    create: { code: 'PA', name: 'Panamá', currency_id: pab.id, is_active: false },
  })

  await prisma.country.upsert({
    where: { code: 'EC' },
    update: {},
    create: { code: 'EC', name: 'Ecuador', currency_id: usd.id, is_active: false },
  })

  // ──────────────────────────────────────────────────────────
  // 3. USUARIO ADMIN INICIAL
  // ──────────────────────────────────────────────────────────
  console.log('  → Usuario Admin...')

  const passwordHash = await bcrypt.hash(
    process.env.ADMIN_INITIAL_PASSWORD ?? 'ChangeMe.2026!',
    12,
  )

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@gaci.local' },
    update: {},
    create: {
      email: 'admin@gaci.local',
      password_hash: passwordHash,
      full_name: 'Administrador GACI',
      role: 'ADMIN',
      is_active: true,
    },
  })

  // ──────────────────────────────────────────────────────────
  // 4. TIPO DE CAMBIO USD → HNL (referencia inicial)
  // ──────────────────────────────────────────────────────────
  console.log('  → Tipo de cambio...')

  await prisma.exchangeRate.upsert({
    where: {
      from_currency_id_to_currency_id_date: {
        from_currency_id: usd.id,
        to_currency_id: hnl.id,
        date: new Date('2026-09-14'),
      },
    },
    update: {},
    create: {
      from_currency_id: usd.id,
      to_currency_id: hnl.id,
      rate: 27.004,
      date: new Date('2026-09-14'),
      created_by: adminUser.id,
    },
  })

  // ──────────────────────────────────────────────────────────
  // 5. PALLET ESTÁNDAR
  // ──────────────────────────────────────────────────────────
  console.log('  → Pallet estándar...')

  await prisma.pallet.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Pallet Estándar',
      description: 'Pallet estándar para consolidación de carga',
      max_weight_kg: 1000,
      length_cm: 120,
      width_cm: 100,
      height_cm: 150,
      volume_cft: 63.6, // (1.2 × 1.0 × 1.5 m³) × 35.3147
      is_active: true,
    },
  })

  // ──────────────────────────────────────────────────────────
  // 6. CONSOLIDADOR PFI
  // ──────────────────────────────────────────────────────────
  console.log('  → Consolidador PFI...')

  const pfi = await prisma.consolidator.upsert({
    where: { id: '00000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'PFI',
      description: 'Consolidated Freight International — consolidador principal',
      is_active: true,
    },
  })

  // ────────────────────────────────────────
  // 6a. TARIFA AÉREA PFI — Honduras 2026
  // Fuente: "CALCULATOR TECNASA HONDURAS.xlsx" (PFI).
  // Cada línea es MAX(tarifa × base, mínimo). La base aérea es el peso cobrable
  // = MAX(peso real, peso volumétrico) → dos bases candidatas con la misma tarifa y mínimo.
  // Air Freight tiene dos componentes: REGULAR ($1.85/kg, mín $210) y PRIORITY
  // ($2.80/kg, mín $270); solo aplica el que coincide con el nivel de servicio.
  // Todos los montos en USD.
  // ────────────────────────────────────────
  console.log('  → Tarifa PFI Aéreo Honduras 2026...')

  const PFI_AEREO_NOTES =
    'Tarifas PFI para carga aérea Honduras según CALCULATOR TECNASA HONDURAS.xlsx. ' +
    'Peso cobrable = MAX(peso real, peso volumétrico = CFT × 1728 / 166).'

  const pfiAereo = await prisma.consolidatorTariff.upsert({
    where: { id: '00000000-0000-4000-8000-000000000003' },
    update: { notes: PFI_AEREO_NOTES, volumetric_divisor: 166 },
    create: {
      id: '00000000-0000-4000-8000-000000000003',
      consolidator_id: pfi.id,
      country_id: honduras.id,
      transport_type: TransportType.AEREO,
      name: 'PFI Aéreo Honduras 2026',
      valid_from: new Date('2026-01-01'),
      valid_until: null, // Vigente indefinidamente hasta nueva versión
      volumetric_divisor: 166,
      is_active: true,
      created_by: adminUser.id,
      notes: PFI_AEREO_NOTES,
    },
  })

  // Eliminar componentes previos para re-insertar limpios en upsert de tarifa
  await prisma.consolidatorTariffComponent.deleteMany({
    where: { consolidator_tariff_id: pfiAereo.id },
  })

  // Peso cobrable aéreo: se cobra el mayor entre kg reales y kg volumétricos.
  const byWeight = (rate: number, minimum: number) => [
    { basis: 'KG', rate, minimum },
    { basis: 'VOL_KG', rate, minimum },
  ]

  await prisma.consolidatorTariffComponent.createMany({
    data: [
      {
        consolidator_tariff_id: pfiAereo.id,
        name: 'Air Freight',
        calculation_type: CalculationType.MAX_OF,
        currency_id: usd.id,
        basis_candidates: byWeight(1.85, 210),
        service_level: ServiceLevel.REGULAR,
        sort_order: 1,
        notes: 'MAX(peso cobrable kg × $1.85, $210). Tarifa regular.',
      },
      {
        consolidator_tariff_id: pfiAereo.id,
        name: 'Air Freight',
        calculation_type: CalculationType.MAX_OF,
        currency_id: usd.id,
        basis_candidates: byWeight(2.8, 270),
        service_level: ServiceLevel.PRIORITY,
        sort_order: 2,
        notes: 'MAX(peso cobrable kg × $2.80, $270). Tarifa Priority: reemplaza al Air Freight regular.',
      },
      {
        consolidator_tariff_id: pfiAereo.id,
        name: 'Fuel Surcharge',
        calculation_type: CalculationType.MAX_OF,
        currency_id: usd.id,
        basis_candidates: byWeight(0.55, 50),
        sort_order: 3,
        notes: 'MAX(peso cobrable kg × $0.55, $50)',
      },
      {
        consolidator_tariff_id: pfiAereo.id,
        name: 'Security Surcharge',
        calculation_type: CalculationType.MAX_OF,
        currency_id: usd.id,
        basis_candidates: byWeight(0.15, 25),
        sort_order: 4,
        notes: 'MAX(peso cobrable kg × $0.15, $25)',
      },
      {
        consolidator_tariff_id: pfiAereo.id,
        name: 'Cartage',
        calculation_type: CalculationType.MAX_OF,
        currency_id: usd.id,
        basis_candidates: [
          { basis: 'LB', rate: 0.04, minimum: 75 },
          { basis: 'VOL_LB', rate: 0.04, minimum: 75 },
        ],
        sort_order: 5,
        notes: 'MAX(MAX(lb reales, lb volumétricas) × $0.04, $75)',
      },
      {
        consolidator_tariff_id: pfiAereo.id,
        name: 'Forwarding Fee',
        calculation_type: CalculationType.FIXED,
        currency_id: usd.id,
        fixed_amount: 50.0,
        sort_order: 6,
        notes: '$50 fijo por embarque',
      },
      {
        consolidator_tariff_id: pfiAereo.id,
        name: 'TSA Maintenance Fee',
        calculation_type: CalculationType.FIXED,
        currency_id: usd.id,
        fixed_amount: 55.0,
        sort_order: 7,
        notes: '$55 fijo por embarque',
      },
      {
        consolidator_tariff_id: pfiAereo.id,
        name: 'Fuel Index Surcharge',
        calculation_type: CalculationType.MAX_OF,
        currency_id: usd.id,
        basis_candidates: byWeight(0.2, 20),
        sort_order: 8,
        notes: 'MAX(peso cobrable kg × $0.20, $20)',
      },
      {
        consolidator_tariff_id: pfiAereo.id,
        name: 'Screening Surcharge',
        calculation_type: CalculationType.MAX_OF,
        currency_id: usd.id,
        basis_candidates: byWeight(0.12, 10),
        sort_order: 9,
        notes: 'MAX(peso cobrable kg × $0.12, $10)',
      },
    ],
  })

  // ────────────────────────────────────────
  // 6b. TARIFA MARÍTIMA PFI — Honduras 2026
  // Fuente: "CALCULATOR TECNASA HONDURAS.xlsx" (PFI).
  // Ocean Freight, Fuel y Security se calculan por CFT y por LB (cada una con su
  // mínimo) y se cobra la mayor. Delivery es por LB real. Todos los montos en USD.
  // ────────────────────────────────────────
  console.log('  → Tarifa PFI Marítimo Honduras 2026...')

  const PFI_MARITIMO_NOTES =
    'Tarifas PFI para carga marítima Honduras según CALCULATOR TECNASA HONDURAS.xlsx. ' +
    'Líneas por volumen (CFT) o por peso (LB): se cobra la mayor.'

  const pfiMaritimo = await prisma.consolidatorTariff.upsert({
    where: { id: '00000000-0000-4000-8000-000000000004' },
    update: { notes: PFI_MARITIMO_NOTES, volumetric_divisor: 166 },
    create: {
      id: '00000000-0000-4000-8000-000000000004',
      consolidator_id: pfi.id,
      country_id: honduras.id,
      transport_type: TransportType.MARITIMO,
      name: 'PFI Marítimo Honduras 2026',
      valid_from: new Date('2026-01-01'),
      valid_until: null,
      volumetric_divisor: 166,
      is_active: true,
      created_by: adminUser.id,
      notes: PFI_MARITIMO_NOTES,
    },
  })

  await prisma.consolidatorTariffComponent.deleteMany({
    where: { consolidator_tariff_id: pfiMaritimo.id },
  })

  await prisma.consolidatorTariffComponent.createMany({
    data: [
      {
        consolidator_tariff_id: pfiMaritimo.id,
        name: 'Ocean Freight',
        calculation_type: CalculationType.MAX_OF,
        currency_id: usd.id,
        basis_candidates: [
          { basis: 'CFT', rate: 3.29, minimum: 221 },
          { basis: 'LB', rate: 0.1, minimum: 221 },
        ],
        sort_order: 1,
        notes: 'MAX(CFT × $3.29, lb × $0.10, $221)',
      },
      {
        consolidator_tariff_id: pfiMaritimo.id,
        name: 'Fuel Surcharge',
        calculation_type: CalculationType.MAX_OF,
        currency_id: usd.id,
        basis_candidates: [
          { basis: 'CFT', rate: 1.367, minimum: 50 },
          { basis: 'LB', rate: 0.1, minimum: 50 },
        ],
        sort_order: 2,
        notes: 'MAX(CFT × $1.367, lb × $0.10, $50)',
      },
      {
        consolidator_tariff_id: pfiMaritimo.id,
        name: 'Security',
        calculation_type: CalculationType.MAX_OF,
        currency_id: usd.id,
        basis_candidates: [
          { basis: 'CFT', rate: 0.14, minimum: 50 },
          { basis: 'LB', rate: 0.1, minimum: 50 },
        ],
        sort_order: 3,
        notes: 'MAX(CFT × $0.14, lb × $0.10, $50)',
      },
      {
        consolidator_tariff_id: pfiMaritimo.id,
        name: 'B/L Fee',
        calculation_type: CalculationType.FIXED,
        currency_id: usd.id,
        fixed_amount: 20.0,
        sort_order: 4,
        notes: '$20 fijo por embarque',
      },
      {
        consolidator_tariff_id: pfiMaritimo.id,
        name: 'Forwarding Fee',
        calculation_type: CalculationType.FIXED,
        currency_id: usd.id,
        fixed_amount: 85.0,
        sort_order: 5,
        notes: '$85 fijo por embarque',
      },
      {
        consolidator_tariff_id: pfiMaritimo.id,
        name: 'Accessorial',
        calculation_type: CalculationType.FIXED,
        currency_id: usd.id,
        fixed_amount: 25.0,
        sort_order: 6,
        notes: '$25 fijo por embarque',
      },
      {
        consolidator_tariff_id: pfiMaritimo.id,
        name: 'Delivery',
        calculation_type: CalculationType.MAX_OF,
        currency_id: usd.id,
        rate_per_unit: 0.06,
        minimum_amount: 125.0,
        basis_unit: TariffBasis.LB,
        sort_order: 7,
        notes: 'MAX(lb reales × $0.06, $125)',
      },
    ],
  })
  // ──────────────────────────────────────────────────────────
  // 7. AGENTE ADUANERO — Agente Base Honduras
  // ──────────────────────────────────────────────────────────
  console.log('  → Agente Aduanero...')

  const agente = await prisma.customsAgent.upsert({
    where: { id: '00000000-0000-4000-8000-000000000005' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000005',
      name: 'Agente Aduanero Base Honduras',
      description: 'Agente aduanero principal para operaciones en Honduras',
      is_active: true,
    },
  })

  // ────────────────────────────────────────
  // 7a. TARIFA DEL AGENTE — Honduras 2026
  //
  // REGLAS VERIFICADAS:
  //   - Todos los montos fijos están en HNL → el motor los convierte a USD
  //   - ISV usa CIF USD como base (no CIF HNL)
  //   - Honorarios y Manejo de Mercadería: progresivo sobre CIF HNL,
  //     tramo 7 SIN mínimo (verificado contra Excel)
  //   - Supervisión: progresiva por KG, resultado en HNL
  //   - Almacenaje: ≤50 KG → L1,400; >50: L1,400 + (kg-50)×L50
  //   - Flete Terrestre: ≤300 KG → L1,200; >300: L1,200 + CEIL((kg-300)/10)×L50
  // ────────────────────────────────────────
  console.log('  → Tarifa Agente Aduanero Honduras 2026...')

  const tarifaAgente = await prisma.customsAgentTariff.upsert({
    where: { id: '00000000-0000-4000-8000-000000000006' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000006',
      customs_agent_id: agente.id,
      country_id: honduras.id,
      name: 'Agente Aduanero Base Honduras 2026',
      valid_from: new Date('2026-01-01'),
      valid_until: null,
      is_active: true,
      created_by: adminUser.id,
      notes: [
        'Tarifas verificadas contra Excel de referencia (caso 300 KG, CIF $13,035, TC L27.004).',
        'Costos en HNL se convierten a USD usando tipo de cambio congelado de la cotización.',
        'ISV calculado sobre CIF en USD (no en HNL).',
        'Honorarios: tramo 7 sin mínimo (verificado).',
      ].join(' '),
    },
  })

  await prisma.customsAgentTariffComponent.deleteMany({
    where: { customs_agent_tariff_id: tarifaAgente.id },
  })

  await prisma.customsAgentTariffComponent.createMany({
    data: [
      // ── 1. Declaración DEVA: L335.02 fijo ──
      // Nota: varía por proveedor ($5 USD por DEVA según confirmación).
      // En esta tarifa se carga el valor base de un proveedor.
      {
        customs_agent_tariff_id: tarifaAgente.id,
        name: 'Declaración DEVA',
        category: CostCategory.CUSTOMS_AGENT,
        calculation_type: CalculationType.FIXED,
        currency_id: hnl.id,
        fixed_amount: 335.02,
        sort_order: 1,
        notes: 'Fijo en HNL. Varía según proveedor ($5 USD por DEVA). Valor base de referencia.',
      },

      // ── 2. Transmisión Electrónica Digital: L450 fijo ──
      {
        customs_agent_tariff_id: tarifaAgente.id,
        name: 'Transmisión Electrónica Digital',
        category: CostCategory.CUSTOMS_AGENT,
        calculation_type: CalculationType.FIXED,
        currency_id: hnl.id,
        fixed_amount: 450.00,
        sort_order: 2,
        notes: 'Fijo en HNL.',
      },

      // ── 3. Papelería: L100 fijo ──
      {
        customs_agent_tariff_id: tarifaAgente.id,
        name: 'Papelería',
        category: CostCategory.CUSTOMS_AGENT,
        calculation_type: CalculationType.FIXED,
        currency_id: hnl.id,
        fixed_amount: 100.00,
        sort_order: 3,
        notes: 'Fijo en HNL.',
      },

      // ── 4. Examen Preliminar: L500 fijo ──
      {
        customs_agent_tariff_id: tarifaAgente.id,
        name: 'Examen Preliminar',
        category: CostCategory.CUSTOMS_AGENT,
        calculation_type: CalculationType.FIXED,
        currency_id: hnl.id,
        fixed_amount: 500.00,
        sort_order: 4,
        notes: 'Fijo en HNL.',
      },

      // ── 5. Fotocopias: L100 fijo ──
      {
        customs_agent_tariff_id: tarifaAgente.id,
        name: 'Fotocopias',
        category: CostCategory.CUSTOMS_AGENT,
        calculation_type: CalculationType.FIXED,
        currency_id: hnl.id,
        fixed_amount: 100.00,
        sort_order: 5,
        notes: 'Fijo en HNL.',
      },

      // ── 6. Llenado de DUCA: L650 fijo ──
      {
        customs_agent_tariff_id: tarifaAgente.id,
        name: 'Llenado de DUCA',
        category: CostCategory.CUSTOMS_AGENT,
        calculation_type: CalculationType.FIXED,
        currency_id: hnl.id,
        fixed_amount: 650.00,
        sort_order: 6,
        notes: 'Fijo en HNL.',
      },

      // ── 7. Llenado de DI: L500 fijo ──
      {
        customs_agent_tariff_id: tarifaAgente.id,
        name: 'Llenado de DI',
        category: CostCategory.CUSTOMS_AGENT,
        calculation_type: CalculationType.FIXED,
        currency_id: hnl.id,
        fixed_amount: 500.00,
        sort_order: 7,
        notes: 'Fijo en HNL.',
      },

      // ── 8. Supervisión y Registro Aduanal ──
      // Progresiva por KG. Resultado en HNL → motor convierte a USD.
      // Verificado: 300 KG → L220
      //
      // Tramo 1: ≤50 KG → L200 fijo
      // Tramo 2: 51–550 KG → L0.08 por KG del tramo
      // Tramo 3: 551–1,550 KG → L0.06 por KG del tramo
      // Tramo 4: 1,551–6,550 KG → L0.05 por KG del tramo
      // Tramo 5: >6,550 KG → L0.05 por KG del tramo
      {
        customs_agent_tariff_id: tarifaAgente.id,
        name: 'Supervisión y Registro Aduanal',
        category: CostCategory.CUSTOMS_AGENT,
        calculation_type: CalculationType.RANGE_KG,
        currency_id: hnl.id,
        tariff_ranges: [
          { from: 0,    to: 50,   type: 'fixed',    amount: 200 },
          { from: 50,   to: 550,  type: 'per_unit', rate: 0.08 },
          { from: 550,  to: 1550, type: 'per_unit', rate: 0.06 },
          { from: 1550, to: 6550, type: 'per_unit', rate: 0.05 },
          { from: 6550, to: null, type: 'per_unit', rate: 0.05 },
        ],
        sort_order: 8,
        notes: 'Progresiva acumulativa por KG. Resultado en HNL, se convierte a USD. Verificado: 300 KG → L220.',
      },

      // ── 9. Manejo de Mercadería ──
      // Misma tabla progresiva que Honorarios, sobre CIF en HNL.
      // RANGE_VALUE: base = CIF_USD × tipo_cambio.
      // Resultado en HNL → motor convierte a USD.
      // Verificado: CIF $13,035 / TC L27.004 → CIF LPS L351,997.14 → L4,140.9857
      {
        customs_agent_tariff_id: tarifaAgente.id,
        name: 'Manejo de Mercadería',
        category: CostCategory.CUSTOMS_AGENT,
        calculation_type: CalculationType.RANGE_VALUE,
        currency_id: hnl.id,
        tariff_ranges: [
          { from: 0,      to: 1500,   type: 'fixed',     amount: 1000 },
          { from: 1500,   to: 4000,   type: 'per_value', rate: 0.05,  min: 125 },
          { from: 4000,   to: 24000,  type: 'per_value', rate: 0.03,  min: 600 },
          { from: 24000,  to: 64000,  type: 'per_value', rate: 0.015, min: 600 },
          { from: 64000,  to: 124000, type: 'per_value', rate: 0.01,  min: 600 },
          { from: 124000, to: 200000, type: 'per_value', rate: 0.006, min: 456 },
          { from: 200000, to: null,   type: 'per_value', rate: 0.005 }, // Sin mínimo — verificado
        ],
        sort_order: 9,
        notes: 'Progresiva sobre CIF en HNL (CIF_USD × tipo_cambio). Sin mínimo en tramo 7 (verificado). Resultado HNL → USD.',
      },

      // ── 10. Honorarios Profesionales ──
      // Idéntica tabla a Manejo de Mercadería.
      // Verificado: CIF LPS L351,997.14 → L4,140.9857 → $153.35 USD (TC L27.004)
      {
        customs_agent_tariff_id: tarifaAgente.id,
        name: 'Honorarios Profesionales',
        category: CostCategory.CUSTOMS_AGENT,
        calculation_type: CalculationType.RANGE_VALUE,
        currency_id: hnl.id,
        tariff_ranges: [
          { from: 0,      to: 1500,   type: 'fixed',     amount: 1000 },
          { from: 1500,   to: 4000,   type: 'per_value', rate: 0.05,  min: 125 },
          { from: 4000,   to: 24000,  type: 'per_value', rate: 0.03,  min: 600 },
          { from: 24000,  to: 64000,  type: 'per_value', rate: 0.015, min: 600 },
          { from: 64000,  to: 124000, type: 'per_value', rate: 0.01,  min: 600 },
          { from: 124000, to: 200000, type: 'per_value', rate: 0.006, min: 456 },
          { from: 200000, to: null,   type: 'per_value', rate: 0.005 }, // Sin mínimo — verificado
        ],
        sort_order: 10,
        notes: 'Progresiva sobre CIF en HNL. Sin mínimo en tramo 7. Verificado: CIF LPS 351,997.14 → L4,140.9857.',
      },

      // ── 11. Almacenaje ──
      // Progresiva por KG. Resultado en HNL → motor convierte a USD.
      // Tramo 1: ≤50 KG → L1,400 fijo
      // Tramo 2: >50 KG → L1,400 + (kg-50) × L50
      {
        customs_agent_tariff_id: tarifaAgente.id,
        name: 'Almacenaje',
        category: CostCategory.CUSTOMS_AGENT,
        calculation_type: CalculationType.RANGE_KG,
        currency_id: hnl.id,
        tariff_ranges: [
          { from: 0,  to: 50,   type: 'fixed',    amount: 1400 },
          { from: 50, to: null, type: 'base_plus', base: 1400, rate: 50, base_from: 50 },
        ],
        sort_order: 11,
        notes: '≤50 KG: L1,400 fijo. >50 KG: L1,400 + (kg-50)×L50. Resultado HNL → USD.',
      },

      // ── 12. Flete Terrestre / Movimiento a Bodega ──
      // Progresiva por KG con bloques de 10 KG sobre el exceso de 300 KG.
      // Resultado en HNL → motor convierte a USD.
      // Tramo 1: ≤300 KG → L1,200 fijo
      // Tramo 2: >300 KG → L1,200 + CEIL((kg-300)/10) × L50
      //
      // La función CEIL por bloques de 10 se implementa en el motor.
      // En tariff_ranges lo expresamos como rate=50 con block_size=10.
      {
        customs_agent_tariff_id: tarifaAgente.id,
        name: 'Flete Terrestre',
        category: CostCategory.CUSTOMS_AGENT,
        calculation_type: CalculationType.RANGE_KG,
        currency_id: hnl.id,
        tariff_ranges: [
          { from: 0,   to: 300,  type: 'fixed',       amount: 1200 },
          { from: 300, to: null, type: 'block_ceil',   base: 1200, rate: 50, block_size: 10, base_from: 300 },
        ],
        sort_order: 12,
        notes: '≤300 KG: L1,200 fijo. >300 KG: L1,200 + CEIL((kg-300)/10)×L50. Resultado HNL → USD.',
      },

      // ── 13. ISV (Impuesto Sobre Ventas) ──
      // Base: CIF en USD (NO en HNL) × 15%
      // Resultado directo en USD — sin conversión.
      // ATENCIÓN: el documento funcional original decía CIF LPS × 15%,
      // pero el Excel de referencia usa CIF USD × 15%. Se usa CIF USD.
      {
        customs_agent_tariff_id: tarifaAgente.id,
        name: 'ISV',
        category: CostCategory.CUSTOMS_AGENT,
        calculation_type: CalculationType.PER_VALUE,
        currency_id: usd.id, // USD — sin conversión
        rate_percentage: 0.15,
        sort_order: 13,
        is_tax: true, // Impuesto de paso: se muestra en el desglose, no se suma al total_cost.
        notes: 'ISV = CIF_USD × 15%. Base: CIF en USD, resultado en USD. Verificado: CIF $13,035 → $1,955.25.',
      },
    ],
  })

  console.log('')
  console.log('✅ Seed completado exitosamente.')
  console.log('')
  console.log('   Resumen:')
  console.log('   • 6 monedas')
  console.log('   • 7 países (1 activo: Honduras)')
  console.log('   • 1 usuario admin  →  admin@gaci.local')
  console.log('   • 1 tipo de cambio USD→HNL L27.004 (2026-09-14)')
  console.log('   • 1 pallet estándar')
  console.log('   • 1 consolidador (PFI)')
  console.log('     - Tarifa Aérea Honduras 2026  (9 componentes: Air Freight regular + Priority)')
  console.log('     - Tarifa Marítima Honduras 2026 (7 componentes)')
  console.log('   • 1 agente aduanero')
  console.log('     - Tarifa Honduras 2026 (13 componentes)')
  console.log('')
  console.log('   ⚠️  Cambia la contraseña del admin en el primer inicio de sesión.')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
