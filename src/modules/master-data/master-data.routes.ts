import { Router } from 'express'
import clientsRoutes from './clients/clients.routes'
import productsRoutes from './products/products.routes'
import suppliersRoutes from './suppliers/suppliers.routes'
import palletsRoutes from './pallets/pallets.routes'
import consolidatorsRoutes from './consolidators/consolidators.routes'
import customsAgentsRoutes from './customs-agents/customs-agents.routes'
import countriesRoutes from './countries/countries.routes'
import exchangeRatesRoutes from './exchange-rates/exchange-rates.routes'
import currenciesRoutes from './currencies/currencies.routes'

const router = Router()

router.use('/clients', clientsRoutes)
router.use('/products', productsRoutes)
router.use('/suppliers', suppliersRoutes)
router.use('/pallets', palletsRoutes)
router.use('/consolidators', consolidatorsRoutes)
router.use('/customs-agents', customsAgentsRoutes)
router.use('/countries', countriesRoutes)
router.use('/exchange-rates', exchangeRatesRoutes)
router.use('/currencies', currenciesRoutes)

export default router
